// ============================================================
// _lib/supabase.ts - Clientes Supabase e auth
// ============================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _serviceClient;
}

export function getAnonClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

export interface AuthContext {
  userId: string;
  email: string | null;
}

/**
 * Extrai userId e email do request autenticado.
 * Lança se inválido.
 */
export async function requireAuth(
  req: Request,
  serviceClient: SupabaseClient,
): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");
  const anonClient = getAnonClient(authHeader);
  const { data: claimsData, error } = await anonClient.auth.getClaims(token);
  if (error || !claimsData?.claims) {
    throw new AuthError("Unauthorized");
  }

  const userId = claimsData.claims.sub as string;
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .single();

  return { userId, email: profile?.email ?? null };
}

export async function requireAdmin(
  req: Request,
  serviceClient: SupabaseClient,
): Promise<AuthContext> {
  const ctx = await requireAuth(req, serviceClient);
  const { data } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("user_id", ctx.userId)
    .single();

  if (data?.role !== "admin") {
    throw new AuthError("Forbidden");
  }
  return ctx;
}

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

/**
 * Obtém IP do cliente (com prioridade para headers confiáveis)
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}