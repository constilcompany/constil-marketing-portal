// ============================================================
// USER-API: Serviço de Autenticação + SendGrid Email
// VERSÃO INTEGRADA - COMPATÍVEL COM A TABELA credit_packages
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

// ============================================================
// CONSTANTES E CONFIGURAÇÕES
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

const RATE_LIMITS: Record<string, { max: number; window: number }> = {
  login: { max: 10, window: 300 },
  register: { max: 5, window: 300 },
  "start-free": { max: 3, window: 3600 },
  "create-checkout": { max: 20, window: 300 },
  "verify-payment": { max: 10, window: 300 },
  "consume-credit": { max: 50, window: 60 },
  "template/send-invoice": { max: 30, window: 3600 },
  "template/send-estimate": { max: 30, window: 3600 },
  google: { max: 10, window: 300 },
  "send-signup-otp": { max: 3, window: 300 },
  "forgot-password": { max: 3, window: 300 },
  "verify-otp": { max: 5, window: 300 },
  "reset-password": { max: 3, window: 300 },
  // SendGrid endpoints
  "sendgrid/send": { max: 50, window: 60 },
  "sendgrid/otp": { max: 20, window: 300 },
  "sendgrid/estimate": { max: 30, window: 3600 },
  "sendgrid/invoice": { max: 30, window: 3600 },
  "sendgrid/proposal": { max: 30, window: 3600 },
  "sendgrid/welcome": { max: 20, window: 300 },
  "sendgrid/reset-password": { max: 20, window: 300 },
  "sendgrid/confirm": { max: 20, window: 300 },
  "sendgrid/notification": { max: 30, window: 300 },
  "sendgrid/simple": { max: 30, window: 300 },
  "sendgrid/bulk": { max: 10, window: 300 },
  "sendgrid/send-real": { max: 50, window: 60 },
};

// ============================================================
// SENDGRID CONFIGURATION
// ============================================================

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") || "support@constil.com";
const FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") || "CONSTIL";

const TEMPLATE_IDS = {
  otp: Deno.env.get("SENDGRID_TEMPLATE_OTP") || "",
  estimate: Deno.env.get("SENDGRID_TEMPLATE_ESTIMATE") || "",
  invoice: Deno.env.get("SENDGRID_TEMPLATE_INVOICE") || "",
  proposal: Deno.env.get("SENDGRID_TEMPLATE_PROPOSAL") || "",
  welcome: Deno.env.get("SENDGRID_TEMPLATE_WELCOME") || "",
  resetPassword: Deno.env.get("SENDGRID_TEMPLATE_RESET_PASSWORD") || "",
  confirm: Deno.env.get("SENDGRID_TEMPLATE_CONFIRM") || "",
  notification: Deno.env.get("SENDGRID_TEMPLATE_NOTIFICATION") || "",
  simple: Deno.env.get("SENDGRID_SEND_SIMPLE") || "",
};

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      "Content-Type": "application/json",
    },
  });

function sanitize(input: unknown, maxLength = 500): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>'"]/g, "")
    .trim()
    .substring(0, maxLength);
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id || "",
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") && email.length <= 255;
}

function safeError(message: string, status = 500) {
  const safeMessages: Record<number, string> = {
    400: "Invalid request",
    401: "Unauthorized",
    402: "Payment required",
    403: "Forbidden",
    404: "Not found",
    409: "Conflict",
    429: "Too many requests. Please try again later.",
    500: "Something went wrong",
  };
  return json({ error: safeMessages[status] || message }, status);
}

async function checkRateLimit(
  serviceClient: any,
  identifier: string,
  endpoint: string,
  maxRequests = 60,
  windowSeconds = 60,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { data } = await serviceClient
    .from("rate_limits")
    .select("request_count")
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .gte("window_start", windowStart)
    .single();

  if (data && data.request_count >= maxRequests) {
    return false;
  }

  if (data) {
    await serviceClient
      .from("rate_limits")
      .update({ request_count: data.request_count + 1 })
      .eq("identifier", identifier)
      .eq("endpoint", endpoint)
      .gte("window_start", windowStart);
  } else {
    await serviceClient.from("rate_limits").insert({
      identifier,
      endpoint,
      request_count: 1,
      window_start: new Date().toISOString(),
    });
  }

  return true;
}

async function cleanupRateLimits(serviceClient: any) {
  const cutoff = new Date(Date.now() - 300_000).toISOString();
  await serviceClient.from("rate_limits").delete().lt("window_start", cutoff);
}

function getStripe() {
  return new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-11-20.acacia",
  });
}

// ============================================================
// SENDGRID FUNCTIONS
// ============================================================

/**
 * Send a simple email via SendGrid API
 */
async function sendEmail(data: {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: any[];
  sandbox?: boolean;
  category?: string;
  type?: string;
  unsubscribeLink?: string;
}) {
  if (!SENDGRID_API_KEY) {
    throw new Error("SendGrid API key not configured");
  }

  const htmlContent = data.html || data.text || "<p>Email content</p>";
  const textContent = data.text || data.html?.replace(/<[^>]*>/g, "") || "Email content";

  const payload = {
    personalizations: [
      {
        to: [{ email: data.to }],
        ...(data.cc && { cc: data.cc.map((email: string) => ({ email })) }),
        ...(data.bcc && { bcc: data.bcc.map((email: string) => ({ email })) }),
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
      environment: Deno.env.get("ENVIRONMENT") || "production",
      timestamp: Date.now().toString(),
    },
  };

  if (data.sandbox === true) {
    (payload as any).mail_settings = { sandbox_mode: { enable: true } };
    console.log("⚠️ SANDBOX mode enabled");
  }

  console.log(`📤 Sending email to: ${data.to}`);
  console.log(`📋 Subject: ${data.subject || "Message from Constil"}`);

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
    console.error("❌ SendGrid Error:", errorText);
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

/**
 * Send email using dynamic template
 */
async function sendTemplateEmail(
  to: string,
  templateId: string,
  data: Record<string, any> = {},
  options: { from?: string; sandbox?: boolean; type?: string } = {},
) {
  if (!SENDGRID_API_KEY) {
    throw new Error("SendGrid API key not configured");
  }

  if (!templateId) {
    throw new Error("❌ templateId is required");
  }

  const templateData = {
    ...data,
    unsubscribeLink: data.unsubscribeLink || "https://constil.com/unsubscribe",
    year: new Date().getFullYear().toString(),
    companyName: "CONSTIL",
  };

  const payload = {
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
      environment: Deno.env.get("ENVIRONMENT") || "production",
      template_id: templateId,
      timestamp: Date.now().toString(),
    },
  };

  if (options.sandbox === true) {
    (payload as any).mail_settings = { sandbox_mode: { enable: true } };
    console.log("⚠️ SANDBOX mode enabled");
  }

  console.log(`📤 Sending template ${templateId} to: ${to}`);

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
    console.error("❌ SendGrid Error:", errorText);
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
  }

  return {
    success: true,
    messageId: response.headers.get("x-message-id"),
    statusCode: response.status,
    to: to,
    templateId: templateId,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// SENDGRID UTILITY FUNCTIONS
// ============================================================

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateReference(prefix: string): string {
  const year = new Date().getFullYear();
  const id = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${prefix}-${year}-${id}`;
}

function generateId(): number {
  return Math.floor(Math.random() * 1000);
}

function formatDate(daysToAdd: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ============================================================
// SENDGRID TEMPLATE METHODS
// ============================================================

async function sendOtpEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.otp;
  if (!templateId) throw new Error("❌ OTP template not configured");
  const subject = data.subject || "🔐 Your verification code - CONSTIL";
  return sendTemplateEmail(
    to,
    templateId,
    { subject, code: data.code || generateCode(), validity: data.validity || "5", name: data.name || "User", ...data },
    { ...options, type: "otp" }
  );
}

async function sendEstimateEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.estimate;
  if (!templateId) throw new Error("❌ ESTIMATE template not configured");
  const subject = data.subject || `📄 Estimate #${data.reference || generateReference("EST")} - CONSTIL`;
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      name: data.name || "John Smith",
      reference: data.reference || generateReference("EST"),
      date: data.date || formatDate(),
      total: data.total || "12,450.00",
      downloadLink: data.downloadLink || `https://app.constil.com/documents/estimate/${generateId()}`,
      ...data,
    },
    { ...options, type: "estimate" }
  );
}

async function sendInvoiceEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.invoice;
  if (!templateId) throw new Error("❌ INVOICE template not configured");
  const subject = data.subject || `🧾 Invoice #${data.invoiceNo || generateReference("INV")} - CONSTIL`;
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      name: data.name || "John Smith",
      invoiceNo: data.invoiceNo || generateReference("INV"),
      issueDate: data.issueDate || formatDate(),
      dueDate: data.dueDate || formatDate(14),
      amount: data.amount || "8,750.00",
      downloadLink: data.downloadLink || `https://app.constil.com/documents/invoice/${generateId()}`,
      ...data,
    },
    { ...options, type: "invoice" }
  );
}

async function sendProposalEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.proposal;
  if (!templateId) throw new Error("❌ PROPOSAL template not configured");
  const subject = data.subject || `📝 Proposal #${data.reference || generateReference("PROP")} - CONSTIL`;
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      name: data.name || "John Smith",
      reference: data.reference || generateReference("PROP"),
      date: data.date || formatDate(),
      downloadLink: data.downloadLink || `https://app.constil.com/documents/proposal/${generateId()}`,
      ...data,
    },
    { ...options, type: "proposal" }
  );
}

async function sendWelcomeEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.welcome;
  if (!templateId) throw new Error("❌ WELCOME template not configured");
  const subject = data.subject || `👋 Welcome to CONSTIL, ${data.name || "User"}!`;
  return sendTemplateEmail(
    to,
    templateId,
    { subject, name: data.name || "User", company: data.company || "", role: data.role || "", ...data },
    { ...options, type: "welcome" }
  );
}

async function sendResetPasswordEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.resetPassword;
  if (!templateId) throw new Error("❌ RESET_PASSWORD template not configured");
  const subject = data.subject || "🔐 Reset your password - CONSTIL";
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      name: data.name || "User",
      code: data.code || generateCode(),
      link: data.link || "https://constil.com/reset-password",
      validity: data.validity || "15",
      ...data,
    },
    { ...options, type: "reset-password" }
  );
}

async function sendConfirmEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.confirm;
  if (!templateId) throw new Error("❌ CONFIRM template not configured");
  const subject = data.subject || "✅ Confirm your email - CONSTIL";
  return sendTemplateEmail(
    to,
    templateId,
    { subject, name: data.name || "User", link: data.link || `https://constil.com/confirm/${generateToken()}`, ...data },
    { ...options, type: "confirm" }
  );
}

async function sendNotificationEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.notification;
  if (!templateId) throw new Error("❌ NOTIFICATION template not configured");
  const subject = data.subject || `🔔 ${data.title || "New notification"} - CONSTIL`;
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      title: data.title || "New notification",
      message: data.message || "You have a new notification.",
      name: data.name || "User",
      details: data.details || "",
      buttonText: data.buttonText || "",
      buttonLink: data.buttonLink || "",
      footerMessage: data.footerMessage || "",
      ...data,
    },
    { ...options, type: "notification" }
  );
}

async function sendSimpleTemplateEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.simple;
  if (!templateId) throw new Error("❌ SIMPLE template not configured");
  const subject = data.subject || "📧 Message from CONSTIL";
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      name: data.name || "User",
      message: data.message || "This is a message from CONSTIL.",
      additionalHtml: data.additionalHtml || "",
      buttonText: data.buttonText || "",
      buttonLink: data.buttonLink || "",
      footerMessage: data.footerMessage || "",
      ...data,
    },
    { ...options, type: "simple" }
  );
}

async function sendMultipleEmails(emails: any[], options: any = {}) {
  const results = { total: emails.length, sent: 0, failed: 0, details: [] as any[] };

  const promises = emails.map(async (email) => {
    try {
      const result = await sendEmail({ ...email, ...options });
      results.sent++;
      results.details.push({ ...result, status: "sent" });
    } catch (error: any) {
      results.failed++;
      results.details.push({ to: email.to, status: "failed", error: error.message });
    }
  });

  await Promise.allSettled(promises);
  return results;
}

// ============================================================
// FUNÇÃO PRINCIPAL | MAIN FUNCTION
// ============================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/user-api(-test)?\/?/, "");
  const path = rawPath;

  console.log("📍 PATH:", path);
  console.log("📍 METHOD:", req.method);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    cleanupRateLimits(serviceClient).catch(() => {});

    // ============================================================
    // PUBLIC ENDPOINTS
    // ============================================================

    // ... (todos os endpoints públicos do seu código original aqui)
    // GET /packages, POST /register, POST /login, etc.

    // ============================================================
    // SENDGRID ENDPOINTS (PUBLICOS E AUTENTICADOS)
    // ============================================================

    // === GET /sendgrid/health ===
    if (req.method === "GET" && path === "sendgrid/health") {
      return json({
        status: "healthy",
        service: "sendgrid-integrated",
        timestamp: new Date().toISOString(),
      });
    }

    // === GET /sendgrid/status ===
    if (req.method === "GET" && path === "sendgrid/status") {
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
        environment: Deno.env.get("ENVIRONMENT") || "development",
        status: "operational",
        timestamp: new Date().toISOString(),
      });
    }

    // === POST /sendgrid/send - Simple email ===
    if (req.method === "POST" && path === "sendgrid/send") {
      const { to, subject, text, html, cc, bcc, replyTo, attachments, sandbox } = await req.json();

      if (!to) {
        return json({ success: false, error: '"to" field is required' }, 400);
      }

      if (!text && !html) {
        return json({ success: false, error: "At least one of 'text' or 'html' is required" }, 400);
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

        return json({ success: true, message: "✅ Email sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/send-real - Force real email ===
    if (req.method === "POST" && path === "sendgrid/send-real") {
      const { to, subject, text, html, cc, bcc, replyTo, attachments } = await req.json();

      if (!to) {
        return json({ success: false, error: '"to" field is required' }, 400);
      }

      if (!text && !html) {
        return json({ success: false, error: "At least one of 'text' or 'html' is required" }, 400);
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
        });

        return json({ success: true, message: "✅ Real email sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/otp - Send OTP ===
    if (req.method === "POST" && path === "sendgrid/otp") {
      const { to, code, validity, name, sandbox } = await req.json();

      if (!to) {
        return json({ success: false, error: '"to" field is required' }, 400);
      }

      try {
        const result = await sendOtpEmail(
          to,
          { code: code || generateCode(), validity: validity || "5", name: name || "User" },
          { sandbox: sandbox || false }
        );

        return json({ success: true, message: "✅ OTP sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/estimate - Send estimate ===
    if (req.method === "POST" && path === "sendgrid/estimate") {
      const { to, name, reference, date, total, downloadLink, sandbox } = await req.json();

      if (!to) {
        return json({ success: false, error: '"to" field is required' }, 400);
      }

      try {
        const result = await sendEstimateEmail(
          to,
          {
            name: name || "John Smith",
            reference: reference || generateReference("EST"),
            date: date || formatDate(),
            total: total || "12,450.00",
            downloadLink: downloadLink || `https://app.constil.com/documents/estimate/${generateId()}`,
          },
          { sandbox: sandbox || false }
        );

        return json({ success: true, message: "✅ Estimate sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/invoice - Send invoice ===
    if (req.method === "POST" && path === "sendgrid/invoice") {
      const { to, name, invoiceNo, issueDate, dueDate, amount, downloadLink, sandbox } = await req.json();

      if (!to) {
        return json({ success: false, error: '"to" field is required' }, 400);
      }

      try {
        const result = await sendInvoiceEmail(
          to,
          {
            name: name || "John Smith",
            invoiceNo: invoiceNo || generateReference("INV"),
            issueDate: issueDate || formatDate(),
            dueDate: dueDate || formatDate(14),
            amount: amount || "8,750.00",
            downloadLink: downloadLink || `https://app.constil.com/documents/invoice/${generateId()}`,
          },
          { sandbox: sandbox || false }
        );

        return json({ success: true, message: "✅ Invoice sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/proposal - Send proposal ===
    if (req.method === "POST" && path === "sendgrid/proposal") {
      const { to, name, reference, date, downloadLink, sandbox } = await req.json();

      if (!to) {
        return json({ success: false, error: '"to" field is required' }, 400);
      }

      try {
        const result = await sendProposalEmail(
          to,
          {
            name: name || "John Smith",
            reference: reference || generateReference("PROP"),
            date: date || formatDate(),
            downloadLink: downloadLink || `https://app.constil.com/documents/proposal/${generateId()}`,
          },
          { sandbox: sandbox || false }
        );

        return json({ success: true, message: "✅ Proposal sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/welcome - Send welcome ===
    if (req.method === "POST" && path === "sendgrid/welcome") {
      const { to, name, company, role, sandbox } = await req.json();

      if (!to || !name) {
        return json({ success: false, error: '"to" and "name" fields are required' }, 400);
      }

      try {
        const result = await sendWelcomeEmail(
          to,
          { name, company: company || "", role: role || "" },
          { sandbox: sandbox || false }
        );

        return json({ success: true, message: "✅ Welcome email sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/reset-password - Send password reset ===
    if (req.method === "POST" && path === "sendgrid/reset-password") {
      const { to, name, code, link, validity, sandbox } = await req.json();

      if (!to || !name || !code) {
        return json({ success: false, error: '"to", "name" and "code" fields are required' }, 400);
      }

      try {
        const result = await sendResetPasswordEmail(
          to,
          { name, code, link: link || "https://constil.com/reset-password", validity: validity || "15" },
          { sandbox: sandbox || false }
        );

        return json({ success: true, message: "✅ Password reset email sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/confirm - Send confirmation ===
    if (req.method === "POST" && path === "sendgrid/confirm") {
      const { to, name, link, sandbox } = await req.json();

      if (!to || !name) {
        return json({ success: false, error: '"to" and "name" fields are required' }, 400);
      }

      try {
        const result = await sendConfirmEmail(
          to,
          { name, link: link || `https://constil.com/confirm/${generateToken()}` },
          { sandbox: sandbox || false }
        );

        return json({ success: true, message: "✅ Confirmation email sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/notification - Send notification ===
    if (req.method === "POST" && path === "sendgrid/notification") {
      const { to, title, message, name, details, buttonText, buttonLink, footerMessage, sandbox } = await req.json();

      if (!to || !title || !message) {
        return json({ success: false, error: '"to", "title" and "message" fields are required' }, 400);
      }

      try {
        const result = await sendNotificationEmail(
          to,
          {
            title,
            message,
            name: name || "User",
            details: details || "",
            buttonText: buttonText || "",
            buttonLink: buttonLink || "",
            footerMessage: footerMessage || "",
          },
          { sandbox: sandbox || false }
        );

        return json({ success: true, message: "✅ Notification sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/simple - Send simple template ===
    if (req.method === "POST" && path === "sendgrid/simple") {
      const { to, subject, name, message, buttonText, buttonLink, footerMessage, additionalHtml, sandbox } = await req.json();

      if (!to || !message) {
        return json({ success: false, error: '"to" and "message" fields are required' }, 400);
      }

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
          { sandbox: sandbox || false }
        );

        return json({ success: true, message: "✅ Simple template sent successfully!", data: result });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/bulk - Send multiple emails ===
    if (req.method === "POST" && path === "sendgrid/bulk") {
      const { emails, sandbox } = await req.json();

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return json({ success: false, error: "Invalid email list. Please send an array with at least one email." }, 400);
      }

      try {
        const result = await sendMultipleEmails(emails, { sandbox: sandbox || false });

        return json({
          success: true,
          message: `✅ ${result.sent} emails sent, ${result.failed} failed`,
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // AUTHENTICATED SENDGRID ENDPOINTS (requerem autenticação)
    // ============================================================

    // ... (restante do seu código existente para endpoints autenticados)

    return json({ error: "Route not found", path }, 404);
  } catch (err) {
    console.error("[USER-API] Error:", (err as Error).message);
    return safeError("Something went wrong", 500);
  }
});