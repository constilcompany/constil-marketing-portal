// ============================================================
// _lib/sendgrid.ts - Cliente SendGrid central
// ============================================================

import {
  SENDGRID_API_KEY,
  FROM_EMAIL,
  FROM_NAME,
  ENVIRONMENT,
} from "../config.ts";

export interface SendEmailPayload {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: unknown[];
  sandbox?: boolean;
  category?: string;
  type?: string;
  unsubscribeLink?: string;
}

export async function sendEmail(data: SendEmailPayload) {
  if (!SENDGRID_API_KEY) throw new Error("SendGrid API key not configured");

  const htmlContent = data.html || data.text || "<p>Email content</p>";
  const textContent =
    data.text || data.html?.replace(/<[^>]*>/g, "") || "Email content";

  const payload: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: data.to }],
        ...(data.cc && { cc: data.cc.map((e) => ({ email: e })) }),
        ...(data.bcc && { bcc: data.bcc.map((e) => ({ email: e })) }),
      },
    ],
    from: { email: data.from || FROM_EMAIL, name: FROM_NAME },
    subject: data.subject || "Message from Constil",
    content: [
      { type: "text/plain", value: textContent },
      { type: "text/html", value: htmlContent },
    ],
    reply_to: data.replyTo ? { email: data.replyTo } : undefined,
    tracking_settings: {
      click_tracking: { enable: false },
      open_tracking: { enable: false },
      subscription_tracking: { enable: false },
      ganalytics: { enable: false },
    },
    headers: {
      "X-Entity-Ref-ID": `email-${Date.now()}`,
      "List-Unsubscribe": `<${data.unsubscribeLink || "https://constil.com/unsubscribe"}>`,
    },
    categories: ["transactional", data.category || "general"],
    custom_args: {
      type: data.type || "general",
      source: "user-api",
      environment: ENVIRONMENT,
      timestamp: Date.now().toString(),
    },
  };

  if (data.sandbox === true) {
    payload.mail_settings = { sandbox_mode: { enable: true } };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
  }

  return {
    success: true,
    messageId: response.headers.get("x-message-id"),
    statusCode: response.status,
    to: data.to,
    timestamp: new Date().toISOString(),
  };
}

export async function sendTemplateEmail(
  to: string,
  templateId: string,
  data: Record<string, unknown> = {},
  options: { from?: string; sandbox?: boolean; type?: string } = {},
) {
  if (!SENDGRID_API_KEY) throw new Error("SendGrid API key not configured");
  if (!templateId) throw new Error("templateId is required");

  const templateData = {
    ...data,
    unsubscribeLink:
      data.unsubscribeLink || "https://constil.com/unsubscribe",
    year: new Date().getFullYear().toString(),
    companyName: "CONSTIL",
  };

  const payload: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: to }],
        dynamic_template_data: templateData,
      },
    ],
    from: { email: options.from || FROM_EMAIL, name: FROM_NAME },
    template_id: templateId,
    tracking_settings: {
      click_tracking: { enable: false },
      open_tracking: { enable: false },
      subscription_tracking: { enable: false },
      ganalytics: { enable: false },
    },
    headers: {
      "X-Entity-Ref-ID": `${options.type || "template"}-${Date.now()}`,
      "List-Unsubscribe": `<${templateData.unsubscribeLink}>`,
    },
    categories: ["transactional", options.type || "template"],
    custom_args: {
      type: options.type || "template",
      source: "user-api",
      environment: ENVIRONMENT,
      template_id: templateId,
      timestamp: Date.now().toString(),
    },
  };

  if (options.sandbox === true) {
    payload.mail_settings = { sandbox_mode: { enable: true } };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
  }

  return {
    success: true,
    messageId: response.headers.get("x-message-id"),
    statusCode: response.status,
    to,
    templateId,
    timestamp: new Date().toISOString(),
  };
}