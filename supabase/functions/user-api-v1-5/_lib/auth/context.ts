// ============================================================
// _lib/auth/context.ts - Autenticação e autorização
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAnonClient } from "./client.ts";

export interface AuthContext {
  userId: string;
  email: string | null;
}

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Valida o JWT e retorna userId + email.
 * Lança AuthError se inválido.
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

/**
 * Requer role=admin.
 * Lança AuthError(403) se não for admin.
 */
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
    throw new AuthError("Forbidden", 403);
  }

  return ctx;
}