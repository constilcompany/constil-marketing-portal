// ============================================================
// handlers/auth/register.ts
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { sanitize, isValidEmail, isValidPhone, validatePassword } from "../../_lib/validation.ts";
import { getClientIP } from "./supabase.ts";
import { checkRateLimit } from "../../_lib/rate-limit.ts";
import { RATE_LIMITS } from "../../_lib/config.ts";
import { sendWelcomeEmail } from "../sendgrid/email-templates.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function registerHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient } = ctx;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const email = sanitize(body.email, 255).toLowerCase();
  const password = body.password;
  const full_name = sanitize(body.full_name, 100);
  const first_name = sanitize(body.first_name, 50);
  const last_name = sanitize(body.last_name, 50);
  const company_name = sanitize(body.company_name, 100);
  const coupon_code = sanitize(body.coupon_code, 50);
  const phone = sanitize(body.phone, 20);
  const address = sanitize(body.address, 500);
  const zip_code = sanitize(body.zip_code, 20);
  const city = sanitize(body.city, 100);
  const state = sanitize(body.state, 100);
  const country = sanitize(body.country, 100);

  if (!email || !password || !full_name) {
    return json({ error: "Missing required fields" }, 400);
  }
  if (!isValidEmail(email)) return json({ error: "Invalid email format" }, 400);

  const pwdError = validatePassword(password);
  if (pwdError) return json({ error: pwdError }, 400);

  if (phone && !isValidPhone(phone)) {
    return json({ error: "Invalid phone number format" }, 400);
  }

  const { data: existingEmail } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (existingEmail) return json({ error: "Email already registered" }, 409);

  if (phone) {
    const { data: existingPhone } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .single();
    if (existingPhone) return json({ error: "Phone number already registered" }, 409);
  }

  const clientIP = getClientIP(req);
  const allowed = await checkRateLimit(
    serviceClient,
    clientIP,
    "register",
    RATE_LIMITS.register.max,
    RATE_LIMITS.register.window,
  );
  if (!allowed) return safeError("Too many requests", 429);

  const { data: newUser, error: createErr } =
    await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // 👈 requer OTP
      user_metadata: { full_name, first_name, last_name, company_name, phone },
    });
  if (createErr) {
    console.error("Registration error:", createErr);
    return json({ error: "Registration failed" }, 400);
  }

  const userId = newUser.user.id;

  await serviceClient.from("profiles").update({
    user_id: userId,
    email,
    full_name,
    phone: phone || null,
    address: address || null,
    zip_code: zip_code || null,
    city: city || null,
    state: state || null,
    country: country || null,
    company_name: company_name || null,
    first_name: first_name || full_name.split(" ")[0],
    last_name: last_name || full_name.split(" ").slice(1).join(" "),
    email_verified: false, // 👈 só marca após OTP
    phone_verified: !!phone,
  }).eq("user_id", userId);

  if (coupon_code) {
    const upperCode = coupon_code.toUpperCase();
    const { data: coupon } = await serviceClient
      .from("coupons")
      .select("*")
      .eq("code", upperCode)
      .eq("is_active", true)
      .single();

    if (coupon) {
      const withinLimit =
        !coupon.usage_limit || coupon.usage_count < coupon.usage_limit;
      const notExpired =
        !coupon.expiry_date || new Date(coupon.expiry_date) > new Date();
      if (withinLimit && notExpired) {
        await serviceClient.from("user_attributions").insert({
          user_id: userId,
          influencer_id: coupon.influencer_id,
          coupon_id: coupon.id,
        });
        await serviceClient
          .from("coupons")
          .update({ usage_count: coupon.usage_count + 1 })
          .eq("id", coupon.id);
      }
    }
  }

  await serviceClient.from("audit_logs").insert({
    user_id: userId,
    action: "user_registered",
    ip_address: clientIP,
    user_agent: req.headers.get("user-agent") || "",
    metadata: { email, has_phone: !!phone },
  });

  // Welcome email (best-effort)
  try {
    await sendWelcomeEmail(email, {
      name: full_name,
      company: company_name || "",
      role: "",
    });
  } catch (e) {
    console.error("Failed to send welcome email:", e);
  }

  return json({
    success: true,
    user: { id: userId, email },
    message: "Account created successfully. Please verify your email.",
  });
}