// ============================================================
// handlers/sendgrid/send-real.ts - Envio sem sandbox (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import { sendEmail } from "../../_lib/sendgrid/sendgrid.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function sendgridSendRealHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { to, subject, text, html, cc, bcc, replyTo, attachments } = body;

  if (!to) return json({ success: false, error: '"to" field is required' }, 400);
  if (!isValidEmail(to)) return json({ success: false, error: "Invalid email" }, 400);
  if (!text && !html) {
    return json(
      { success: false, error: "At least one of 'text' or 'html' is required" },
      400,
    );
  }

  try {
    const result = await sendEmail({
      to,
      subject: subject || "Message from Constil",
      text: text || "Email content",
      html: html || `<p>${text || "Email content"}</p>`,
      cc,
      bcc,
      replyTo,
      attachments,
      sandbox: false,
      type: "sendgrid/send-real",
    });
    return json({ success: true, message: "✅ Real email sent successfully!", data: result });
  } catch (error: any) {
    console.error("[sendgrid/send-real] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}