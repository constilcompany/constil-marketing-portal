// ============================================================
// _lib/auth/client.ts - Clientes Supabase
// ============================================================

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

let _serviceClient: SupabaseClient | null = null;

/**
 * Retorna o cliente Supabase com service_role (singleton).
 * ⚠️ Ignora RLS — use apenas para operações administrativas.
 */
export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _serviceClient;
}

/**
 * Cria um cliente anon com o JWT do usuário (para signIn, signUp, etc.)
 */
export function getAnonClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}