// ============================================================
// handlers/auth/otp.ts - send-signup-otp, verify-otp
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { sanitize, isValidEmail } from "../../_lib/validation.ts";
import { getClientIP } from "./supabase.ts";
import { checkRateLimit } from "../../_lib/rate-limit.ts";
import { RATE_LIMITS, IS_DEV } from "../../_lib/config.ts";
import { generateCode } from "../../_lib/crypto.ts";
import { sendOtpEmail } from "../sendgrid/email-templates.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function sendSignupOtpHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient } = ctx;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const email = sanitize(body.email, 255).toLowerCase();
  if (!email) return json({ error: "Email is required" }, 400);
  if (!isValidEmail(email)) return json({ error: "Invalid email format" }, 400);

  // ⚠️ Não revela se existe: retorna sucesso genérico
  const { data: existing } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  const clientIP = getClientIP(req);
  const allowed = await checkRateLimit(
    serviceClient,
    `${clientIP}:${email}`,
    "send-signup-otp",
    RATE_LIMITS["send-signup-otp"].max,
    RATE_LIMITS["send-signup-otp"].window,
  );
  if (!allowed) return safeError("Too many requests", 429);

  if (existing) {
    // Retorna sucesso genérico (não vaza)
    return json({ success: true, message: "Verification code sent successfully!" });
  }

  const otp = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await serviceClient
    .from("password_reset_otps")
    .update({ used: true })
    .eq("email", email)
    .eq("used", false);

  const { error: otpError } = await serviceClient
    .from("password_reset_otps")
    .insert({
      email,
      otp_code: otp,
      expires_at: expiresAt.toISOString(),
      purpose: "signup",
    });

  if (otpError) {
    console.error("Erro ao criar OTP:", otpError);
    return safeError("Failed to generate verification code", 500);
  }

  try {
    await sendOtpEmail(email, { code: otp, name: "", validity: "10" });
  } catch (e) {
    console.error("Falha ao enviar OTP:", e);
  }

  const response: any = {
    success: true,
    message: "Verification code sent successfully!",
    expires_in: "10 minutes",
  };

  // 👈 Só expõe OTP em desenvolvimento
  if (IS_DEV) response._debug_otp = otp;

  return json(response);
}

export async function verifyOtpHandler(ctx: HandlerContext): Promise<Response> {
  const { serviceClient } = ctx;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const email = sanitize(body.email, 255).toLowerCase();
  const otpCode = sanitize(body.otp, 10);
  if (!email || !otpCode) {
    return json({ error: "Email and OTP are required" }, 400);
  }
  if (!isValidEmail(email)) return json({ error: "Invalid email format" }, 400);

  const { data: otpRecord, error: otpError } = await serviceClient
    .from("password_reset_otps")
    .select("*")
    .eq("email", email)
    .eq("otp_code", otpCode)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (otpError || !otpRecord) {
    return json({ error: "Invalid or expired code", code: "OTP_INVALID" }, 400);
  }

  await serviceClient
    .from("password_reset_otps")
    .update({ used: true })
    .eq("id", otpRecord.id);

  if (otpRecord.purpose === "signup") {
    await serviceClient
      .from("profiles")
      .update({ email_verified: true })
      .eq("email", email);
  }

  return json({
    success: true,
    message: "OTP verified successfully!",
    purpose: otpRecord.purpose || "generic",
    verified: true,
  });
}