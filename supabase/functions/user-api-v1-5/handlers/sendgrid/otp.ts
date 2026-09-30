// ============================================================
// handlers/sendgrid/otp.ts - POST /sendgrid/otp (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import { sendOtpEmail, generateCode } from "../../_lib/sendgrid/index.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function sendgridOtpHandler(
  ctx: HandlerContext,
): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { to, code, validity, name, sandbox } = body;
  if (!to) return json({ success: false, error: '"to" field is required' }, 400);
  if (!isValidEmail(to)) {
    return json({ success: false, error: "Invalid email" }, 400);
  }

  try {
    const result = await sendOtpEmail(
      to,
      {
        code: code || generateCode(),
        validity: validity || "5",
        name: name || "User",
      },
      { sandbox: sandbox === true },
    );
    return json({
      success: true,
      message: "✅ OTP sent successfully!",
      data: result,
    });
  } catch (error: any) {
    console.error("[sendgrid/otp] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}