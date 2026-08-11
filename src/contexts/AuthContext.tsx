import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: Database['public']['Tables']['profiles']['Row'] | null;
  loading: boolean;
  sessionId: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchRoleAndProfile = useCallback(async (userId: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const [roleRes, profileRes] = await Promise.all([
        supabase.rpc('get_user_role', { _user_id: userId }),
        supabase.from('profiles').select('*').eq('user_id', userId).single(),
      ]);
      if (roleRes.data) setRole(roleRes.data);
      if (profileRes.data) setProfile(profileRes.data);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const createSession = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          is_active: true,
          user_agent: navigator.userAgent.substring(0, 255),
        })
        .select('id')
        .single();
      if (data) {
        setSessionId(data.id);
        sessionStorage.setItem('app_session_id', data.id);
      }
    } catch (err) {
      console.error('Failed to create session');
    }
  }, []);

  const invalidateSession = useCallback(async (userId: string) => {
    try {
      // Invalidate all active sessions for this user via RPC
      await supabase.rpc('invalidate_user_sessions', { _user_id: userId });
    } catch {
      // Silent fail - session cleanup is best-effort
    }
  }, []);

  useEffect(() => {
    // Restore session ID from storage
    const storedSessionId = sessionStorage.getItem('app_session_id');
    if (storedSessionId) setSessionId(storedSessionId);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Use setTimeout to prevent Supabase auth deadlock
        setTimeout(() => fetchRoleAndProfile(session.user.id), 0);
      } else {
        setRole(null);
        setProfile(null);
        setSessionId(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoleAndProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchRoleAndProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      await createSession(data.user.id);
    }
    return { error: error as Error | null };
  }, [createSession]);

  const signOut = useCallback(async () => {
    const currentUserId = user?.id;
    
    // 1. Invalidate sessions in backend
    if (currentUserId) {
      await invalidateSession(currentUserId);
    }

    // 2. Sign out from Supabase auth
    await supabase.auth.signOut();

    // 3. Clear all local state
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    setSessionId(null);

    // 4. Clear all browser storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage might be blocked in some browsers
    }
  }, [user, invalidateSession]);

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, sessionId, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
