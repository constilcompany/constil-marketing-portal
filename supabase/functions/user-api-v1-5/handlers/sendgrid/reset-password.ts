// ============================================================
// handlers/sendgrid/reset-password.ts (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import type { HandlerContext } from "../../_lib/types.ts";
import { sendResetPasswordEmail } from "../../_lib/sendgrid/index.ts";

export async function sendgridResetPasswordHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { to, name, code, link, validity, sandbox } = body;
  if (!to || !name || !code) {
    return json(
      {
        success: false,
        error: '"to", "name" and "code" fields are required',
      },
      400,
    );
  }
  if (!isValidEmail(to)) return json({ success: false, error: "Invalid email" }, 400);

  try {
    const result = await sendResetPasswordEmail(
      to,
      {
        name,
        code,
        link: link || "https://constil.com/reset-password",
        validity: validity || "15",
      },
      { sandbox: sandbox === true },
    );
    return json({
      success: true,
      message: "✅ Password reset email sent successfully!",
      data: result,
    });
  } catch (error: any) {
    console.error("[sendgrid/reset-password] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}