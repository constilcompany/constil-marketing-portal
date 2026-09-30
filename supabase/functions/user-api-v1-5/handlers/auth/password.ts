// ============================================================
// handlers/auth/password.ts - forgot-password, reset-password
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import {
  sanitize,
  isValidEmail,
  validatePassword,
} from "../../_lib/validation.ts";
import { getClientIP } from "../../_lib/auth/index.ts";
import { checkRateLimit } from "../../_lib/rate-limit.ts";
import { RATE_LIMITS, IS_DEV } from "../../_lib/config.ts";
import {
  generateCode,
  sendResetPasswordEmail,
} from "../../_lib/sendgrid/index.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function forgotPasswordHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient } = ctx;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const email = sanitize(body.email, 255).toLowerCase();
  if (!email || !isValidEmail(email)) {
    return json({ error: "Invalid email" }, 400);
  }

  const clientIP = getClientIP(req);
  const allowed = await checkRateLimit(
    serviceClient,
    `${clientIP}:${email}`,
    "forgot-password",
    RATE_LIMITS["forgot-password"].max,
    RATE_LIMITS["forgot-password"].window,
  );
  if (!allowed) return safeError("Too many requests", 429);

  const GENERIC_RESPONSE = {
    success: true,
    message: "If an account exists with that email, a reset code has been sent.",
  };

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("user_id, full_name")
    .eq("email", email)
    .single();

  if (!profile) return json(GENERIC_RESPONSE);

  const otp = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await serviceClient
    .from("password_reset_otps")
    .update({ used: true })
    .eq("email", email)
    .eq("used", false);

  const { data: otpRecord, error: otpError } = await serviceClient
    .from("password_reset_otps")
    .insert({
      email,
      otp_code: otp,
      expires_at: expiresAt.toISOString(),
      purpose: "password_reset",
    })
    .select()
    .single();

  if (otpError) {
    console.error("Erro ao criar OTP:", otpError);
    return json(GENERIC_RESPONSE);
  }

  try {
    await sendResetPasswordEmail(email, {
      code: otp,
      name: profile.full_name || "",
      link: "https://constil.com/reset-password",
      validity: "10",
    });
  } catch (e) {
    console.error("Failed to send reset email:", e);
  }

  const response: any = { ...GENERIC_RESPONSE };
  if (IS_DEV) {
    response._debug_otp = otp;
    response._debug_otp_id = otpRecord.id;
  }
  return json(response);
}

export async function resetPasswordHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient } = ctx;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const email = sanitize(body.email, 255).toLowerCase();
  const otpCode = sanitize(body.otp, 10);
  const password = body.password;

  if (!email || !otpCode || !password) {
    return json({ error: "Email, OTP and password are required" }, 400);
  }
  if (!isValidEmail(email)) return json({ error: "Invalid email format" }, 400);

  const pwdError = validatePassword(password);
  if (pwdError) return json({ error: pwdError }, 400);

  const { data: otpRecord } = await serviceClient
    .from("password_reset_otps")
    .select("*")
    .eq("email", email)
    .eq("otp_code", otpCode)
    .eq("used", false)
    .eq("purpose", "password_reset")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!otpRecord) return json({ error: "Invalid or expired code" }, 400);

  await serviceClient
    .from("password_reset_otps")
    .update({ used: true })
    .eq("id", otpRecord.id);

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .single();
  if (!profile) return json({ error: "User not found" }, 404);

  const { error } = await serviceClient.auth.admin.updateUserById(
    profile.user_id,
    { password },
  );
  if (error) return json({ error: "Failed to update password" }, 400);

  await serviceClient.from("audit_logs").insert({
    user_id: profile.user_id,
    action: "password_reset",
    ip_address: getClientIP(req),
  });

  return json({ success: true, message: "Password updated successfully" });
}