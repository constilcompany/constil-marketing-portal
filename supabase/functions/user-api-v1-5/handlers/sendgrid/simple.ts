// ============================================================
// handlers/sendgrid/simple.ts - POST /sendgrid/simple (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import type { HandlerContext } from "../../_lib/types.ts";
import { sendSimpleTemplateEmail } from "../../_lib/sendgrid/index.ts";

export async function sendgridSimpleHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const {
    to,
    subject,
    name,
    message,
    buttonText,
    buttonLink,
    footerMessage,
    additionalHtml,
    sandbox,
  } = body;

  if (!to || !message) {
    return json(
      { success: false, error: '"to" and "message" fields are required' },
      400,
    );
  }
  if (!isValidEmail(to)) return json({ success: false, error: "Invalid email" }, 400);

  try {
    const result = await sendSimpleTemplateEmail(
      to,
      {
        subject: subject || "Message from CONSTIL",
        name: name || "User",
        message,
        additionalHtml: additionalHtml || "",
        buttonText: buttonText || "",
        buttonLink: buttonLink || "",
        footerMessage: footerMessage || "",
      },
      { sandbox: sandbox === true },
    );
    return json({
      success: true,
      message: "✅ Simple template sent successfully!",
      data: result,
    });
  } catch (error: any) {
    console.error("[sendgrid/simple] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}