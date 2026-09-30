// ============================================================
// _lib/auth/ip.ts - Extração de IP confiável
// ============================================================

/**
 * Obtém o IP do cliente com prioridade para headers confiáveis
 * (Cloudflare, Supabase, proxies).
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}