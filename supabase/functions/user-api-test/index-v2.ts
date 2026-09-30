/**
 * USER-API: Serviço de Autenticação + SendGrid Email (Centralizado)
 * VERSÃO INTEGRADA - COMPATÍVEL COM A TABELA credit_packages
 *
 * @module user-api
 * @description Serviço completo de autenticação, gerenciamento de usuários e envio de emails
 * @version 4.0.0
 */

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
// SENDGRID CONFIGURATION (CENTRALIZADO)
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

function isValidPhone(phone: string): boolean {
  if (!phone) return true;
  return /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s/g, ""));
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
// SENDGRID SERVICE (CENTRALIZADO)
// ============================================================

/**
 * Send a simple email via SendGrid API
 * Envia um email simples via API do SendGrid
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
  const textContent =
    data.text || data.html?.replace(/<[^>]*>/g, "") || "Email content";

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
 * Envia email usando template dinâmico
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
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
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
    {
      subject,
      code: data.code || generateCode(),
      validity: data.validity || "5",
      name: data.name || "User",
      ...data,
    },
    { ...options, type: "otp" },
  );
}

async function sendEstimateEmail(
  to: string,
  data: any = {},
  options: any = {},
) {
  const templateId = TEMPLATE_IDS.estimate;
  if (!templateId) throw new Error("❌ ESTIMATE template not configured");
  const subject =
    data.subject ||
    `📄 Estimate #${data.reference || generateReference("EST")} - CONSTIL`;
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      name: data.name || "John Smith",
      reference: data.reference || generateReference("EST"),
      date: data.date || formatDate(),
      total: data.total || "12,450.00",
      downloadLink:
        data.downloadLink ||
        `https://app.constil.com/documents/estimate/${generateId()}`,
      ...data,
    },
    { ...options, type: "estimate" },
  );
}

async function sendInvoiceEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.invoice;
  if (!templateId) throw new Error("❌ INVOICE template not configured");
  const subject =
    data.subject ||
    `🧾 Invoice #${data.invoiceNo || generateReference("INV")} - CONSTIL`;
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
      downloadLink:
        data.downloadLink ||
        `https://app.constil.com/documents/invoice/${generateId()}`,
      ...data,
    },
    { ...options, type: "invoice" },
  );
}

async function sendProposalEmail(
  to: string,
  data: any = {},
  options: any = {},
) {
  const templateId = TEMPLATE_IDS.proposal;
  if (!templateId) throw new Error("❌ PROPOSAL template not configured");
  const subject =
    data.subject ||
    `📝 Proposal #${data.reference || generateReference("PROP")} - CONSTIL`;
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      name: data.name || "John Smith",
      reference: data.reference || generateReference("PROP"),
      date: data.date || formatDate(),
      downloadLink:
        data.downloadLink ||
        `https://app.constil.com/documents/proposal/${generateId()}`,
      ...data,
    },
    { ...options, type: "proposal" },
  );
}

async function sendWelcomeEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.welcome;
  if (!templateId) throw new Error("❌ WELCOME template not configured");
  const subject =
    data.subject || `👋 Welcome to CONSTIL, ${data.name || "User"}!`;
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      name: data.name || "User",
      company: data.company || "",
      role: data.role || "",
      ...data,
    },
    { ...options, type: "welcome" },
  );
}

async function sendResetPasswordEmail(
  to: string,
  data: any = {},
  options: any = {},
) {
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
    { ...options, type: "reset-password" },
  );
}

async function sendConfirmEmail(to: string, data: any = {}, options: any = {}) {
  const templateId = TEMPLATE_IDS.confirm;
  if (!templateId) throw new Error("❌ CONFIRM template not configured");
  const subject = data.subject || "✅ Confirm your email - CONSTIL";
  return sendTemplateEmail(
    to,
    templateId,
    {
      subject,
      name: data.name || "User",
      link: data.link || `https://constil.com/confirm/${generateToken()}`,
      ...data,
    },
    { ...options, type: "confirm" },
  );
}

async function sendNotificationEmail(
  to: string,
  data: any = {},
  options: any = {},
) {
  const templateId = TEMPLATE_IDS.notification;
  if (!templateId) throw new Error("❌ NOTIFICATION template not configured");
  const subject =
    data.subject || `🔔 ${data.title || "New notification"} - CONSTIL`;
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
    { ...options, type: "notification" },
  );
}

async function sendSimpleTemplateEmail(
  to: string,
  data: any = {},
  options: any = {},
) {
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
    { ...options, type: "simple" },
  );
}

async function sendMultipleEmails(emails: any[], options: any = {}) {
  const results = {
    total: emails.length,
    sent: 0,
    failed: 0,
    details: [] as any[],
  };

  const promises = emails.map(async (email) => {
    try {
      const result = await sendEmail({ ...email, ...options });
      results.sent++;
      results.details.push({ ...result, status: "sent" });
    } catch (error: any) {
      results.failed++;
      results.details.push({
        to: email.to,
        status: "failed",
        error: error.message,
      });
    }
  });

  await Promise.allSettled(promises);
  return results;
}

// ============================================================
// FUNÇÕES AUXILIARES - PACOTES E PAGAMENTOS
// ============================================================

async function resolveDiscount(
  serviceClient: any,
  userId: string,
  couponCode?: string,
) {
  let discountPercent = 0;
  let couponId: string | null = null;
  let couponCodeResolved: string | null = null;
  let influencerId: string | null = null;
  let managerId: string | null = null;

  if (couponCode) {
    const sanitizedCode = sanitize(couponCode, 50).toUpperCase();
    if (!sanitizedCode) {
      return {
        discountPercent,
        couponId,
        couponCodeResolved,
        influencerId,
        managerId,
      };
    }

    const { data: coupon } = await serviceClient
      .from("coupons")
      .select("*, profiles!coupons_influencer_id_fkey(user_id, full_name)")
      .eq("code", sanitizedCode)
      .eq("is_active", true)
      .single();

    if (coupon) {
      const withinLimit =
        !coupon.usage_limit || coupon.usage_count < coupon.usage_limit;
      const notExpired =
        !coupon.expiry_date || new Date(coupon.expiry_date) > new Date();
      if (withinLimit && notExpired) {
        discountPercent = Number(coupon.discount_percent);
        couponId = coupon.id;
        couponCodeResolved = coupon.code;
        influencerId = coupon.influencer_id;
        if (coupon.influencer_id) {
          const { data: link } = await serviceClient
            .from("manager_influencers")
            .select("manager_id")
            .eq("influencer_id", coupon.influencer_id)
            .single();
          managerId = link?.manager_id ?? null;
        }
      }
    }
  }

  return {
    discountPercent,
    couponId,
    couponCodeResolved,
    influencerId,
    managerId,
  };
}

function calculatePricing(price: number, discountPercent: number) {
  const originalPrice = Number(price);
  const discountAmount =
    Math.round(((originalPrice * discountPercent) / 100) * 100) / 100;
  const finalPrice = Math.max(
    0,
    Math.round((originalPrice - discountAmount) * 100) / 100,
  );
  return { originalPrice, discountAmount, finalPrice };
}

async function processSuccessfulPayment(serviceClient: any, txn: any) {
  const txnUserId = txn.user_id;

  const { data: pkg } = await serviceClient
    .from("credit_packages")
    .select("*")
    .eq("id", txn.package_id)
    .single();
  if (!pkg) throw new Error("Package not found");

  if (txn.coupon_id) {
    const { data: coupon } = await serviceClient
      .from("coupons")
      .select("usage_count")
      .eq("id", txn.coupon_id)
      .single();
    if (coupon) {
      await serviceClient
        .from("coupons")
        .update({ usage_count: coupon.usage_count + 1 })
        .eq("id", txn.coupon_id);
    }
  }

  if (txn.influencer_id) {
    const { data: existingAttr } = await serviceClient
      .from("user_attributions")
      .select("id")
      .eq("user_id", txnUserId)
      .single();
    if (!existingAttr) {
      await serviceClient.from("user_attributions").insert({
        user_id: txnUserId,
        influencer_id: txn.influencer_id,
        coupon_id: txn.coupon_id,
      });
    }
  }

  if (pkg.billing_type === "subscription") {
    const interval = txn.billing_type === "yearly" ? 365 : 30;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + interval);

    const { data: existingSub } = await serviceClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", txnUserId)
      .eq("is_active", true)
      .single();

    if (existingSub) {
      const currentExpiry = new Date(existingSub.expiry_date);
      const newExpiry =
        currentExpiry > new Date()
          ? new Date(currentExpiry.getTime() + interval * 86400000)
          : expiryDate;
      await serviceClient
        .from("subscriptions")
        .update({
          package_id: pkg.id,
          billing_type: txn.billing_type,
          expiry_date: newExpiry.toISOString(),
          template_tier: pkg.template_tier,
        })
        .eq("id", existingSub.id);
    } else {
      await serviceClient.from("subscriptions").insert({
        user_id: txnUserId,
        package_id: pkg.id,
        billing_type: txn.billing_type,
        expiry_date: expiryDate.toISOString(),
        template_tier: pkg.template_tier,
      });
    }
  }

  const { data: wallet } = await serviceClient
    .from("user_credit_wallets")
    .select("*")
    .eq("user_id", txnUserId)
    .single();

  if (wallet) {
    await serviceClient
      .from("user_credit_wallets")
      .update({
        invoice_remaining:
          wallet.invoice_remaining + (pkg.invoice_credits || 0),
        estimate_remaining:
          wallet.estimate_remaining + (pkg.estimate_credits || 0),
        ai_estimate_remaining:
          wallet.ai_estimate_remaining + (pkg.ai_estimate_credits || 0),
        invoice_unlimited: pkg.invoice_unlimited || wallet.invoice_unlimited,
        estimate_unlimited: pkg.estimate_unlimited || wallet.estimate_unlimited,
        ai_estimate_unlimited:
          pkg.ai_estimate_unlimited || wallet.ai_estimate_unlimited,
      })
      .eq("user_id", txnUserId);
  } else {
    await serviceClient.from("user_credit_wallets").insert({
      user_id: txnUserId,
      invoice_remaining: pkg.invoice_credits || 0,
      estimate_remaining: pkg.estimate_credits || 0,
      ai_estimate_remaining: pkg.ai_estimate_credits || 0,
      invoice_unlimited: pkg.invoice_unlimited || false,
      estimate_unlimited: pkg.estimate_unlimited || false,
      ai_estimate_unlimited: pkg.ai_estimate_unlimited || false,
    });
  }

  const totalCredits =
    (pkg.invoice_credits || 0) +
    (pkg.estimate_credits || 0) +
    (pkg.ai_estimate_credits || 0) +
    (pkg.credit_amount || 0);
  const { data: currentCredits } = await serviceClient
    .from("user_credits")
    .select("balance")
    .eq("user_id", txnUserId)
    .single();
  await serviceClient
    .from("user_credits")
    .update({ balance: (currentCredits?.balance ?? 0) + totalCredits })
    .eq("user_id", txnUserId);

  const { data: sale } = await serviceClient
    .from("sales")
    .insert({
      total_amount: txn.original_price || pkg.price,
      discount_amount: txn.discount_amount || 0,
      final_amount: txn.amount,
      coupon_id: txn.coupon_id || null,
      customer_user_id: txnUserId,
    })
    .select()
    .single();

  await serviceClient.from("credit_transactions").insert({
    user_id: txnUserId,
    package_id: pkg.id,
    transaction_type: "purchase",
    credits_change: totalCredits,
    amount_paid: txn.amount,
    discount_applied: txn.discount_amount || 0,
    coupon_id: txn.coupon_id || null,
  });

  if (sale && txn.influencer_id) {
    const { data: settings } = await serviceClient
      .from("global_settings")
      .select("*")
      .single();

    if (settings) {
      const { data: existingCommission } = await serviceClient
        .from("commissions")
        .select("id")
        .eq("sale_id", sale.id)
        .single();

      if (!existingCommission) {
        const finalPaid = Number(txn.amount);
        const inflPercent = Number(settings.influencer_commission_percent);
        const mgrPercent = Number(settings.manager_commission_percent);
        const influencerAmount =
          Math.round(((finalPaid * inflPercent) / 100) * 100) / 100;
        const managerAmount = txn.manager_id
          ? Math.round(((finalPaid * mgrPercent) / 100) * 100) / 100
          : 0;
        const unlockDate = new Date();
        unlockDate.setDate(unlockDate.getDate() + settings.lock_period_days);

        await serviceClient.from("commissions").insert({
          sale_id: sale.id,
          influencer_id: txn.influencer_id,
          manager_id: txn.manager_id || null,
          influencer_amount: influencerAmount,
          manager_amount: managerAmount,
          status: "locked",
          unlock_date: unlockDate.toISOString(),
        });
      }
    }
  }

  return { totalCredits, packageName: pkg.name };
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
  const path = rawPath.replace(/^auth\//, "");

  console.log("📍 PATH:", path);
  console.log("📍 METHOD:", req.method);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    cleanupRateLimits(serviceClient).catch(() => {});

    // ============================================================
    // ENDPOINTS PÚBLICOS (SEM ENVIO DE EMAIL DIRETO)
    // ============================================================

    // === GET /packages ===
    if (req.method === "GET" && path === "packages") {
      const { data, error } = await serviceClient
        .from("credit_packages")
        .select(
          "id, name, credit_amount, price, billing_type, " +
            "billing_interval, template_tier, invoice_credits, estimate_credits, " +
            "ai_estimate_credits, invoice_unlimited, estimate_unlimited, " +
            "ai_estimate_unlimited, is_active, trial_enabled, trial_days, " +
            "trial_invoice_credits, trial_estimate_credits, trial_ai_estimate_credits, " +
            "duration_days, created_at, updated_at",
        )
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) {
        console.error("❌ Erro no banco:", error);
        return safeError("Failed to fetch packages", 500);
      }

      return json({
        packages: data || [],
        total: data?.length || 0,
      });
    }

    // === POST /register ===
    if (req.method === "POST" && path === "register") {
      // ... (mesmo código, SEM envio de email)
      // O email de boas-vindas deve ser enviado via endpoint /sendgrid/welcome
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const email = sanitize(body.email, 255).toLowerCase();
      const password = body.password;
      const full_name = sanitize(body.full_name, 100);
      // ... resto das validações

      // Criar usuário (sem enviar email)
      const { data: newUser, error: createErr } =
        await serviceClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });

      if (createErr) {
        console.error("Registration error:", createErr);
        return json({ error: "Registration failed" }, 400);
      }

      const userId = newUser.user.id;

      // Criar perfil
      await serviceClient.from("profiles").insert({
        user_id: userId,
        email: email,
        full_name: full_name,
        email_verified: true,
      });

      // Registrar no audit log
      await serviceClient.from("audit_logs").insert({
        user_id: userId,
        action: "user_registered",
        ip_address:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown",
        user_agent: req.headers.get("user-agent") || "",
        metadata: { email },
      });

      return json({
        success: true,
        user: { id: userId, email },
        message: "Account created successfully",
        // ❌ NÃO ENVIA EMAIL AQUI - Use /sendgrid/welcome
      });
    }

    // === POST /login ===
    if (req.method === "POST" && path === "login") {
      // ... (login SEM envio de email)
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const email = sanitize(body.email, 255).toLowerCase();
      const password = body.password;

      if (!email || !password) {
        return json({ error: "Missing credentials" }, 400);
      }

      const { data, error } = await serviceClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return json({ error: "Invalid credentials" }, 401);
      }

      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          email_verified: true,
          phone_verified: false,
        },
      });
    }

    // === POST /send-signup-otp ===
    if (req.method === "POST" && path === "send-signup-otp") {
      // ❌ REMOVIDO - Use /sendgrid/otp para envio de OTP
      return json(
        {
          success: false,
          error: "This endpoint is deprecated. Use /sendgrid/otp instead.",
          redirect: "/sendgrid/otp",
        },
        410,
      );
    }

    // === POST /forgot-password ===
    if (req.method === "POST" && path === "forgot-password") {
      // ❌ REMOVIDO - Use /sendgrid/reset-password para envio de reset
      return json(
        {
          success: false,
          error:
            "This endpoint is deprecated. Use /sendgrid/reset-password instead.",
          redirect: "/sendgrid/reset-password",
        },
        410,
      );
    }

    // === POST /verify-otp ===
    if (req.method === "POST" && path === "verify-otp") {
      // ... (verificação SEM envio de email)
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const email = sanitize(body.email, 255).toLowerCase();
      const otpCode = sanitize(body.otp, 10);

      if (!email || !otpCode) {
        return json({ error: "Email and OTP are required" }, 400);
      }

      const { data: otpRecord } = await serviceClient
        .from("password_reset_otps")
        .select("*")
        .eq("email", email)
        .eq("otp_code", otpCode)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!otpRecord) {
        return json({ error: "Invalid or expired code" }, 400);
      }

      await serviceClient
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

      if (otpRecord.purpose === "signup") {
        await serviceClient
          .from("profiles")
          .update({ email_verified: true })
          .eq("email", email);
      }

      return json({
        success: true,
        message: "OTP verified",
        purpose: otpRecord.purpose || "generic",
      });
    }

    // === POST /reset-password ===
    if (req.method === "POST" && path === "reset-password") {
      // ... (reset SEM envio de email)
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const email = sanitize(body.email, 255).toLowerCase();
      const otpCode = sanitize(body.otp, 10);
      const password = body.password;

      if (!email || !otpCode || !password) {
        return json({ error: "Email, OTP and password are required" }, 400);
      }

      const { data: otpRecord } = await serviceClient
        .from("password_reset_otps")
        .select("*")
        .eq("email", email)
        .eq("otp_code", otpCode)
        .eq("used", false)
        .eq("purpose", "password_reset")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!otpRecord) {
        return json({ error: "Invalid or expired code" }, 400);
      }

      await serviceClient
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

      const { data: users } = await serviceClient.auth.admin.listUsers();
      const targetUser = users?.users?.find(
        (u: any) => u.email?.toLowerCase() === email,
      );
      if (!targetUser) {
        return json({ error: "User not found" }, 404);
      }

      const { error } = await serviceClient.auth.admin.updateUserById(
        targetUser.id,
        { password },
      );
      if (error) {
        return json({ error: "Failed to update password" }, 400);
      }

      return json({ success: true, message: "Password updated successfully" });
    }

    // === POST /google ===
    if (
      req.method === "POST" &&
      (path === "google" || path === "auth/google")
    ) {
      // ... (google SEM envio de email)
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const idToken = body.id_token;
      if (!idToken) {
        return json({ error: "Google id_token is required" }, 400);
      }

      const { data, error } = await serviceClient.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        return json({ error: "Google sign-in failed" }, 401);
      }

      const userId = data.user.id;
      const isNewUser = data.user.created_at === data.user.updated_at;

      if (isNewUser) {
        await serviceClient.from("profiles").upsert(
          {
            user_id: userId,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || "",
            email_verified: true,
          },
          { onConflict: "user_id" },
        );
      }

      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: { id: userId, email: data.user.email },
        is_new_user: isNewUser,
      });
    }

    // ============================================================
    // SENDGRID ENDPOINTS (GESTÃO DE EMAIL CENTRALIZADA)
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

    // === POST /sendgrid/send ===
    if (req.method === "POST" && path === "sendgrid/send") {
      const {
        to,
        subject,
        text,
        html,
        cc,
        bcc,
        replyTo,
        attachments,
        sandbox,
      } = await req.json();

      if (!to) {
        return json({ success: false, error: '"to" field is required' }, 400);
      }

      if (!text && !html) {
        return json(
          {
            success: false,
            error: "At least one of 'text' or 'html' is required",
          },
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

        return json({
          success: true,
          message: "✅ Email sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/send-real ===
    if (req.method === "POST" && path === "sendgrid/send-real") {
      const { to, subject, text, html, cc, bcc, replyTo, attachments } =
        await req.json();

      if (!to) {
        return json({ success: false, error: '"to" field is required' }, 400);
      }

      if (!text && !html) {
        return json(
          {
            success: false,
            error: "At least one of 'text' or 'html' is required",
          },
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
        });

        return json({
          success: true,
          message: "✅ Real email sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/otp ===
    if (req.method === "POST" && path === "sendgrid/otp") {
      const { to, code, validity, name, sandbox } = await req.json();

      if (!to) {
        return json({ success: false, error: '"to" field is required' }, 400);
      }

      try {
        const result = await sendOtpEmail(
          to,
          {
            code: code || generateCode(),
            validity: validity || "5",
            name: name || "User",
          },
          { sandbox: sandbox || false },
        );

        return json({
          success: true,
          message: "✅ OTP sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/estimate ===
    if (req.method === "POST" && path === "sendgrid/estimate") {
      const { to, name, reference, date, total, downloadLink, sandbox } =
        await req.json();

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
            downloadLink:
              downloadLink ||
              `https://app.constil.com/documents/estimate/${generateId()}`,
          },
          { sandbox: sandbox || false },
        );

        return json({
          success: true,
          message: "✅ Estimate sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/invoice ===
    if (req.method === "POST" && path === "sendgrid/invoice") {
      const {
        to,
        name,
        invoiceNo,
        issueDate,
        dueDate,
        amount,
        downloadLink,
        sandbox,
      } = await req.json();

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
            downloadLink:
              downloadLink ||
              `https://app.constil.com/documents/invoice/${generateId()}`,
          },
          { sandbox: sandbox || false },
        );

        return json({
          success: true,
          message: "✅ Invoice sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/proposal ===
    if (req.method === "POST" && path === "sendgrid/proposal") {
      const { to, name, reference, date, downloadLink, sandbox } =
        await req.json();

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
            downloadLink:
              downloadLink ||
              `https://app.constil.com/documents/proposal/${generateId()}`,
          },
          { sandbox: sandbox || false },
        );

        return json({
          success: true,
          message: "✅ Proposal sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/welcome ===
    if (req.method === "POST" && path === "sendgrid/welcome") {
      const { to, name, company, role, sandbox } = await req.json();

      if (!to || !name) {
        return json(
          { success: false, error: '"to" and "name" fields are required' },
          400,
        );
      }

      try {
        const result = await sendWelcomeEmail(
          to,
          { name, company: company || "", role: role || "" },
          { sandbox: sandbox || false },
        );

        return json({
          success: true,
          message: "✅ Welcome email sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/reset-password ===
    if (req.method === "POST" && path === "sendgrid/reset-password") {
      const { to, name, code, link, validity, sandbox } = await req.json();

      if (!to || !name || !code) {
        return json(
          {
            success: false,
            error: '"to", "name" and "code" fields are required',
          },
          400,
        );
      }

      try {
        const result = await sendResetPasswordEmail(
          to,
          {
            name,
            code,
            link: link || "https://constil.com/reset-password",
            validity: validity || "15",
          },
          { sandbox: sandbox || false },
        );

        return json({
          success: true,
          message: "✅ Password reset email sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/confirm ===
    if (req.method === "POST" && path === "sendgrid/confirm") {
      const { to, name, link, sandbox } = await req.json();

      if (!to || !name) {
        return json(
          { success: false, error: '"to" and "name" fields are required' },
          400,
        );
      }

      try {
        const result = await sendConfirmEmail(
          to,
          {
            name,
            link: link || `https://constil.com/confirm/${generateToken()}`,
          },
          { sandbox: sandbox || false },
        );

        return json({
          success: true,
          message: "✅ Confirmation email sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/notification ===
    if (req.method === "POST" && path === "sendgrid/notification") {
      const {
        to,
        title,
        message,
        name,
        details,
        buttonText,
        buttonLink,
        footerMessage,
        sandbox,
      } = await req.json();

      if (!to || !title || !message) {
        return json(
          {
            success: false,
            error: '"to", "title" and "message" fields are required',
          },
          400,
        );
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
          { sandbox: sandbox || false },
        );

        return json({
          success: true,
          message: "✅ Notification sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/simple ===
    if (req.method === "POST" && path === "sendgrid/simple") {
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
      } = await req.json();

      if (!to || !message) {
        return json(
          { success: false, error: '"to" and "message" fields are required' },
          400,
        );
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
          { sandbox: sandbox || false },
        );

        return json({
          success: true,
          message: "✅ Simple template sent successfully!",
          data: result,
        });
      } catch (error: any) {
        return json({ success: false, error: error.message }, 500);
      }
    }

    // === POST /sendgrid/bulk ===
    if (req.method === "POST" && path === "sendgrid/bulk") {
      const { emails, sandbox } = await req.json();

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return json(
          {
            success: false,
            error:
              "Invalid email list. Please send an array with at least one email.",
          },
          400,
        );
      }

      try {
        const result = await sendMultipleEmails(emails, {
          sandbox: sandbox || false,
        });

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
    // ENDPOINTS AUTENTICADOS (APENAS LÓGICA DE NEGÓCIO, SEM EMAIL)
    // ============================================================

    const PUBLIC_ENDPOINTS = [
      "packages",
      "register",
      "login",
      "verify-otp",
      "reset-password",
      "google",
      "auth/google",
      // SendGrid endpoints são públicos para simplicidade
      "sendgrid/health",
      "sendgrid/status",
      "sendgrid/send",
      "sendgrid/send-real",
      "sendgrid/otp",
      "sendgrid/estimate",
      "sendgrid/invoice",
      "sendgrid/proposal",
      "sendgrid/welcome",
      "sendgrid/reset-password",
      "sendgrid/confirm",
      "sendgrid/notification",
      "sendgrid/simple",
      "sendgrid/bulk",
    ];

    let userId: string | null = null;
    let userEmail: string | null = null;

    if (!PUBLIC_ENDPOINTS.includes(path)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return safeError("Unauthorized", 401);
      }

      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } =
        await anonClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return safeError("Unauthorized", 401);
      }

      userId = claimsData.claims.sub as string;

      const rateLimitConfig = RATE_LIMITS[path] || { max: 120, window: 60 };
      const allowed = await checkRateLimit(
        serviceClient,
        userId,
        path,
        rateLimitConfig.max,
        rateLimitConfig.window,
      );
      if (!allowed) {
        return safeError("Too many requests", 429);
      }

      const { data: userProfile } = await serviceClient
        .from("profiles")
        .select("email, phone, email_verified, phone_verified")
        .eq("user_id", userId)
        .single();
      userEmail = userProfile?.email;
    }

    // === GET /credits ===
    if (req.method === "GET" && path === "credits") {
      if (!userId) return safeError("Unauthorized", 401);
      const { data, error } = await serviceClient
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();
      if (error) return safeError("Failed to fetch credits", 500);
      return json({ credits: data?.balance ?? 0 });
    }

    // === GET /get_profile ===
    if (req.method === "GET" && path === "get_profile") {
      if (!userId) return safeError("Unauthorized", 401);
      const { data, error } = await serviceClient
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        return json(
          { status: false, message: "Failed to fetch profile", data: null },
          500,
        );
      }
      if (!data) {
        return json(
          { status: false, message: "Profile not found", data: null },
          404,
        );
      }
      return json({
        status: true,
        message: "Success",
        data: {
          ...data,
          email_verified: data.email_verified || false,
          phone_verified: data.phone_verified || false,
        },
      });
    }

    // === GET /list_invoices ===
    if (req.method === "GET" && path === "list_invoices") {
      if (!userId) return safeError("Unauthorized", 401);
      const { data, error } = await serviceClient
        .from("invoices")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) {
        return json(
          { status: false, message: "Failed to fetch invoices", data: [] },
          500,
        );
      }
      return json({ status: true, message: "Success", data: data ?? [] });
    }

    // === POST /create-checkout ===
    if (req.method === "POST" && path === "create-checkout") {
      if (!userId) return safeError("Unauthorized", 401);
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const {
        package_id,
        billing_type = "one_time",
        coupon_code,
        success_url,
        cancel_url,
      } = body;
      if (!package_id || !isValidUUID(package_id)) {
        return json({ error: "Invalid package_id" }, 400);
      }

      const { data: pkg } = await serviceClient
        .from("credit_packages")
        .select("*")
        .eq("id", package_id)
        .eq("is_active", true)
        .single();
      if (!pkg) {
        return json({ error: "Invalid or inactive package" }, 400);
      }

      const sanitizedCoupon = coupon_code
        ? sanitize(coupon_code, 50)
        : undefined;
      const {
        discountPercent,
        couponId,
        couponCodeResolved,
        influencerId,
        managerId,
      } = await resolveDiscount(serviceClient, userId, sanitizedCoupon);

      const { originalPrice, discountAmount, finalPrice } = calculatePricing(
        pkg.price,
        discountPercent,
      );

      const stripe = getStripe();

      let customerId: string | undefined;
      if (userEmail) {
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 1,
        });
        if (customers.data.length > 0) customerId = customers.data[0].id;
      }

      const metadata = {
        user_id: userId,
        package_id: pkg.id,
        package_name: pkg.name,
        coupon_id: couponId || "",
        coupon_code: couponCodeResolved || "",
        influencer_id: influencerId || "",
        manager_id: managerId || "",
        original_price: String(originalPrice),
        discount_percent: String(discountPercent),
        discount_amount: String(discountAmount),
        final_price: String(finalPrice),
        billing_type,
      };

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : userEmail,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: pkg.name,
                description:
                  discountPercent > 0
                    ? `Original: $${originalPrice.toFixed(2)} | Discount: ${discountPercent}% (-$${discountAmount.toFixed(2)})`
                    : undefined,
              },
              unit_amount: Math.round(finalPrice * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url:
          success_url ||
          `${req.headers.get("origin") || ""}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:
          cancel_url ||
          `${req.headers.get("origin") || ""}/checkout?package_id=${pkg.id}`,
        metadata,
      });

      await serviceClient.from("payment_transactions").insert({
        user_id: userId,
        package_id: pkg.id,
        amount: finalPrice,
        original_price: originalPrice,
        discount_amount: discountAmount,
        coupon_code: couponCodeResolved,
        coupon_id: couponId,
        influencer_id: influencerId,
        manager_id: managerId,
        currency: "usd",
        billing_type,
        stripe_payment_intent_id: session.id,
        status: "pending",
        payment_mode: "stripe",
        metadata,
      });

      return json({
        checkout_url: session.url,
        session_id: session.id,
        original_price: originalPrice,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        final_price: finalPrice,
      });
    }

    // === POST /verify-payment ===
    if (req.method === "POST" && path === "verify-payment") {
      // ... (sem email)
    }

    // === POST /validate-coupon ===
    if (req.method === "POST" && path === "validate-coupon") {
      // ... (sem email)
    }

    // === GET /wallet ===
    if (req.method === "GET" && path === "wallet") {
      // ... (sem email)
    }

    // === GET /subscription ===
    if (req.method === "GET" && path === "subscription") {
      // ... (sem email)
    }

    // === POST /start-free ===
    if (req.method === "POST" && path === "start-free") {
      // ... (sem email)
    }

    // === GET /check-free-eligibility ===
    if (req.method === "GET" && path === "check-free-eligibility") {
      // ... (sem email)
    }

    // === POST /start-trial ===
    if (req.method === "POST" && path === "start-trial") {
      // ... (sem email)
    }

    // === POST /verify-trial ===
    if (req.method === "POST" && path === "verify-trial") {
      // ... (sem email)
    }

    // === GET /template-access ===
    if (req.method === "GET" && path === "template-access") {
      if (!userId) return safeError("Unauthorized", 401);
      const { data: sub } = await serviceClient
        .from("subscriptions")
        .select("template_tier")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

      const tier = sub?.template_tier || "basic";
      const access: Record<string, string[]> = {
        basic: ["basic"],
        professional: ["basic", "professional"],
        enterprise: ["basic", "professional", "enterprise"],
      };
      return json({ tier, templates: access[tier] || ["basic"] });
    }

    // === GET /credit-config ===
    if (req.method === "GET" && path === "credit-config") {
      if (!userId) return safeError("Unauthorized", 401);
      const { data, error } = await serviceClient
        .from("credit_action_config")
        .select("action_type, credit_cost, is_active")
        .eq("is_active", true);
      if (error) return safeError("Failed to fetch config", 500);
      return json({ config: data });
    }

    // === POST /consume-credit ===
    if (req.method === "POST" && path === "consume-credit") {
      if (!userId) return safeError("Unauthorized", 401);
      // ... (sem email)
    }

    // === POST /invoice-generated (legacy) ===
    if (req.method === "POST" && path === "invoice-generated") {
      // ... (sem email)
    }

    // === POST /template/send-invoice ===
    if (req.method === "POST" && path === "template/send-invoice") {
      // ✅ AGORA USA O SENDGRID VIA /sendgrid/invoice
      return json(
        {
          success: false,
          error: "This endpoint is deprecated. Use /sendgrid/invoice instead.",
          redirect: "/sendgrid/invoice",
        },
        410,
      );
    }

    // === POST /template/send-estimate ===
    if (req.method === "POST" && path === "template/send-estimate") {
      // ✅ AGORA USA O SENDGRID VIA /sendgrid/estimate
      return json(
        {
          success: false,
          error: "This endpoint is deprecated. Use /sendgrid/estimate instead.",
          redirect: "/sendgrid/estimate",
        },
        410,
      );
    }

    // ============================================================
    // 404 - NOT FOUND
    // ============================================================

    return safeError("Not found", 404);
  } catch (err) {
    console.error("[USER-API] Error:", (err as Error).message);
    return safeError("Something went wrong", 500);
  }
});
