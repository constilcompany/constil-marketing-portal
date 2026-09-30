// ============================================================
// _lib/types.ts - Tipos compartilhados
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface HandlerContext {
  req: Request;
  url: URL;
  path: string;
  method: string;
  serviceClient: SupabaseClient;
  userId: string | null;
  userEmail: string | null;
  clientIP: string;
}

export type Handler = (ctx: HandlerContext) => Promise<Response>;