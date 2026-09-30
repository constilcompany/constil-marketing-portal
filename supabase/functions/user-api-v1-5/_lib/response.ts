// ============================================================
// _lib/response.ts - Helpers de resposta HTTP
// ============================================================

import { corsHeaders, securityHeaders } from "./config.ts";

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      "Content-Type": "application/json",
    },
  });

const SAFE_MESSAGES: Record<number, string> = {
  400: "Invalid request",
  401: "Unauthorized",
  402: "Payment required",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  410: "Gone",
  429: "Too many requests. Please try again later.",
  500: "Something went wrong",
};

export function safeError(message: string, status = 500): Response {
  return json({ error: SAFE_MESSAGES[status] || message }, status);
}

export const optionsResponse = (): Response =>
  new Response(null, { headers: corsHeaders });