// ============================================================
// handlers/sendgrid/send.ts - ⚠️ AGORA PROTEGIDO (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { sendEmail } from "../../_lib/sendgrid/sendgrid.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function sendgridSendHandler(ctx: HandlerContext): Promise<Response> {
   const { req } = ctx; 
  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { to, subject, text, html, cc, bcc, replyTo, attachments, sandbox } = body;
  if (!to) return json({ success: false, error: '"to" field is required' }, 400);
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
      sandbox: sandbox || false,
    });
    return json({ success: true, message: "Email sent successfully!", data: result });
  } catch (error: any) {
    return json({ success: false, error: error.message }, 500);
  }
}

export async function sendgridHealthHandler(): Promise<Response> {
  return json({
    status: "healthy",
    service: "sendgrid-integrated",
    timestamp: new Date().toISOString(),
  });
}

export async function sendgridStatusHandler(): Promise<Response> {
  const { FROM_EMAIL, SENDGRID_API_KEY, TEMPLATE_IDS } = await import("../../_lib/config.ts");
  return json({
    success: true,
    service: "SendGrid",
    from: FROM_EMAIL,
    apiKeyConfigured: !!SENDGRID_API_KEY,
    templates: {
      otp: !!TEMPLATE_IDS.otp,
      estimate: !!TEMPLATE_IDS.estimate,
      invoice: !!TEMPLATE_IDS.invoice,
      proposal: !!TEMPLATE_IDS.proposal,
      welcome: !!TEMPLATE_IDS.welcome,
      resetPassword: !!TEMPLATE_IDS.resetPassword,
      confirm: !!TEMPLATE_IDS.confirm,
      notification: !!TEMPLATE_IDS.notification,
      simple: !!TEMPLATE_IDS.simple,
    },
    status: "operational",
    timestamp: new Date().toISOString(),
  });
}