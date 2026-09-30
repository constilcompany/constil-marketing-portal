// ============================================================
// handlers/auth/google.ts - POST /google
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { sanitize, isValidPhone } from "../../_lib/validation.ts";
import { getClientIP } from "../../_lib/auth/index.ts";
import { checkRateLimit } from "../../_lib/rate-limit.ts";
import { RATE_LIMITS } from "../../_lib/config.ts";
import { sendWelcomeEmail } from "../../_lib/sendgrid/index.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function googleHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient } = ctx;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const idToken = body.id_token;
  if (!idToken) return json({ error: "Google id_token is required" }, 400);

  const clientIP = getClientIP(req);
  const allowed = await checkRateLimit(
    serviceClient,
    clientIP,
    "google",
    RATE_LIMITS.google.max,
    RATE_LIMITS.google.window,
  );
  if (!allowed) return safeError("Too many requests", 429);

  const { data, error } = await serviceClient.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error) {
    console.error("Google signInWithIdToken error:", error.message);
    return json({ error: "Google sign-in failed", detail: error.message }, 401);
  }

  const userId = data.user.id;
  const isNewUser = data.user.created_at === data.user.updated_at;

  if (isNewUser) {
    const phone = sanitize(body.phone, 20);
    const full_name = sanitize(body.full_name, 100);
    const coupon_code = sanitize(body.coupon_code, 50);

    await serviceClient.from("profiles").upsert(
      {
        user_id: userId,
        email: data.user.email,
        full_name: full_name || data.user.user_metadata?.full_name || "",
        phone: phone || null,
        email_verified: true, // Google já verificou
        phone_verified: !!phone && isValidPhone(phone),
      },
      { onConflict: "user_id" },
    );

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

    const newUserEmail = data.user.email;
    if (newUserEmail) {
      try {
        await sendWelcomeEmail(newUserEmail, {
          name: full_name || data.user.user_metadata?.full_name || "User",
        });
      } catch (e) {
        console.error("Failed to send welcome email:", e);
      }
    }
  }

  await serviceClient.from("sessions").insert({
    user_id: userId,
    is_active: true,
    ip_address: clientIP.substring(0, 45),
    user_agent: (req.headers.get("user-agent") || "").substring(0, 255),
  });

  await serviceClient.from("audit_logs").insert({
    user_id: userId,
    action: "google_login",
    ip_address: clientIP,
    metadata: { is_new_user: isNewUser },
  });

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: { id: userId, email: data.user.email },
    is_new_user: isNewUser,
  });
}
