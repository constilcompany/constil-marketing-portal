/**
 * Contact Form Edge Function with Marketing Data
 * Função Edge para Formulário de Contato com Dados de Marketing
 *
 * @module contact-form
 * @version 2.1.0 - Com suporte a templates SendGrid
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// ============================================================
// 1. CORS HEADERS
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ============================================================
// 2. CONFIGURAÇÃO
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") || "support@constil.com";
const FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") || "CONSTIL";

// 📧 TEMPLATE IDs - Configurar via variáveis de ambiente
const TEMPLATE_IDS = {
  contact: Deno.env.get("SENDGRID_TEMPLATE_CONTACT") || "",
  contactConfirmation:
    Deno.env.get("SENDGRID_TEMPLATE_CONTACT_CONFIRMATION") || "",
  notification: Deno.env.get("SENDGRID_TEMPLATE_NOTIFICATION") || "",
  welcome: Deno.env.get("SENDGRID_TEMPLATE_WELCOME") || "",
};

const ENVIRONMENT = Deno.env.get("ENVIRONMENT") || "development";
const SITE_URL = Deno.env.get("SITE_URL") || "https://constil.com";

// Cliente Supabase com ANON_KEY
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log(`✅ Contact Form initialized in ${ENVIRONMENT} mode`);
console.log(`📧 From: ${FROM_NAME} <${FROM_EMAIL}>`);
console.log(
  `📋 Templates: ${TEMPLATE_IDS.contact ? "✅" : "❌"} Admin | ${TEMPLATE_IDS.contactConfirmation ? "✅" : "❌"} User`,
);

// ============================================================
// 3. TYPE DEFINITIONS
// ============================================================

interface ContactSubmission {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  companyName?: string;
  jobTitle?: string;
  country?: string;
  state?: string;
  city?: string;
  message: string;
  leadSource?: string;
  marketingConsent?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================
// 4. UTILITY FUNCTIONS
// ============================================================

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") && email.length <= 255;
}

function validateRequired(fields: Record<string, any>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (!value || value === "") {
      return `"${key}" is required`;
    }
  }
  return null;
}

function extractPath(url: URL): string {
  let path = url.pathname;
  const functionName = "contact-form";
  const pathSegments = path.split("/").filter((seg) => seg.length > 0);
  const functionIndex = pathSegments.indexOf(functionName);

  if (functionIndex !== -1) {
    path = pathSegments.slice(functionIndex + 1).join("/");
  } else {
    path = path.replace(/^\/functions\/v1\//, "");
  }

  return path.replace(/^\/+/, "");
}

async function getGeolocation(ip: string): Promise<any> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "localhost") {
    return null;
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,zip,lat,lon,timezone`,
      { headers: { "User-Agent": "Contact-Form-Function" } },
    );

    if (response.ok) {
      const data = await response.json();
      if (data.status === "success") {
        return {
          country: data.country,
          state: data.regionName,
          city: data.city,
          postalCode: data.zip,
          timezone: data.timezone,
        };
      }
    }
  } catch (error) {
    console.error("Geolocation error:", error);
  }
  return null;
}

// ============================================================
// 5. EMAIL FUNCTIONS - COM SUPORTE A TEMPLATES
// ============================================================

/**
 * Envia email usando template do SendGrid (se disponível)
 * ou fallback para HTML simples
 */
async function sendEmailWithTemplate(data: {
  to: string;
  subject: string;
  templateId?: string;
  templateData?: Record<string, any>;
  html?: string;
  text?: string;
  replyTo?: string;
}) {
  if (!SENDGRID_API_KEY) {
    console.error("❌ SENDGRID_API_KEY not configured");
    return null;
  }

  // ✅ PRIORIDADE 1: Usar template do SendGrid
  if (data.templateId && data.templateId.startsWith("d-")) {
    try {
      console.log(`📤 Usando template: ${data.templateId}`);

      const payload = {
        personalizations: [
          {
            to: [{ email: data.to }],
            dynamic_template_data: data.templateData || {},
          },
        ],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        template_id: data.templateId,
        reply_to: data.replyTo ? { email: data.replyTo } : undefined,
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
        },
        categories: ["contact-form"],
      };

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
        console.error("❌ SendGrid Template Error:", errorText);
        // Fallback para HTML simples
        console.log("📤 Fallback para HTML simples...");
        return sendSimpleEmail(data);
      }

      return {
        success: true,
        template: true,
        messageId: response.headers.get("x-message-id"),
      };
    } catch (error) {
      console.error("❌ Template error, usando fallback:", error);
      return sendSimpleEmail(data);
    }
  }

  // ✅ PRIORIDADE 2: HTML simples (fallback)
  return sendSimpleEmail(data);
}

/**
 * Envia email simples (HTML) - FALLBACK
 */
async function sendSimpleEmail(data: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}) {
  const payload = {
    personalizations: [{ to: [{ email: data.to }] }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: data.subject,
    content: [
      {
        type: "text/plain",
        value: data.text || data.html.replace(/<[^>]*>/g, ""),
      },
      { type: "text/html", value: data.html },
    ],
    reply_to: data.replyTo ? { email: data.replyTo } : undefined,
    tracking_settings: {
      click_tracking: { enable: true },
      open_tracking: { enable: true },
    },
    categories: ["contact-form"],
  };

  try {
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
      return null;
    }

    return {
      success: true,
      template: false,
      messageId: response.headers.get("x-message-id"),
    };
  } catch (error) {
    console.error("❌ SendGrid Request Error:", error);
    return null;
  }
}

// ============================================================
// 6. EMAIL FUNCTIONS ESPECÍFICAS
// ============================================================

/**
 * Envia notificação para o admin usando template ou fallback
 */
async function sendAdminNotification(
  data: ContactSubmission,
  geoInfo: any = null,
) {
  const name =
    data.firstName && data.lastName
      ? `${data.firstName} ${data.lastName}`
      : data.email;

  const templateId = TEMPLATE_IDS.contact || TEMPLATE_IDS.notification;

  // Dados para o template
  const templateData = {
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    fullName: name,
    email: data.email,
    phone: data.phone || "",
    companyName: data.companyName || "",
    jobTitle: data.jobTitle || "",
    country: geoInfo?.country || data.country || "",
    state: geoInfo?.state || data.state || "",
    city: geoInfo?.city || data.city || "",
    message: data.message,
    date: new Date().toLocaleString(),
    ipAddress: data.ipAddress || "",
    marketingConsent: data.marketingConsent !== false ? "✅ Yes" : "❌ No",
    siteUrl: SITE_URL,
    year: new Date().getFullYear(),
  };

  // HTML fallback
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: #1a56db; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
        .section { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 3px solid #1a56db; }
        .section-title { font-weight: bold; color: #1e293b; font-size: 14px; margin-bottom: 8px; }
        .field { margin: 5px 0; }
        .label { font-weight: 500; color: #64748b; }
        .value { color: #0f172a; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="header"><h2>📩 New Contact Form Submission</h2></div>
      <div class="content">
        <div class="section">
          <div class="section-title">👤 Contact Information</div>
          <div class="field"><span class="label">Name:</span> <span class="value">${templateData.fullName}</span></div>
          <div class="field"><span class="label">Email:</span> <span class="value"><a href="mailto:${templateData.email}">${templateData.email}</a></span></div>
          ${templateData.phone ? `<div class="field"><span class="label">Phone:</span> <span class="value">${templateData.phone}</span></div>` : ""}
          ${templateData.companyName ? `<div class="field"><span class="label">Company:</span> <span class="value">${templateData.companyName}</span></div>` : ""}
          ${templateData.country ? `<div class="field"><span class="label">Location:</span> <span class="value">${templateData.city} ${templateData.state} ${templateData.country}</span></div>` : ""}
        </div>
        <div class="section">
          <div class="section-title">💬 Message</div>
          <div style="background: white; padding: 15px; border-radius: 4px; white-space: pre-wrap;">${templateData.message}</div>
        </div>
        <div class="footer">
          <p>Submitted at: ${templateData.date}</p>
          <p>IP: ${templateData.ipAddress}</p>
          <p>Marketing Consent: ${templateData.marketingConsent}</p>
          <p>© ${templateData.year} CONSTIL. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmailWithTemplate({
    to: FROM_EMAIL,
    subject: `📩 New Contact from ${name}`,
    templateId,
    templateData,
    html: htmlContent,
    replyTo: data.email,
  });
}

/**
 * Envia confirmação para o usuário usando template ou fallback
 */
async function sendUserConfirmation(data: ContactSubmission) {
  const name =
    data.firstName && data.lastName
      ? `${data.firstName} ${data.lastName}`
      : "there";

  const templateId = TEMPLATE_IDS.contactConfirmation || TEMPLATE_IDS.welcome;

  // Dados para o template
  const templateData = {
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    fullName: name,
    email: data.email,
    message: data.message,
    companyName: data.companyName || "",
    date: new Date().toLocaleString(),
    siteUrl: SITE_URL,
    year: new Date().getFullYear(),
  };

  // HTML fallback
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
        .message-preview { background: white; padding: 15px; border-radius: 4px; border-left: 3px solid #16a34a; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
        .button { display: inline-block; background: #1a56db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="header"><h2>✅ Thank You for Contacting CONSTIL!</h2></div>
      <div class="content">
        <p>Dear <strong>${templateData.fullName}</strong>,</p>
        <p>We have received your message and will get back to you within <strong>24 hours</strong>.</p>
        <h3>📋 Your Message:</h3>
        <div class="message-preview">${templateData.message.replace(/\n/g, "<br>")}</div>
        <br>
        <a href="${SITE_URL}" class="button">Visit Our Website</a>
        <div class="footer">
          <p>© ${templateData.year} CONSTIL. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmailWithTemplate({
    to: data.email,
    subject: `✅ We received your message - CONSTIL`,
    templateId,
    templateData,
    html: htmlContent,
  });
}

// ============================================================
// 7. DATABASE FUNCTIONS - TABELA 'conts'
// ============================================================

async function saveContact(data: ContactSubmission, geoInfo: any = null) {
  try {
    console.log("📤 Dados recebidos:", JSON.stringify(data, null, 2));

    const contactData = {
      first_name: data.firstName || null,
      last_name: data.lastName || null,
      email: data.email,
      phone: data.phone || null,
      company_name: data.companyName || null,
      job_title: data.jobTitle || null,
      country: geoInfo?.country || data.country || null,
      state: geoInfo?.state || data.state || null,
      city: geoInfo?.city || data.city || null,
      message: data.message,
      lead_source: data.leadSource || "website_contact",
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      marketing_consent:
        data.marketingConsent !== undefined ? data.marketingConsent : true,
    };

    console.log(
      "📤 Inserindo em 'conts':",
      JSON.stringify(contactData, null, 2),
    );

    const { data: result, error } = await supabaseClient
      .from("conts")
      .insert(contactData)
      .select()
      .single();

    if (error) {
      console.error("❌ Erro no banco:", error);
      console.error("Detalhes:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return null;
    }

    console.log("✅ Salvo com sucesso:", result);
    return result;
  } catch (error) {
    console.error("❌ Erro ao salvar:", error);
    return null;
  }
}

// ============================================================
// 8. MAIN SERVER
// ============================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = extractPath(url);
    const method = req.method;

    console.log(`📨 ${method} /${path || "root"}`);

    let body: any = {};
    if (method === "POST") {
      try {
        body = await req.json();
      } catch {
        // body opcional
      }
    }

    // ============================================================
    // GET ROUTES
    // ============================================================

    if (method === "GET" && path === "health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "contact-form",
          version: "2.1.0",
          environment: ENVIRONMENT,
          timestamp: new Date().toISOString(),
          templates: {
            admin: !!TEMPLATE_IDS.contact,
            user: !!TEMPLATE_IDS.contactConfirmation,
          },
          config: {
            sendgrid: !!SENDGRID_API_KEY,
            supabase: !!SUPABASE_URL && !!SUPABASE_ANON_KEY,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ============================================================
    // POST ROUTES
    // ============================================================

    if (method === "POST" && (path === "submit" || path === "")) {
      const {
        firstName,
        lastName,
        email,
        phone,
        companyName,
        jobTitle,
        country,
        state,
        city,
        message,
        leadSource,
        marketingConsent,
      } = body;

      console.log("📥 Recebido:", {
        email,
        firstName,
        lastName,
        messageLength: message?.length,
      });

      // ✅ VALIDAÇÃO: APENAS EMAIL E MESSAGE
      const validationError = validateRequired({ email, message });

      if (validationError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: validationError,
            requiredFields: ["email", "message"],
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!isValidEmail(email)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid email format",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (message.trim().length < 3) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Message must be at least 3 characters long",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const ipAddress =
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      const geoInfo = await getGeolocation(ipAddress);

      const contactData: ContactSubmission = {
        firstName: firstName || "",
        lastName: lastName || "",
        email,
        phone: phone || "",
        companyName: companyName || "",
        jobTitle: jobTitle || "",
        country: country || geoInfo?.country || "",
        state: state || geoInfo?.state || "",
        city: city || geoInfo?.city || "",
        message,
        leadSource: leadSource || "website_contact",
        marketingConsent:
          marketingConsent !== undefined ? marketingConsent : true,
        ipAddress,
        userAgent,
      };

      try {
        console.log("💾 Salvando no banco...");
        const savedContact = await saveContact(contactData, geoInfo);

        if (!savedContact) {
          throw new Error("Falha ao salvar contato");
        }

        console.log(`✅ Contato salvo com ID: ${savedContact.id}`);

        console.log("📧 Enviando notificação...");
        await sendAdminNotification(contactData, geoInfo);

        console.log("📧 Enviando confirmação...");
        await sendUserConfirmation(contactData);

        return new Response(
          JSON.stringify({
            success: true,
            message: "✅ Contact form submitted successfully!",
            data: {
              id: savedContact.id,
              email: savedContact.email,
              leadScore: savedContact.lead_score || 0,
              leadQuality: savedContact.lead_quality || "cold",
              status: savedContact.status || "new",
              createdAt: savedContact.created_at,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error: any) {
        console.error("❌ Erro ao processar:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || "Failed to process contact form",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Route not found",
        path: `/${path}`,
        method,
        availableRoutes: ["GET /health", "POST /submit"],
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
