// ============================================================
// USER-API: Serviço de Autenticação e Gerenciamento de Usuários
// User-API: Authentication and User Management Service
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

// ============================================================
// CONSTANTES E CONFIGURAÇÕES | CONSTANTS & CONFIGURATIONS
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Headers de segurança | Security headers
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

// Rate limits específicos por endpoint | Specific rate limits per endpoint
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
};

// ============================================================
// FUNÇÕES AUXILIARES | HELPER FUNCTIONS
// ============================================================

/**
 * Resposta JSON padronizada | Standardized JSON response
 */
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      "Content-Type": "application/json",
    },
  });

/**
 * Sanitiza entrada para prevenir XSS | Sanitizes input to prevent XSS
 * @param input - Dado de entrada | Input data
 * @param maxLength - Tamanho máximo | Maximum length
 * @returns String sanitizada | Sanitized string
 */
function sanitize(input: unknown, maxLength = 500): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>'"]/g, "")
    .trim()
    .substring(0, maxLength);
}

/**
 * Valida UUID | Validates UUID
 */
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id || "",
  );
}

/**
 * Valida email | Validates email
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") && email.length <= 255;
}

/**
 * Valida telefone (formato internacional) | Validates phone (international format)
 */
function isValidPhone(phone: string): boolean {
  if (!phone) return true; // Opcional | Optional
  return /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s/g, ""));
}

/**
 * Resposta segura de erro | Safe error response
 */
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

/**
 * Verifica limite de taxa | Checks rate limit
 */
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

/**
 * Limpa registros antigos de rate limit | Cleans old rate limit records
 */
async function cleanupRateLimits(serviceClient: any) {
  const cutoff = new Date(Date.now() - 300_000).toISOString();
  await serviceClient.from("rate_limits").delete().lt("window_start", cutoff);
}

/**
 * Retorna cliente Stripe | Returns Stripe client
 */
function getStripe() {
  return new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-11-20.acacia",
  });
}

/**
 * Resolve desconto de cupom | Resolves coupon discount
 */
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

/**
 * Calcula preço com desconto | Calculates price with discount
 */
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

/**
 * Processa pagamento bem-sucedido | Processes successful payment
 */
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
  // Trata requisições OPTIONS | Handle OPTIONS requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/user-api\/?/, "");
  const path = rawPath.replace(/^auth\//, "");

  // Cliente com permissões administrativas | Admin client
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Limpeza periódica (non-blocking) | Periodic cleanup (non-blocking)
    cleanupRateLimits(serviceClient).catch(() => {});

    // ============================================================
    // ENDPOINTS PÚBLICOS | PUBLIC ENDPOINTS
    // ============================================================

    // === GET /packages ===
    // Lista pacotes disponíveis | Lists available packages
    if (req.method === "GET" && path === "packages") {
      const { data, error } = await serviceClient
        .from("credit_packages")
        .select(
          "id, name, description, credit_amount, price, billing_type, billing_interval, template_tier, invoice_credits, estimate_credits, ai_estimate_credits, invoice_unlimited, estimate_unlimited, ai_estimate_unlimited, is_active, is_free, trial_enabled, trial_days, created_at",
        )
        .eq("is_active", true)
        .order("price", { ascending: true });
      if (error) return safeError("Failed to fetch packages", 500);

      // Separar planos | Separate plans
      const freePlan = data.find((p: any) => p.is_free === true);
      const paidPlans = data.filter((p: any) => p.is_free !== true);

      return json({
        packages: data,
        free_plan: freePlan || null,
        paid_plans: paidPlans,
        has_free_plan: !!freePlan,
      });
    }

    // === POST /register ===
    // Registro de novo usuário | New user registration
    if (req.method === "POST" && path === "register") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      // Validação e sanitização | Validation and sanitization
      const email = sanitize(body.email, 255).toLowerCase();
      const password = body.password;
      const full_name = sanitize(body.full_name, 100);
      const first_name = sanitize(body.first_name, 50);
      const last_name = sanitize(body.last_name, 50);
      const company_name = sanitize(body.company_name, 100);
      const coupon_code = sanitize(body.coupon_code, 50);
      const phone = sanitize(body.phone, 20);
      const address = sanitize(body.address, 500);
      const zip_code = sanitize(body.zip_code, 20);
      const city = sanitize(body.city, 100);
      const state = sanitize(body.state, 100);
      const country = sanitize(body.country, 100);

      // Validação de campos obrigatórios | Required fields validation
      if (!email || !password || !full_name) {
        return json({ error: "Missing required fields" }, 400);
      }
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email format" }, 400);
      }
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
      ) {
        return json({ error: "Password must be 8-128 characters" }, 400);
      }
      if (phone && !isValidPhone(phone)) {
        return json({ error: "Invalid phone number format" }, 400);
      }

      // Verificar se email já existe | Check if email exists
      const { data: existingEmail } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (existingEmail) {
        return json({ error: "Email already registered" }, 409);
      }

      // Verificar se telefone já existe (se fornecido) | Check if phone exists
      if (phone) {
        const { data: existingPhone } = await serviceClient
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .single();

        if (existingPhone) {
          return json({ error: "Phone number already registered" }, 409);
        }
      }

      // Rate limit | Rate limiting
      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const allowed = await checkRateLimit(
        serviceClient,
        clientIP,
        "register",
        RATE_LIMITS.register.max,
        RATE_LIMITS.register.window,
      );
      if (!allowed) return safeError("Too many requests", 429);

      // Criar usuário | Create user
      const { data: newUser, error: createErr } =
        await serviceClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name,
            first_name,
            last_name,
            company_name,
            phone,
          },
        });
      if (createErr) {
        console.error("Registration error:", createErr);
        return json({ error: "Registration failed" }, 400);
      }

      const userId = newUser.user.id;

      // Atualizar perfil | Update profile
      const profileUpdate: any = {
        user_id: userId,
        email: email,
        full_name: full_name,
        phone: phone || null,
        address: address || null,
        zip_code: zip_code || null,
        city: city || null,
        state: state || null,
        country: country || null,
        company_name: company_name || null,
        first_name: first_name || full_name.split(" ")[0],
        last_name: last_name || full_name.split(" ").slice(1).join(" "),
        email_verified: true,
        phone_verified: !!phone,
      };

      await serviceClient
        .from("profiles")
        .update(profileUpdate)
        .eq("user_id", userId);

      // Processar cupom | Process coupon
      if (coupon_code) {
        const upperCode = coupon_code.toUpperCase();
        const { data: coupon } = await serviceClient
          .from("coupons")
          .select("*")
          .eq("code", upperCode)
          .eq("is_active", true)
          .single();

        if (coupon) {
          const withinLimit =
            !coupon.usage_limit || coupon.usage_count < coupon.usage_limit;
          const notExpired =
            !coupon.expiry_date || new Date(coupon.expiry_date) > new Date();

          if (withinLimit && notExpired) {
            await serviceClient.from("user_attributions").insert({
              user_id: userId,
              influencer_id: coupon.influencer_id,
              coupon_id: coupon.id,
            });
            await serviceClient
              .from("coupons")
              .update({ usage_count: coupon.usage_count + 1 })
              .eq("id", coupon.id);
          }
        }
      }

      // Log de auditoria | Audit log
      await serviceClient.from("audit_logs").insert({
        user_id: userId,
        action: "user_registered",
        ip_address: clientIP,
        user_agent: req.headers.get("user-agent") || "",
        metadata: { email, has_phone: !!phone },
      });

      return json({
        success: true,
        user: { id: userId, email },
        message: "Account created successfully",
      });
    }

    // === POST /login ===
    // Login de usuário | User login
    if (req.method === "POST" && path === "login") {
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
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email format" }, 400);
      }

      // Rate limit | Rate limiting
      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const allowed = await checkRateLimit(
        serviceClient,
        `${clientIP}:${email}`,
        "login",
        RATE_LIMITS.login.max,
        RATE_LIMITS.login.window,
      );
      if (!allowed) {
        return safeError(
          "Too many login attempts. Please try again later.",
          429,
        );
      }

      // Login | Login
      const { data, error } = await serviceClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        // Log de tentativa falha | Failed attempt log
        await serviceClient.from("audit_logs").insert({
          action: "login_failed",
          ip_address: clientIP,
          user_agent: req.headers.get("user-agent") || "",
          metadata: { email, error: error.message },
        });
        return json({ error: "Invalid credentials" }, 401);
      }

      // Verificar se email/telefone estão verificados | Check if email/phone are verified
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("email_verified, phone_verified")
        .eq("user_id", data.user.id)
        .single();

      // Sessão | Session
      await serviceClient.from("sessions").insert({
        user_id: data.user.id,
        is_active: true,
        ip_address: clientIP.substring(0, 45),
        user_agent: (req.headers.get("user-agent") || "").substring(0, 255),
      });

      // Log de auditoria | Audit log
      await serviceClient.from("audit_logs").insert({
        user_id: data.user.id,
        action: "user_logged_in",
        ip_address: clientIP,
        user_agent: req.headers.get("user-agent") || "",
      });

      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          email_verified: profile?.email_verified || false,
          phone_verified: profile?.phone_verified || false,
        },
      });
    }

    // === POST /send-signup-otp ===
    // Envia OTP para verificação de email | Sends OTP for email verification
    if (req.method === "POST" && path === "send-signup-otp") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const email = sanitize(body.email, 255).toLowerCase();
      if (!email) return json({ error: "Email is required" }, 400);
      if (!isValidEmail(email))
        return json({ error: "Invalid email format" }, 400);

      // Verificar se email já existe | Check if email exists
      const { data: existingProfile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (existingProfile) {
        return json(
          { error: "This email is already registered. Please login instead." },
          409,
        );
      }

      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const rateLimited = await checkRateLimit(
        serviceClient,
        `${clientIP}:${email}`,
        "send-signup-otp",
        RATE_LIMITS["send-signup-otp"].max,
        RATE_LIMITS["send-signup-otp"].window,
      );
      if (!rateLimited) return safeError("Too many requests", 429);

      try {
        // Gerar OTP de 6 dígitos | Generate 6-digit OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Invalidar OTPs anteriores | Invalidate previous OTPs
        await serviceClient
          .from("password_reset_otps")
          .update({ used: true })
          .eq("email", email)
          .eq("used", false);

        // Armazenar novo OTP | Store new OTP
        await serviceClient.from("password_reset_otps").insert({
          email,
          otp_code: otp,
          expires_at: expiresAt.toISOString(),
          purpose: "signup",
        });

        // Enviar OTP via SendGrid | Send OTP via SendGrid
        const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
        if (sendgridKey) {
          await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sendgridKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email }] }],
              from: { email: "support@constil.com", name: "Constil" },
              subject: "Your Constil Verification Code",
              content: [
                {
                  type: "text/html",
                  value: `
                    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                      <h2 style="color: #1a1a1a; margin-bottom: 16px;">Verify Your Email</h2>
                      <p style="color: #555; font-size: 14px; margin-bottom: 24px;">
                        Use the code below to verify your email address and complete your signup. This code expires in 10 minutes.
                      </p>
                      <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${otp}</span>
                      </div>
                      <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
                    </div>
                  `,
                },
              ],
            }),
          });
        }
      } catch {
        // Silencioso | Silent
      }

      return json({
        success: true,
        message: "If the email is valid, a verification code has been sent.",
      });
    }

    // === POST /forgot-password ===
    // Recuperação de senha | Password recovery
    if (req.method === "POST" && path === "forgot-password") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const email = sanitize(body.email, 255).toLowerCase();
      if (!email) return json({ error: "Email is required" }, 400);
      if (!isValidEmail(email))
        return json({ error: "Invalid email format" }, 400);

      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const rateLimited = await checkRateLimit(
        serviceClient,
        `${clientIP}:${email}`,
        "forgot-password",
        RATE_LIMITS["forgot-password"].max,
        RATE_LIMITS["forgot-password"].window,
      );
      if (!rateLimited) return safeError("Too many requests", 429);

      // Sempre retornar sucesso para prevenir enumeração | Always return success to prevent enumeration
      try {
        const { data: users } = await serviceClient.auth.admin.listUsers();
        const userExists = users?.users?.some(
          (u: any) => u.email?.toLowerCase() === email,
        );

        if (userExists) {
          // Gerar OTP | Generate OTP
          const otp = String(Math.floor(100000 + Math.random() * 900000));
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

          await serviceClient
            .from("password_reset_otps")
            .update({ used: true })
            .eq("email", email)
            .eq("used", false);

          await serviceClient.from("password_reset_otps").insert({
            email,
            otp_code: otp,
            expires_at: expiresAt.toISOString(),
            purpose: "password_reset",
          });

          const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
          if (sendgridKey) {
            await fetch("https://api.sendgrid.com/v3/mail/send", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${sendgridKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                personalizations: [{ to: [{ email }] }],
                from: { email: "support@constil.com", name: "Constil" },
                subject: "Your Constil Verification Code",
                content: [
                  {
                    type: "text/html",
                    value: `
                      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                        <h2 style="color: #1a1a1a; margin-bottom: 16px;">Your Verification Code</h2>
                        <p style="color: #555; font-size: 14px; margin-bottom: 24px;">
                          Here is your Constil verification code. This code expires in 10 minutes.
                        </p>
                        <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${otp}</span>
                        </div>
                        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
                      </div>
                    `,
                  },
                ],
              }),
            });
          }
        }
      } catch {
        // Silencioso | Silent
      }

      return json({
        success: true,
        message:
          "If an account exists with that email, a reset code has been sent.",
      });
    }

    // === POST /verify-otp ===
    // Verifica OTP | Verifies OTP
    if (req.method === "POST" && path === "verify-otp") {
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
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email format" }, 400);
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

      // Marcar OTP como usado | Mark OTP as used
      await serviceClient
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

      // Se for verificação de signup, marcar email como verificado | If signup verification, mark email as verified
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
    // Reset de senha | Password reset
    if (req.method === "POST" && path === "reset-password") {
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
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email format" }, 400);
      }
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
      ) {
        return json({ error: "Password must be 8-128 characters" }, 400);
      }

      // Verificar OTP | Verify OTP
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

      // Marcar OTP como usado | Mark OTP as used
      await serviceClient
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

      // Encontrar usuário e atualizar senha | Find user and update password
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

      // Log de auditoria | Audit log
      await serviceClient.from("audit_logs").insert({
        user_id: targetUser.id,
        action: "password_reset",
        ip_address:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown",
      });

      return json({ success: true, message: "Password updated successfully" });
    }

    // === POST /google ===
    // Autenticação com Google | Google authentication
    if (
      req.method === "POST" &&
      (path === "google" || path === "auth/google")
    ) {
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

      const clientIP =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const googleRateOk = await checkRateLimit(
        serviceClient,
        clientIP,
        "google",
        RATE_LIMITS.google.max,
        RATE_LIMITS.google.window,
      );
      if (!googleRateOk) return safeError("Too many requests", 429);

      const { data, error } = await serviceClient.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        console.error("Google signInWithIdToken error:", error.message);
        return json(
          { error: "Google sign-in failed", detail: error.message },
          401,
        );
      }

      const userId = data.user.id;
      const isNewUser = data.user.created_at === data.user.updated_at;

      // Se for novo usuário, criar perfil | If new user, create profile
      if (isNewUser) {
        const phone = sanitize(body.phone, 20);
        const address = sanitize(body.address, 500);
        const zip_code = sanitize(body.zip_code, 20);
        const full_name = sanitize(body.full_name, 100);
        const coupon_code = sanitize(body.coupon_code, 50);

        const profileUpdate: any = {
          user_id: userId,
          email: data.user.email,
          full_name: full_name || data.user.user_metadata?.full_name || "",
          phone: phone || null,
          address: address || null,
          zip_code: zip_code || null,
          email_verified: true, // Google já verifica
          phone_verified: !!phone && isValidPhone(phone),
        };

        await serviceClient
          .from("profiles")
          .upsert(profileUpdate, { onConflict: "user_id" });

        // Processar cupom | Process coupon
        if (coupon_code) {
          const upperCode = coupon_code.toUpperCase();
          const { data: coupon } = await serviceClient
            .from("coupons")
            .select("*")
            .eq("code", upperCode)
            .eq("is_active", true)
            .single();

          if (coupon) {
            const withinLimit =
              !coupon.usage_limit || coupon.usage_count < coupon.usage_limit;
            const notExpired =
              !coupon.expiry_date || new Date(coupon.expiry_date) > new Date();

            if (withinLimit && notExpired) {
              await serviceClient.from("user_attributions").insert({
                user_id: userId,
                influencer_id: coupon.influencer_id,
                coupon_id: coupon.id,
              });
              await serviceClient
                .from("coupons")
                .update({ usage_count: coupon.usage_count + 1 })
                .eq("id", coupon.id);
            }
          }
        }
      }

      // Sessão | Session
      await serviceClient.from("sessions").insert({
        user_id: userId,
        is_active: true,
        ip_address: clientIP.substring(0, 45),
        user_agent: (req.headers.get("user-agent") || "").substring(0, 255),
      });

      // Log de auditoria | Audit log
      await serviceClient.from("audit_logs").insert({
        user_id: userId,
        action: "google_login",
        ip_address: clientIP,
        metadata: { is_new_user: isNewUser },
      });

      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: { id: userId, email: data.user.email },
        is_new_user: isNewUser,
      });
    }

    // ============================================================
    // ENDPOINTS AUTENTICADOS | AUTHENTICATED ENDPOINTS
    // ============================================================

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

    const userId = claimsData.claims.sub as string;

    // Rate limit para endpoints autenticados | Rate limit for authenticated endpoints
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

    // Obter perfil do usuário | Get user profile
    const { data: userProfile } = await serviceClient
      .from("profiles")
      .select("email, phone, email_verified, phone_verified")
      .eq("user_id", userId)
      .single();
    const userEmail = userProfile?.email;
    const userPhone = userProfile?.phone;
    const isEmailVerified = userProfile?.email_verified || false;
    const isPhoneVerified = userProfile?.phone_verified || false;

    // === GET /credits ===
    // Obtém créditos do usuário | Gets user credits
    if (req.method === "GET" && path === "credits") {
      const { data, error } = await serviceClient
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();
      if (error) return safeError("Failed to fetch credits", 500);
      return json({ credits: data?.balance ?? 0 });
    }

    // === GET /get_profile ===
    // Obtém perfil do usuário | Gets user profile
    if (req.method === "GET" && path === "get_profile") {
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
    // Lista faturas do usuário | Lists user invoices
    if (req.method === "GET" && path === "list_invoices") {
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
    // Cria checkout Stripe | Creates Stripe checkout
    if (req.method === "POST" && path === "create-checkout") {
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
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
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
    // Verifica pagamento Stripe | Verifies Stripe payment
    if (req.method === "POST" && path === "verify-payment") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const { session_id } = body;
      if (!session_id || typeof session_id !== "string") {
        return json({ error: "Missing session_id" }, 400);
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status !== "paid") {
        return json({ status: "unpaid", message: "Payment not completed" });
      }

      const { data: txn } = await serviceClient
        .from("payment_transactions")
        .select("*")
        .eq("stripe_payment_intent_id", session_id)
        .single();

      if (!txn) {
        return json({ error: "Transaction not found" }, 404);
      }

      if (txn.user_id !== userId) {
        return safeError("Unauthorized", 403);
      }

      if (txn.status === "succeeded") {
        return json({
          status: "already_processed",
          message: "Payment already processed",
        });
      }

      await serviceClient
        .from("payment_transactions")
        .update({ status: "succeeded" })
        .eq("id", txn.id);

      const result = await processSuccessfulPayment(serviceClient, txn);

      return json({
        status: "succeeded",
        credits_added: result.totalCredits,
        package_name: result.packageName,
        final_price: txn.amount,
        original_price: txn.original_price,
        discount_amount: txn.discount_amount,
      });
    }

    // === POST /validate-coupon ===
    // Valida cupom de desconto | Validates discount coupon
    if (req.method === "POST" && path === "validate-coupon") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const coupon_code = sanitize(body.coupon_code, 50);
      const package_id = body.package_id;
      if (!coupon_code) {
        return json({ error: "Missing coupon_code" }, 400);
      }
      if (package_id && !isValidUUID(package_id)) {
        return json({ error: "Invalid package_id" }, 400);
      }

      const { data: coupon } = await serviceClient
        .from("coupons")
        .select("*, profiles!coupons_influencer_id_fkey(full_name)")
        .eq("code", coupon_code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (!coupon) {
        return json({ valid: false, error: "Invalid coupon code" });
      }
      if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        return json({ valid: false, error: "Coupon usage limit reached" });
      }
      if (coupon.expiry_date && new Date(coupon.expiry_date) <= new Date()) {
        return json({ valid: false, error: "Coupon has expired" });
      }

      const result: any = {
        valid: true,
        discount_percent: Number(coupon.discount_percent),
        influencer_name: coupon.profiles?.full_name || null,
      };

      if (package_id) {
        const { data: pkg } = await serviceClient
          .from("credit_packages")
          .select("price, name")
          .eq("id", package_id)
          .single();
        if (pkg) {
          const { originalPrice, discountAmount, finalPrice } =
            calculatePricing(pkg.price, Number(coupon.discount_percent));
          result.price_preview = {
            original_price: originalPrice,
            discount_amount: discountAmount,
            final_price: finalPrice,
            package_name: pkg.name,
          };
        }
      }

      return json(result);
    }

    // === GET /wallet ===
    // Obtém carteira de créditos | Gets credit wallet
    if (req.method === "GET" && path === "wallet") {
      const { data, error } = await serviceClient
        .from("user_credit_wallets")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error) {
        if (error.code === "PGRST116") {
          return json({
            wallet: {
              user_id: userId,
              invoice_remaining: 0,
              estimate_remaining: 0,
              ai_estimate_remaining: 0,
              invoice_unlimited: false,
              estimate_unlimited: false,
              ai_estimate_unlimited: false,
            },
          });
        }
        return safeError("Failed to fetch wallet", 500);
      }
      return json({ wallet: data });
    }

    // === GET /subscription ===
    // Obtém assinatura do usuário | Gets user subscription
    if (req.method === "GET" && path === "subscription") {
      const { data, error } = await serviceClient
        .from("subscriptions")
        .select("*, credit_packages(*)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        return safeError("Failed to fetch subscription", 500);
      }

      if (data) {
        if (data.is_trial && data.trial_end_at) {
          const now = new Date();
          const end = new Date(data.trial_end_at);
          const daysLeft = Math.max(
            0,
            Math.ceil((end.getTime() - now.getTime()) / 86400000),
          );
          (data as any).trial_days_remaining = daysLeft;
        }

        if (data.is_free) {
          (data as any).plan_type = "free";
          (data as any).expiry_in_days = Math.max(
            0,
            Math.ceil(
              (new Date(data.expiry_date).getTime() - new Date().getTime()) /
                86400000,
            ),
          );
        } else {
          (data as any).plan_type = "paid";
        }
      }

      return json({ subscription: data || null });
    }

    // === POST /start-free ===
    // Ativa plano free | Activates free plan
    if (req.method === "POST" && path === "start-free") {
      try {
        // Rate limit específico para free plan | Specific rate limit for free plan
        const clientIP =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";
        const freeRateOk = await checkRateLimit(
          serviceClient,
          `${clientIP}:${userId}`,
          "start-free",
          RATE_LIMITS["start-free"].max,
          RATE_LIMITS["start-free"].window,
        );
        if (!freeRateOk) {
          return safeError("Too many attempts. Please try again later.", 429);
        }

        // Buscar pacote free | Fetch free package
        const { data: freePackage, error: pkgError } = await serviceClient
          .from("credit_packages")
          .select("*")
          .eq("is_free", true)
          .eq("is_active", true)
          .single();

        if (pkgError || !freePackage) {
          return json(
            { error: "Free plan not available. Please contact support." },
            404,
          );
        }

        // Verificar histórico de free plan (mesmo inativo) | Check free plan history (even inactive)
        const { data: freeHistory, error: historyError } = await serviceClient
          .from("subscriptions")
          .select("id, status, created_at, expiry_date")
          .eq("user_id", userId)
          .eq("is_free", true)
          .order("created_at", { ascending: false });

        if (historyError) {
          console.error("Error checking free history:", historyError);
          return safeError("Failed to check eligibility", 500);
        }

        // Verificar se já usou free antes (qualquer status) | Check if used free before (any status)
        if (freeHistory && freeHistory.length > 0) {
          const hasActiveFree = freeHistory.some(
            (s: any) => s.status === "active",
          );
          if (hasActiveFree) {
            return json(
              {
                error: "You already have an active free plan",
                subscription_id: freeHistory[0].id,
              },
              400,
            );
          }

          // Se já usou free antes (mesmo inativo) | If used free before (even inactive)
          return json(
            {
              error: "Free plan already used. This is a one-time offer.",
              used_at: freeHistory[0].created_at,
              message: "Consider our paid plans for continued service.",
            },
            400,
          );
        }

        // Verificar se tem plano pago ativo | Check if has active paid plan
        const { data: existingPaid } = await serviceClient
          .from("subscriptions")
          .select("id, package_id, credit_packages!inner(name)")
          .eq("user_id", userId)
          .eq("is_free", false)
          .eq("is_active", true)
          .maybeSingle();

        if (existingPaid) {
          return json(
            {
              error:
                "You have an active paid plan. Free plan is not available.",
              suggestion: "Cancel your paid plan first to switch to free",
              current_plan: existingPaid.credit_packages?.name || "Unknown",
            },
            400,
          );
        }

        // Ativar plano free | Activate free plan
        const now = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // Desativar outras assinaturas | Deactivate other subscriptions
        await serviceClient
          .from("subscriptions")
          .update({ is_active: false, status: "replaced" })
          .eq("user_id", userId)
          .eq("is_active", true);

        // Criar assinatura free | Create free subscription
        const { data: subscription, error: subError } = await serviceClient
          .from("subscriptions")
          .insert({
            user_id: userId,
            package_id: freePackage.id,
            billing_type: "free",
            template_tier: freePackage.template_tier || "basic",
            is_active: true,
            is_free: true,
            is_trial: false,
            status: "active",
            start_date: now.toISOString(),
            expiry_date: expiryDate.toISOString(),
          })
          .select()
          .single();

        if (subError) {
          console.error("Error creating free subscription:", subError);
          return safeError("Failed to activate free plan", 500);
        }

        // Atualizar wallet | Update wallet
        const { data: existingWallet } = await serviceClient
          .from("user_credit_wallets")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (existingWallet) {
          await serviceClient
            .from("user_credit_wallets")
            .update({
              invoice_remaining:
                existingWallet.invoice_remaining +
                (freePackage.invoice_credits || 0),
              estimate_remaining:
                existingWallet.estimate_remaining +
                (freePackage.estimate_credits || 0),
              ai_estimate_remaining:
                existingWallet.ai_estimate_remaining +
                (freePackage.ai_estimate_credits || 0),
            })
            .eq("user_id", userId);
        } else {
          await serviceClient.from("user_credit_wallets").insert({
            user_id: userId,
            invoice_remaining: freePackage.invoice_credits || 0,
            estimate_remaining: freePackage.estimate_credits || 0,
            ai_estimate_remaining: freePackage.ai_estimate_credits || 0,
            invoice_unlimited: false,
            estimate_unlimited: false,
            ai_estimate_unlimited: false,
          });
        }

        // Atualizar créditos gerais | Update general credits
        const totalCredits =
          (freePackage.invoice_credits || 0) +
          (freePackage.estimate_credits || 0) +
          (freePackage.ai_estimate_credits || 0);

        if (totalCredits > 0) {
          const { data: currentCredits } = await serviceClient
            .from("user_credits")
            .select("balance")
            .eq("user_id", userId)
            .single();

          await serviceClient.from("user_credits").upsert(
            {
              user_id: userId,
              balance: (currentCredits?.balance || 0) + totalCredits,
              updated_at: now.toISOString(),
            },
            { onConflict: "user_id" },
          );
        }

        // Registrar transação | Record transaction
        await serviceClient.from("credit_transactions").insert({
          user_id: userId,
          package_id: freePackage.id,
          transaction_type: "free_plan_activation",
          credits_change: totalCredits,
          amount_paid: 0,
          discount_applied: 0,
        });

        // Log de auditoria | Audit log
        await serviceClient.from("audit_logs").insert({
          user_id: userId,
          action: "free_plan_activated",
          ip_address: clientIP,
          user_agent: req.headers.get("user-agent") || "",
          metadata: {
            package_id: freePackage.id,
            package_name: freePackage.name,
            credits: totalCredits,
          },
        });

        return json({
          success: true,
          message: "Free plan activated successfully! 🎉",
          subscription: {
            id: subscription.id,
            package_name: freePackage.name,
            template_tier: freePackage.template_tier,
            expiry_date: subscription.expiry_date,
          },
          credits: {
            total: totalCredits,
            invoice: freePackage.invoice_credits || 0,
            estimate: freePackage.estimate_credits || 0,
            ai_estimate: freePackage.ai_estimate_credits || 0,
          },
        });
      } catch (error) {
        console.error("[FREE-PLAN] Error:", error);
        return safeError("Failed to activate free plan", 500);
      }
    }

    // === GET /check-free-eligibility ===
    // Verifica elegibilidade para plano free | Checks free plan eligibility
    if (req.method === "GET" && path === "check-free-eligibility") {
      try {
        // Verificar histórico de free plan | Check free plan history
        const { data: freeHistory } = await serviceClient
          .from("subscriptions")
          .select("id, status, created_at, expiry_date")
          .eq("user_id", userId)
          .eq("is_free", true)
          .order("created_at", { ascending: false });

        const hasActiveFree =
          freeHistory?.some((s: any) => s.status === "active") || false;
        const hasUsedFreeBefore = freeHistory && freeHistory.length > 0;

        // Verificar plano pago ativo | Check active paid plan
        const { data: existingPaid } = await serviceClient
          .from("subscriptions")
          .select("id, package_id, credit_packages!inner(name)")
          .eq("user_id", userId)
          .eq("is_free", false)
          .eq("is_active", true)
          .maybeSingle();

        const hasPaidPlan = !!existingPaid;
        const eligible = !hasActiveFree && !hasPaidPlan && !hasUsedFreeBefore;

        return json({
          eligible,
          has_active_free: hasActiveFree,
          has_active_paid: hasPaidPlan,
          used_free_before: hasUsedFreeBefore,
          can_activate: eligible,
          message: eligible
            ? "You are eligible for the free plan"
            : hasActiveFree
              ? "You already have an active free plan"
              : hasPaidPlan
                ? "You have an active paid plan. Free plan is not available."
                : "You have already used the free plan.",
          current_status: {
            free_plan:
              freeHistory && freeHistory.length > 0
                ? {
                    id: freeHistory[0].id,
                    status: freeHistory[0].status,
                    activated_at: freeHistory[0].created_at,
                    expires_at: freeHistory[0].expiry_date,
                  }
                : null,
            paid_plan: existingPaid
              ? {
                  id: existingPaid.id,
                  package_name: existingPaid.credit_packages?.name || "Unknown",
                }
              : null,
            used_free_before: hasUsedFreeBefore,
          },
        });
      } catch (error) {
        console.error("[CHECK-FREE] Error:", error);
        return safeError("Failed to check eligibility", 500);
      }
    }

    // === POST /start-trial ===
    // Inicia trial gratuito | Starts free trial
    if (req.method === "POST" && path === "start-trial") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const { package_id, success_url, cancel_url } = body;
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
      if (!pkg.trial_enabled || !pkg.trial_days) {
        return json({ error: "Trial not available for this package" }, 400);
      }

      const { data: existingTrial } = await serviceClient
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("package_id", package_id)
        .eq("is_trial", true)
        .single();
      if (existingTrial) {
        return json(
          { error: "You have already used a trial for this package" },
          400,
        );
      }

      const stripe = getStripe();

      let customerId: string | undefined;
      if (userEmail) {
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 1,
        });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }

      const interval = pkg.billing_interval === "yearly" ? "year" : "month";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : userEmail,
        payment_method_collection: "always",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: pkg.name },
              unit_amount: Math.round(Number(pkg.price) * 100),
              recurring: { interval },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        subscription_data: {
          trial_period_days: pkg.trial_days,
          metadata: {
            user_id: userId,
            package_id: pkg.id,
            package_name: pkg.name,
            is_trial: "true",
          },
        },
        metadata: {
          user_id: userId,
          package_id: pkg.id,
          flow: "trial",
        },
        success_url:
          success_url ||
          `${req.headers.get("origin") || ""}/payment-success?session_id={CHECKOUT_SESSION_ID}&flow=trial`,
        cancel_url: cancel_url || `${req.headers.get("origin") || ""}/pricing`,
      });

      return json({
        checkout_url: session.url,
        session_id: session.id,
        trial_days: pkg.trial_days,
        package_name: pkg.name,
      });
    }

    // === POST /verify-trial ===
    // Verifica ativação do trial | Verifies trial activation
    if (req.method === "POST" && path === "verify-trial") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const { session_id } = body;
      if (!session_id || typeof session_id !== "string") {
        return json({ error: "Missing session_id" }, 400);
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["subscription"],
      });

      if (session.status !== "complete") {
        return json({
          status: "incomplete",
          message: "Checkout not completed",
        });
      }

      const meta = session.metadata || {};
      const sessionUserId = meta.user_id;
      const packageId = meta.package_id;

      if (!sessionUserId || !packageId) {
        return json({ error: "Invalid session" }, 400);
      }

      if (sessionUserId !== userId) {
        return safeError("Unauthorized", 403);
      }

      const { data: existingSub } = await serviceClient
        .from("subscriptions")
        .select("id")
        .eq("user_id", sessionUserId)
        .eq("package_id", packageId)
        .eq("is_trial", true)
        .single();
      if (existingSub) {
        return json({
          status: "already_processed",
          message: "Trial already activated",
        });
      }

      const { data: pkg } = await serviceClient
        .from("credit_packages")
        .select("*")
        .eq("id", packageId)
        .single();
      if (!pkg) {
        return safeError("Package not found", 404);
      }

      await serviceClient
        .from("subscriptions")
        .update({ is_active: false, status: "replaced" })
        .eq("user_id", sessionUserId)
        .eq("is_active", true);

      const now = new Date();
      const trialEnd = new Date(
        now.getTime() + (pkg.trial_days || 7) * 86400000,
      );

      const stripeSubscription =
        typeof session.subscription === "object" ? session.subscription : null;
      const stripeSubId =
        stripeSubscription?.id || (session.subscription as string) || null;

      await serviceClient.from("subscriptions").insert({
        user_id: sessionUserId,
        package_id: pkg.id,
        billing_type: pkg.billing_interval || "monthly",
        template_tier: pkg.template_tier,
        is_active: true,
        is_trial: true,
        status: "trial",
        stripe_subscription_id: stripeSubId,
        trial_start_at: now.toISOString(),
        trial_end_at: trialEnd.toISOString(),
        start_date: now.toISOString(),
        expiry_date: trialEnd.toISOString(),
      });

      const trialInvoice = pkg.trial_invoice_credits ?? 0;
      const trialEstimate = pkg.trial_estimate_credits ?? 0;
      const trialAiEstimate = pkg.trial_ai_estimate_credits ?? 0;

      const { data: wallet } = await serviceClient
        .from("user_credit_wallets")
        .select("*")
        .eq("user_id", sessionUserId)
        .single();

      if (wallet) {
        await serviceClient
          .from("user_credit_wallets")
          .update({
            invoice_remaining: wallet.invoice_remaining + trialInvoice,
            estimate_remaining: wallet.estimate_remaining + trialEstimate,
            ai_estimate_remaining:
              wallet.ai_estimate_remaining + trialAiEstimate,
            invoice_unlimited: wallet.invoice_unlimited,
            estimate_unlimited: wallet.estimate_unlimited,
            ai_estimate_unlimited: wallet.ai_estimate_unlimited,
          })
          .eq("user_id", sessionUserId);
      }

      return json({
        status: "trial_activated",
        trial_end: trialEnd.toISOString(),
        trial_days: pkg.trial_days,
        package_name: pkg.name,
      });
    }

    // === GET /template-access ===
    // Obtém níveis de acesso a templates | Gets template access levels
    if (req.method === "GET" && path === "template-access") {
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
    // Obtém configurações de créditos | Gets credit configurations
    if (req.method === "GET" && path === "credit-config") {
      const { data, error } = await serviceClient
        .from("credit_action_config")
        .select("action_type, credit_cost, is_active")
        .eq("is_active", true);
      if (error) return safeError("Failed to fetch config", 500);
      return json({ config: data });
    }

    // === POST /consume-credit ===
    // Consome créditos do usuário | Consumes user credits
    if (req.method === "POST" && path === "consume-credit") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const action_type = sanitize(body.action_type, 50);
      const reference_id = body.reference_id
        ? sanitize(body.reference_id, 255)
        : null;
      if (!action_type) {
        return json({ error: "Missing action_type" }, 400);
      }

      const validActions = ["invoice", "estimate", "ai_estimate"];
      if (!validActions.includes(action_type)) {
        return json({ error: "Invalid action type" }, 400);
      }

      const { data: actionConfig } = await serviceClient
        .from("credit_action_config")
        .select("credit_cost, is_active")
        .eq("action_type", action_type)
        .single();

      if (!actionConfig) {
        return json({ error: "Unknown action" }, 400);
      }
      if (!actionConfig.is_active) {
        return json({ error: "Action currently disabled" }, 403);
      }

      const cost = actionConfig.credit_cost;

      // Usar transação para evitar race conditions | Use transaction to avoid race conditions
      const { data: wallet } = await serviceClient
        .from("user_credit_wallets")
        .select("*")
        .eq("user_id", userId)
        .single();

      const bucketMap: Record<
        string,
        { remaining: string; unlimited: string }
      > = {
        invoice: {
          remaining: "invoice_remaining",
          unlimited: "invoice_unlimited",
        },
        estimate: {
          remaining: "estimate_remaining",
          unlimited: "estimate_unlimited",
        },
        ai_estimate: {
          remaining: "ai_estimate_remaining",
          unlimited: "ai_estimate_unlimited",
        },
      };

      const bucket = bucketMap[action_type];

      if (wallet && bucket) {
        const isUnlimited = wallet[
          bucket.unlimited as keyof typeof wallet
        ] as boolean;
        const remaining = wallet[
          bucket.remaining as keyof typeof wallet
        ] as number;

        if (isUnlimited) {
          await serviceClient.from("credit_transactions").insert({
            user_id: userId,
            transaction_type: "consumption",
            credits_change: 0,
            amount_paid: 0,
            reference_id: reference_id || `${action_type}_unlimited`,
          });
          return json({
            success: true,
            credits_deducted: 0,
            remaining_credits: remaining,
            unlimited: true,
          });
        }

        if (remaining >= cost) {
          // Usar update com verificação para evitar race condition
          const { data: updated, error: updateError } = await serviceClient
            .from("user_credit_wallets")
            .update({ [bucket.remaining]: remaining - cost })
            .eq("user_id", userId)
            .eq(bucket.remaining, remaining) // Condição de otimismo
            .select();

          if (updateError || !updated || updated.length === 0) {
            // Race condition detectada - tentar novamente | Race condition detected - retry
            return json(
              {
                error: "Concurrent operation detected. Please try again.",
              },
              409,
            );
          }

          await serviceClient.from("credit_transactions").insert({
            user_id: userId,
            transaction_type: "consumption",
            credits_change: -cost,
            amount_paid: 0,
            reference_id: reference_id || null,
          });

          return json({
            success: true,
            credits_deducted: cost,
            remaining_credits: remaining - cost,
            bucket: action_type,
          });
        }
      }

      // Fallback: legacy pool
      const { data: credits } = await serviceClient
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (!credits || credits.balance < cost) {
        return json(
          {
            error: "Insufficient credits. Please top up.",
            can_generate: false,
            required: cost,
            available: credits?.balance ?? 0,
          },
          402,
        );
      }

      // Usar update com condição otimista | Use optimistic condition update
      const { data: updated, error: updateError } = await serviceClient
        .from("user_credits")
        .update({ balance: credits.balance - cost })
        .eq("user_id", userId)
        .eq("balance", credits.balance) // Condição de otimismo
        .select();

      if (updateError || !updated || updated.length === 0) {
        return json(
          {
            error: "Concurrent operation detected. Please try again.",
          },
          409,
        );
      }

      await serviceClient.from("credit_transactions").insert({
        user_id: userId,
        transaction_type: "consumption",
        credits_change: -cost,
        amount_paid: 0,
        reference_id: reference_id || null,
      });

      return json({
        success: true,
        credits_deducted: cost,
        remaining_credits: credits.balance - cost,
        can_generate: credits.balance - cost >= cost,
      });
    }

    // === POST /invoice-generated (legacy) ===
    // Endpoint legado para geração de faturas | Legacy endpoint for invoice generation
    if (req.method === "POST" && path === "invoice-generated") {
      const { data: actionConfig } = await serviceClient
        .from("credit_action_config")
        .select("credit_cost")
        .eq("action_type", "invoice")
        .eq("is_active", true)
        .single();

      const cost = actionConfig?.credit_cost ?? 1;

      const { data: credits } = await serviceClient
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (!credits || credits.balance < cost) {
        return json(
          { error: "Insufficient credits", can_generate: false },
          402,
        );
      }

      await serviceClient
        .from("user_credits")
        .update({ balance: credits.balance - cost })
        .eq("user_id", userId);

      await serviceClient.from("credit_transactions").insert({
        user_id: userId,
        transaction_type: "consumption",
        credits_change: -cost,
        amount_paid: 0,
        reference_id: null,
      });

      return json({
        success: true,
        remaining_credits: credits.balance - cost,
        can_generate: credits.balance - cost >= cost,
      });
    }

    // === POST /template/send-invoice ===
    // Envia fatura por email | Sends invoice by email
    if (req.method === "POST" && path === "template/send-invoice") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const invoiceId = body.invoice_id;
      const clientIds = body.clients;

      if (!invoiceId || !Array.isArray(clientIds) || clientIds.length === 0) {
        return json({ error: "Missing invoice_id or clients" }, 400);
      }

      const { data: invoice, error: invError } = await serviceClient
        .from("invoices")
        .select("*, clients(*)")
        .eq("id", invoiceId)
        .eq("user_id", userId)
        .single();

      if (invError || !invoice) {
        return json({ error: "Invoice not found" }, 404);
      }

      const { data: clients, error: clientError } = await serviceClient
        .from("clients")
        .select("email")
        .in("id", clientIds);

      if (clientError) {
        return json({ error: "Failed to fetch clients" }, 500);
      }

      const recipients = clients.map((c: any) => c.email).filter(Boolean);
      if (recipients.length === 0) {
        return json({ error: "No valid recipient emails found" }, 400);
      }

      const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
      if (!sendgridKey) {
        return json({ error: "Email service not configured" }, 500);
      }

      const documentUrl = invoice.document_url || invoice.documentUrl;
      if (!documentUrl) {
        return json({ error: "Invoice document not found" }, 404);
      }

      const emailBody = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #1A1E50; color: #fff; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Invoice ${invoice.invoice_number}</h2>
          </div>
          <div style="padding: 24px; line-height: 1.6;">
            <p>Hello,</p>
            <p>Please find your invoice from Constil attached at the link below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${documentUrl}" style="background-color: #448AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Invoice PDF</a>
            </div>
            <p style="font-size: 12px; color: #999;">If the button doesn't work, copy and paste this link: ${documentUrl}</p>
          </div>
          <div style="background-color: #f4f4f4; color: #999; padding: 15px; text-align: center; font-size: 12px;">
            This invoice was sent via Constil Portal.
          </div>
        </div>
      `;

      try {
        const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendgridKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [
              { to: recipients.map((email: string) => ({ email })) },
            ],
            from: { email: "support@constil.com", name: "Constil" },
            subject: `Invoice ${invoice.invoice_number} from Constil`,
            content: [{ type: "text/html", value: emailBody }],
          }),
        });

        if (!sgRes.ok) {
          return json({ error: "Failed to send email" }, 500);
        }

        await serviceClient.from("invoice_mails").insert({
          user_id: userId,
          invoice_id: invoiceId,
          client_ids: clientIds,
          recipient_emails: recipients,
          file_url: documentUrl,
          status: "sent",
        });

        await serviceClient
          .from("invoices")
          .update({ sent_at: new Date().toISOString(), status: "sent" })
          .eq("id", invoiceId);
      } catch (err) {
        console.error("Email send error:", err);
        return json({ error: "Failed to send email" }, 500);
      }

      return json({ success: true, message: "Email sent successfully" });
    }

    // === POST /template/send-estimate ===
    // Envia orçamento por email | Sends estimate by email
    if (req.method === "POST" && path === "template/send-estimate") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return safeError("Invalid request body", 400);
      }

      const estimateId = body.estimate_id;
      const clientIds = body.clients;

      if (!estimateId || !Array.isArray(clientIds) || clientIds.length === 0) {
        return json({ error: "Missing estimate_id or clients" }, 400);
      }

      const { data: estimate, error: estError } = await serviceClient
        .from("estimates")
        .select("*, clients(*)")
        .eq("id", estimateId)
        .eq("user_id", userId)
        .single();

      if (estError || !estimate) {
        return json({ error: "Estimate not found" }, 404);
      }

      const { data: clients, error: clientError } = await serviceClient
        .from("clients")
        .select("email")
        .in("id", clientIds);

      if (clientError) {
        return json({ error: "Failed to fetch clients" }, 500);
      }

      const recipients = clients.map((c: any) => c.email).filter(Boolean);
      if (recipients.length === 0) {
        return json({ error: "No valid recipient emails found" }, 400);
      }

      const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
      if (!sendgridKey) {
        return json({ error: "Email service not configured" }, 500);
      }

      const documentUrl = estimate.document_url || estimate.documentUrl;
      if (!documentUrl) {
        return json({ error: "Estimate document not found" }, 404);
      }

      const emailBody = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #1A1E50; color: #fff; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Estimate ${estimate.estimate_number}</h2>
          </div>
          <div style="padding: 24px; line-height: 1.6;">
            <p>Hello,</p>
            <p>Please find your estimate from Constil attached at the link below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${documentUrl}" style="background-color: #448AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Estimate PDF</a>
            </div>
            <p style="font-size: 12px; color: #999;">If the button doesn't work, copy and paste this link: ${documentUrl}</p>
          </div>
          <div style="background-color: #f4f4f4; color: #999; padding: 15px; text-align: center; font-size: 12px;">
            This estimate was sent via Constil Portal.
          </div>
        </div>
      `;

      try {
        const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendgridKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [
              { to: recipients.map((email: string) => ({ email })) },
            ],
            from: { email: "support@constil.com", name: "Constil" },
            subject: `Estimate ${estimate.estimate_number} from Constil`,
            content: [{ type: "text/html", value: emailBody }],
          }),
        });

        if (!sgRes.ok) {
          return json({ error: "Failed to send email" }, 500);
        }

        await serviceClient.from("estimate_mails").insert({
          user_id: userId,
          estimate_id: estimateId,
          client_ids: clientIds,
          recipient_emails: recipients,
          file_url: documentUrl,
          status: "sent",
        });

        await serviceClient
          .from("estimates")
          .update({ sent_at: new Date().toISOString(), status: "sent" })
          .eq("id", estimateId);
      } catch (err) {
        console.error("Email send error:", err);
        return json({ error: "Failed to send email" }, 500);
      }

      return json({ success: true, message: "Email sent successfully" });
    }

    // Endpoint não encontrado | Endpoint not found
    return safeError("Not found", 404);
  } catch (err) {
    console.error("[USER-API] Error:", (err as Error).message);
    return safeError("Something went wrong", 500);
  }
});
