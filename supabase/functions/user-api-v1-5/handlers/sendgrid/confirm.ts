// ============================================================
// handlers/sendgrid/confirm.ts - POST /sendgrid/confirm (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import type { HandlerContext } from "../../_lib/types.ts";
import { sendConfirmEmail, generateToken } from "../../_lib/sendgrid/index.ts";

export async function sendgridConfirmHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { to, name, link, sandbox } = body;
  if (!to || !name) {
    return json(
      { success: false, error: '"to" and "name" fields are required' },
      400,
    );
  }
  if (!isValidEmail(to)) return json({ success: false, error: "Invalid email" }, 400);

  try {
    const result = await sendConfirmEmail(
      to,
      {
        name,
        link: link || `https://constil.com/confirm/${generateToken(16)}`,
      },
      { sandbox: sandbox === true },
    );
    return json({
      success: true,
      message: "✅ Confirmation email sent successfully!",
      data: result,
    });
  } catch (error: any) {
    console.error("[sendgrid/confirm] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}