// ============================================================
// _lib/config.ts - Constantes globais
// ============================================================

export const ENVIRONMENT = Deno.env.get("ENVIRONMENT") || "production";
export const IS_DEV = ENVIRONMENT === "development";

// ---------- CORS ----------
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Security Headers ----------
export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

// ---------- Rate Limits ----------
export const RATE_LIMITS: Record<string, { max: number; window: number }> = {
  login: { max: 10, window: 300 },
  register: { max: 5, window: 300 },
  "start-free": { max: 3, window: 3600 },
  "create-checkout": { max: 20, window: 300 },
  "verify-payment": { max: 10, window: 300 },
  "consume-credit": { max: 50, window: 60 },
  google: { max: 10, window: 300 },
  "send-signup-otp": { max: 3, window: 300 },
  "forgot-password": { max: 3, window: 300 },
  "verify-otp": { max: 5, window: 300 },
  "reset-password": { max: 3, window: 300 },
  "sendgrid/send": { max: 50, window: 60 },
  "sendgrid/otp": { max: 20, window: 300 },
  "sendgrid/estimate": { max: 30, window: 3600 },
  "sendgrid/invoice": { max: 30, window: 3600 },
  "sendgrid/proposal": { max: 30, window: 3600 },
  "sendgrid/welcome": { max: 20, window: 300 },
  "sendgrid/reset-password": { max: 20, window: 300 },
  "sendgrid/confirm": { max: 20, window: 300 },
  "sendgrid/notification": { max: 30, window: 300 },
  "sendgrid/simple": { max: 30, window: 300 },
  "sendgrid/bulk": { max: 10, window: 300 },
  "sendgrid/send-real": { max: 50, window: 60 },
};

// ---------- Public Endpoints ----------
export const PUBLIC_ENDPOINTS = new Set([
  "packages",
  "register",
  "login",
  "send-signup-otp",
  "forgot-password",
  "verify-otp",
  "reset-password",
  "google",
  "auth/google",
  "stripe-webhook",
  "sendgrid/health",
]);

// ---------- SendGrid ----------
export const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
export const FROM_EMAIL =
  Deno.env.get("SENDGRID_FROM_EMAIL") || "support@constil.com";
export const FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") || "CONSTIL";

export const TEMPLATE_IDS = {
  otp: Deno.env.get("SENDGRID_TEMPLATE_OTP") || "",
  estimate: Deno.env.get("SENDGRID_TEMPLATE_ESTIMATE") || "",
  invoice: Deno.env.get("SENDGRID_TEMPLATE_INVOICE") || "",
  proposal: Deno.env.get("SENDGRID_TEMPLATE_PROPOSAL") || "",
  welcome: Deno.env.get("SENDGRID_TEMPLATE_WELCOME") || "",
  resetPassword: Deno.env.get("SENDGRID_TEMPLATE_RESET_PASSWORD") || "",
  confirm: Deno.env.get("SENDGRID_TEMPLATE_CONFIRM") || "",
  notification: Deno.env.get("SENDGRID_TEMPLATE_NOTIFICATION") || "",
  simple: Deno.env.get("SENDGRID_TEMPLATE_SIMPLE") || "",
};