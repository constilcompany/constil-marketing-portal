/**
 * SendGrid Email Edge Function
 * Função Edge SendGrid para Supabase
 *
 * @module sendgrid
 * @description Production-ready email service running on Supabase Edge Functions (Deno)
 * @description Serviço de email pronto para produção rodando em Edge Functions do Supabase (Deno)
 * @version 3.0.0
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ============================================================
// 1. CORS HEADERS / HEADERS CORS
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ============================================================
// 2. CONFIGURATION / CONFIGURAÇÃO
// ============================================================

/**
 * Environment variables / Variáveis de ambiente
 */
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") || "support@constil.com";
const FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") || "CONSTIL";

/**
 * Template IDs from environment
 * IDs dos templates do ambiente
 */
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

// Validate API Key / Valida chave da API
if (!SENDGRID_API_KEY) {
  console.error("❌ SENDGRID_API_KEY is not configured");
}

// ============================================================
// 3. SENDGRID SERVICE / SERVIÇO SENDGRID
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
  // Ensure content is never empty / Garante que o conteúdo nunca esteja vazio
  const htmlContent = data.html || data.text || "<p>Email content</p>";
  const textContent =
    data.text || data.html?.replace(/<[^>]*>/g, "") || "Email content";

  // Build email payload / Monta o payload do email
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
      source: "edge-function",
      environment: Deno.env.get("ENVIRONMENT") || "production",
      timestamp: Date.now().toString(),
    },
  };

  // Sandbox mode / Modo sandbox
  if (data.sandbox === true) {
    (payload as any).mail_settings = { sandbox_mode: { enable: true } };
    console.log("⚠️ SANDBOX mode enabled");
  }

  console.log(`📤 Sending email to: ${data.to}`);
  console.log(`📋 Subject: ${data.subject || "Message from Constil"}`);

  // Send email / Envia o email
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
  if (!templateId) {
    throw new Error("❌ templateId is required");
  }

  // Build template data / Monta os dados do template
  const templateData = {
    ...data,
    unsubscribeLink: data.unsubscribeLink || "https://constil.com/unsubscribe",
    year: new Date().getFullYear().toString(),
    companyName: "CONSTIL",
  };

  // Build email payload / Monta o payload do email
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
      source: "edge-function",
      environment: Deno.env.get("ENVIRONMENT") || "production",
      template_id: templateId,
      timestamp: Date.now().toString(),
    },
  };

  // Sandbox mode / Modo sandbox
  if (options.sandbox === true) {
    (payload as any).mail_settings = { sandbox_mode: { enable: true } };
    console.log("⚠️ SANDBOX mode enabled");
  }

  console.log(`📤 Sending template ${templateId} to: ${to}`);

  // Send email / Envia o email
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
// 4. UTILITY FUNCTIONS / FUNÇÕES AUXILIARES
// ============================================================

/**
 * Generate a 6-digit OTP code
 * Gera um código OTP de 6 dígitos
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a secure token
 * Gera um token seguro
 */
function generateToken(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * Generate a reference number with prefix
 * Gera um número de referência com prefixo
 */
function generateReference(prefix: string): string {
  const year = new Date().getFullYear();
  const id = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${prefix}-${year}-${id}`;
}

/**
 * Generate a random ID
 * Gera um ID aleatório
 */
function generateId(): number {
  return Math.floor(Math.random() * 1000);
}

/**
 * Format date with optional days offset
 * Formata data com offset opcional de dias
 */
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
// 5. TEMPLATE METHODS / MÉTODOS DE TEMPLATE
// ============================================================

/**
 * Send OTP verification email
 * Envia email de verificação OTP
 */
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

/**
 * Send estimate email
 * Envia email de orçamento
 */
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

/**
 * Send invoice email
 * Envia email de fatura
 */
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

/**
 * Send proposal email
 * Envia email de proposta
 */
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

/**
 * Send welcome email
 * Envia email de boas-vindas
 */
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

/**
 * Send password reset email
 * Envia email de redefinição de senha
 */
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

/**
 * Send email confirmation
 * Envia email de confirmação
 */
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

/**
 * Send notification email
 * Envia email de notificação
 */
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

/**
 * Send simple template email
 * Envia email com template simples
 */
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

/**
 * Send multiple emails in parallel
 * Envia múltiplos emails em paralelo
 */
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
// 6. ROUTE HANDLERS / MANIPULADORES DE ROTAS
// ============================================================

/**
 * Handle API errors / Trata erros da API
 */
function handleError(error: any): Response {
  console.error("❌ Error:", error);
  return new Response(
    JSON.stringify({
      success: false,
      error: error.message || "Internal server error",
    }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

/**
 * Validate required fields / Valida campos obrigatórios
 */
function validateRequired(fields: Record<string, any>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (!value || value === "") {
      return `"${key}" field is required`;
    }
  }
  return null;
}

/**
 * Extract the route path from the URL
 * Extrai o caminho da rota da URL
 */
function extractPath(url: URL): string {
  let path = url.pathname;
  const functionName = "sendgrid";
  const pathSegments = path.split("/").filter((seg) => seg.length > 0);
  const functionIndex = pathSegments.indexOf(functionName);

  if (functionIndex !== -1) {
    path = pathSegments.slice(functionIndex + 1).join("/");
  } else {
    path = path.replace(/^\/functions\/v1\//, "");
  }

  return path.replace(/^\/+/, "");
}

// ============================================================
// 7. MAIN SERVER / SERVIDOR PRINCIPAL
// ============================================================

serve(async (req: Request) => {
  // Handle CORS preflight / Trata preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = extractPath(url);
    const method = req.method;

    console.log(`📨 ${method} /${path || "root"}`);

    // Parse body for POST requests / Parseia body para requisições POST
    let body: any = {};
    if (method === "POST") {
      try {
        body = await req.json();
      } catch {
        /* body opcional */
      }
    }

    // ============================================================
    // GET ROUTES / ROTAS GET
    // ============================================================

    if (method === "GET" && path === "status") {
      return new Response(
        JSON.stringify({
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
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (method === "GET" && path === "health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "sendgrid-edge",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ============================================================
    // POST ROUTES / ROTAS POST
    // ============================================================

    // POST /send - Simple email / Email simples
    if (method === "POST" && path === "send") {
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
      } = body;

      const validationError = validateRequired({ to });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!text && !html) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "At least one of 'text' or 'html' is required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

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

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Email sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /send-real - Force real email / Força email real
    if (method === "POST" && path === "send-real") {
      const { to, subject, text, html, cc, bcc, replyTo, attachments } = body;

      const validationError = validateRequired({ to });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!text && !html) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "At least one of 'text' or 'html' is required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

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

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Real email sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /otp - Send OTP / Envia OTP
    if (method === "POST" && path === "otp") {
      const { to, code, validity, name, sandbox } = body;

      const validationError = validateRequired({ to });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const result = await sendOtpEmail(
        to,
        {
          code: code || generateCode(),
          validity: validity || "5",
          name: name || "User",
        },
        { sandbox: sandbox || false },
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ OTP sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /estimate - Send estimate / Envia orçamento
    if (method === "POST" && path === "estimate") {
      const { to, name, reference, date, total, downloadLink, sandbox } = body;

      const validationError = validateRequired({ to });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

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

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Estimate sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /invoice - Send invoice / Envia fatura
    if (method === "POST" && path === "invoice") {
      const {
        to,
        name,
        invoiceNo,
        issueDate,
        dueDate,
        amount,
        downloadLink,
        sandbox,
      } = body;

      const validationError = validateRequired({ to });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

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

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Invoice sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /proposal - Send proposal / Envia proposta
    if (method === "POST" && path === "proposal") {
      const { to, name, reference, date, downloadLink, sandbox } = body;

      const validationError = validateRequired({ to });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

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

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Proposal sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /welcome - Send welcome / Envia boas-vindas
    if (method === "POST" && path === "welcome") {
      const { to, name, company, role, sandbox } = body;

      const validationError = validateRequired({ to, name });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const result = await sendWelcomeEmail(
        to,
        { name, company: company || "", role: role || "" },
        { sandbox: sandbox || false },
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Welcome email sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /reset-password - Send password reset / Envia redefinição de senha
    if (method === "POST" && path === "reset-password") {
      const { to, name, code, link, validity, sandbox } = body;

      const validationError = validateRequired({ to, name, code });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

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

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Password reset email sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /confirm - Send confirmation / Envia confirmação
    if (method === "POST" && path === "confirm") {
      const { to, name, link, sandbox } = body;

      const validationError = validateRequired({ to, name });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const result = await sendConfirmEmail(
        to,
        {
          name,
          link: link || `https://constil.com/confirm/${generateToken()}`,
        },
        { sandbox: sandbox || false },
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Confirmation email sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /notification - Send notification / Envia notificação
    if (method === "POST" && path === "notification") {
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
      } = body;

      const validationError = validateRequired({ to, title, message });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

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

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Notification sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /simple - Send simple template / Envia template simples
    if (method === "POST" && path === "simple") {
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

      const validationError = validateRequired({ to, message });
      if (validationError) {
        return new Response(
          JSON.stringify({ success: false, error: validationError }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

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

      return new Response(
        JSON.stringify({
          success: true,
          message: "✅ Simple template sent successfully!",
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // POST /bulk - Send multiple emails / Envia múltiplos emails
    if (method === "POST" && path === "bulk") {
      const { emails, sandbox } = body;

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Invalid email list. Please send an array with at least one email.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const result = await sendMultipleEmails(emails, {
        sandbox: sandbox || false,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `✅ ${result.sent} emails sent, ${result.failed} failed`,
          data: result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ============================================================
    // 404 - NOT FOUND / ROTA NÃO ENCONTRADA
    // ============================================================

    return new Response(
      JSON.stringify({
        success: false,
        error: "Route not found",
        path: `/${path}`,
        method,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return handleError(error);
  }
});
