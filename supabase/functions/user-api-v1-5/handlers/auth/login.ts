// ============================================================
// handlers/auth/login.ts - POST /login
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { sanitize, isValidEmail } from "../../_lib/validation.ts";
import { getClientIP, getAnonClient } from "../../_lib/auth/index.ts";
import { checkRateLimit } from "../../_lib/rate-limit.ts";
import { RATE_LIMITS } from "../../_lib/config.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function loginHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient } = ctx;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const email = sanitize(body.email, 255).toLowerCase();
  const password = body.password;
  if (!email || !password) return json({ error: "Missing credentials" }, 400);
  if (!isValidEmail(email)) return json({ error: "Invalid email format" }, 400);

  const clientIP = getClientIP(req);
  const allowed = await checkRateLimit(
    serviceClient,
    `${clientIP}:${email}`,
    "login",
    RATE_LIMITS.login.max,
    RATE_LIMITS.login.window,
  );
  if (!allowed) {
    return safeError("Too many login attempts. Please try again later.", 429);
  }

  // Usa anonClient para respeitar rate limits do Supabase Auth
  const authHeader = req.headers.get("Authorization") || "";
  const anonClient = getAnonClient(authHeader);
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await serviceClient.from("audit_logs").insert({
      action: "login_failed",
      ip_address: clientIP,
      user_agent: req.headers.get("user-agent") || "",
      metadata: { email, error: error.message },
    });
    return json({ error: "Invalid credentials" }, 401);
  }

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("email_verified, phone_verified")
    .eq("user_id", data.user.id)
    .single();

  // Bloqueia login se email não verificado
  if (profile && !profile.email_verified) {
    return json(
      {
        error: "Email not verified. Please verify your email first.",
        code: "EMAIL_NOT_VERIFIED",
      },
      403,
    );
  }

  await serviceClient.from("sessions").insert({
    user_id: data.user.id,
    is_active: true,
    ip_address: clientIP.substring(0, 45),
    user_agent: (req.headers.get("user-agent") || "").substring(0, 255),
  });

  await serviceClient.from("audit_logs").insert({
    user_id: data.user.id,
    action: "user_logged_in",
    ip_address: clientIP,
    user_agent: req.headers.get("user-agent") || "",
  });

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      email_verified: profile?.email_verified || false,
      phone_verified: profile?.phone_verified || false,
    },
  });
}