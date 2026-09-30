// ============================================================
// user-api-v1/index.ts - Entry point final
// ============================================================

import { optionsResponse, safeError } from "./_lib/response.ts";
import {
  getServiceClient,
  requireAuth,
  requireAdmin,
  getClientIP,
  AuthError,
} from "./_lib/auth/supabase.ts";
import { checkRateLimit, cleanupRateLimits } from "./_lib/rate-limit.ts";
import { RATE_LIMITS, PUBLIC_ENDPOINTS } from "./_lib/config.ts";
import type { Handler, HandlerContext } from "./_lib/types.ts";

// ---------- Auth ----------
import {
  registerHandler,
  loginHandler,
  googleHandler,
  sendSignupOtpHandler,
  verifyOtpHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from "./handlers/auth/index.ts";

// ---------- Packages ----------
import { getPackagesHandler } from "./handlers/packages/index.ts";

// ---------- Profile ----------
import {
  getProfileHandler,
  listInvoicesHandler,
} from "./handlers/profile/index.ts";

// ---------- Credits ----------
import {
  getCreditsHandler,
  getWalletHandler,
  consumeCreditHandler,
  creditConfigHandler,
} from "./handlers/credits/index.ts";

// ---------- Subscriptions ----------
import {
  getSubscriptionHandler,
  startFreeHandler,
  checkFreeEligibilityHandler,
  startTrialHandler,
  verifyTrialHandler,
  templateAccessHandler,
} from "./handlers/subscriptions/index.ts";

// ---------- Payments ----------
import {
  createCheckoutHandler,
  verifyPaymentHandler,
  validateCouponHandler,
  stripeWebhookHandler,
} from "./handlers/payments/index.ts";

// ---------- SendGrid (DESABILITADO) ----------
// Apenas o health check fica ativo (útil para monitoramento).
import { sendgridHealthHandler } from "./handlers/sendgrid/index.ts";

// Os imports abaixo estão DESABILITADOS.
// Para reativar: descomente todo o bloco abaixo e o bloco de rotas SendGrid.
// import {
//   sendgridStatusHandler,
//   sendgridSendHandler,
//   sendgridSendRealHandler,
//   sendgridOtpHandler,
//   sendgridEstimateHandler,
//   sendgridInvoiceHandler,
//   sendgridProposalHandler,
//   sendgridWelcomeHandler,
//   sendgridResetPasswordHandler,
//   sendgridConfirmHandler,
//   sendgridNotificationHandler,
//   sendgridSimpleHandler,
//   sendgridBulkHandler,
// } from "./handlers/sendgrid/index.ts";

// ============================================================
// ROUTES
// ============================================================

interface RouteDef {
  handler: Handler;
  protected: boolean;
  admin?: boolean;
  webhook?: boolean;
}

const ROUTES: Record<string, RouteDef> = {
  // ========== Públicas ==========
  "GET /packages": { handler: getPackagesHandler, protected: false },
  "POST /register": { handler: registerHandler, protected: false },
  "POST /login": { handler: loginHandler, protected: false },
  "POST /google": { handler: googleHandler, protected: false },
  "POST /auth/google": { handler: googleHandler, protected: false },
  "POST /send-signup-otp": { handler: sendSignupOtpHandler, protected: false },
  "POST /verify-otp": { handler: verifyOtpHandler, protected: false },
  "POST /forgot-password": { handler: forgotPasswordHandler, protected: false },
  "POST /reset-password": { handler: resetPasswordHandler, protected: false },
  "GET /sendgrid/health": { handler: sendgridHealthHandler, protected: false },

  // ========== Stripe webhook ==========
  "POST /stripe-webhook": {
    handler: stripeWebhookHandler,
    protected: false,
    webhook: true,
  },

  // ========== Autenticadas ==========
  "GET /credits": { handler: getCreditsHandler, protected: true },
  "GET /get_profile": { handler: getProfileHandler, protected: true },
  "GET /list_invoices": { handler: listInvoicesHandler, protected: true },
  "GET /wallet": { handler: getWalletHandler, protected: true },
  "GET /subscription": { handler: getSubscriptionHandler, protected: true },
  "GET /credit-config": { handler: creditConfigHandler, protected: true },
  "GET /template-access": { handler: templateAccessHandler, protected: true },
  "GET /check-free-eligibility": {
    handler: checkFreeEligibilityHandler,
    protected: true,
  },

  "POST /create-checkout": { handler: createCheckoutHandler, protected: true },
  "POST /verify-payment": { handler: verifyPaymentHandler, protected: true },
  "POST /validate-coupon": { handler: validateCouponHandler, protected: true },
  "POST /consume-credit": { handler: consumeCreditHandler, protected: true },
  "POST /start-free": { handler: startFreeHandler, protected: true },
  "POST /start-trial": { handler: startTrialHandler, protected: true },
  "POST /verify-trial": { handler: verifyTrialHandler, protected: true },

  // ========== SendGrid (DESABILITADO) ==========
  // Rotas desativadas temporariamente.
  //
  // Para reativar:
  //   1. Descomente os imports SendGrid no topo do arquivo
  //   2. Descomente as rotas abaixo
  //   3. Rode `deno check index.ts`
  //   4. Faça deploy
  //
  // "GET /sendgrid/status": {
  //   handler: sendgridStatusHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/send": {
  //   handler: sendgridSendHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/send-real": {
  //   handler: sendgridSendRealHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/otp": {
  //   handler: sendgridOtpHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/estimate": {
  //   handler: sendgridEstimateHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/invoice": {
  //   handler: sendgridInvoiceHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/proposal": {
  //   handler: sendgridProposalHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/welcome": {
  //   handler: sendgridWelcomeHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/reset-password": {
  //   handler: sendgridResetPasswordHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/confirm": {
  //   handler: sendgridConfirmHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/notification": {
  //   handler: sendgridNotificationHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/simple": {
  //   handler: sendgridSimpleHandler,
  //   protected: true,
  //   admin: true,
  // },
  // "POST /sendgrid/bulk": {
  //   handler: sendgridBulkHandler,
  //   protected: true,
  //   admin: true,
  // },
};

// ============================================================
// SERVE — versão com logs + fix do path
// ============================================================

Deno.serve(async (req) => {
  const T0 = Date.now();
  const rid = Math.random().toString(36).substring(2, 8);

  console.log(`\n🚀 [${rid}] ========== NOVA REQUEST ==========`);
  console.log(`📍 [${rid}] Method: ${req.method}`);
  console.log(`📍 [${rid}] URL completa: ${req.url}`);

  // ---------- 1. OPTIONS (CORS preflight) ----------
  if (req.method === "OPTIONS") {
    console.log(`✅ [${rid}] OPTIONS (preflight) → retornando headers CORS`);
    return optionsResponse();
  }

  // ---------- 2. Path parsing (ROBUSTO) ----------
  const url = new URL(req.url);
  let rawPath = url.pathname;
  console.log(`🔍 [${rid}] url.pathname original: "${rawPath}"`);

  // Caso 1: URL no formato /functions/v1/<fn-name>/<path>
  const fnMatch = rawPath.match(/^\/functions\/v1\/[^/]+\/?(.*)$/);
  if (fnMatch) {
    rawPath = fnMatch[1];
    console.log(`🔍 [${rid}] Modo: /functions/v1/<fn>/ → "${rawPath}"`);
  } else {
    // Caso 2: URL no formato /user-api.../<path> (legado)
    const legacyMatch = rawPath.match(/^\/user-api[^/]*\/?(.*)$/);
    if (legacyMatch) {
      rawPath = legacyMatch[1];
      console.log(`🔍 [${rid}] Modo: /user-api.../ → "${rawPath}"`);
    } else {
      // Caso 3: URL já limpa, só remove barras iniciais
      rawPath = rawPath.replace(/^\/+/, "");
      console.log(`🔍 [${rid}] Modo: path limpo → "${rawPath}"`);
    }
  }

  console.log(`🔍 [${rid}] Após normalização: "${rawPath}"`);

  const path = rawPath.replace(/^auth\//, "");
  console.log(`🔍 [${rid}] Path final: "${path}"`);

  // ⚠️ IMPORTANTE: adiciona "/" antes do path para bater com o formato do ROUTES
  const routeKey = `${req.method} /${path}`;
  console.log(`🎯 [${rid}] routeKey procurado: "${routeKey}"`);

  // ---------- 3. Client setup ----------
  const serviceClient = getServiceClient();
  const clientIP = getClientIP(req);
  console.log(`🌐 [${rid}] Client IP: ${clientIP}`);

  cleanupRateLimits(serviceClient).catch((e: unknown) => {
    console.warn(`⚠️ [${rid}] cleanupRateLimits erro:`, (e as Error)?.message);
  });

  try {
    // ---------- 4. Route lookup ----------
    const route = ROUTES[routeKey];
    if (!route) {
      console.log(`❌ [${rid}] ROTA NÃO ENCONTRADA: "${routeKey}"`);
      console.log(
        `📋 [${rid}] Rotas disponíveis (primeiras 20):`,
        Object.keys(ROUTES).slice(0, 20),
      );
      console.log(
        `🔎 [${rid}] Existe rota com mesmo path?`,
        Object.keys(ROUTES).filter((k) => k.endsWith(path)),
      );
      return safeError("Not found", 404);
    }

    console.log(
      `✅ [${rid}] Rota encontrada. protected=${route.protected}, admin=${route.admin ?? false}, webhook=${route.webhook ?? false}`,
    );

    // ---------- 5. Webhook do Stripe (sem auth) ----------
    if (route.webhook) {
      console.log(`🔔 [${rid}] É webhook → skip auth/rate-limit`);
      const ctx: HandlerContext = {
        req,
        url,
        path,
        method: req.method,
        serviceClient,
        userId: null,
        userEmail: null,
        clientIP,
      };
      const res = await route.handler(ctx);
      console.log(
        `🏁 [${rid}] Webhook respondeu ${res.status} em ${Date.now() - T0}ms`,
      );
      return res;
    }

    // ---------- 6. Rate limit (rotas públicas) ----------
    const rlConfig = RATE_LIMITS[path] || { max: 120, window: 60 };
    console.log(
      `⏱️ [${rid}] Rate limit config: max=${rlConfig.max}, window=${rlConfig.window}s`,
    );

    if (!route.protected) {
      console.log(`⏱️ [${rid}] Rota pública → checando rate limit por IP`);
      const ok = await checkRateLimit(
        serviceClient,
        `${clientIP}:${path}`,
        path,
        rlConfig.max,
        rlConfig.window,
      );
      console.log(`⏱️ [${rid}] Rate limit permitido? ${ok}`);
      if (!ok) return safeError("Too many requests", 429);
    }

    // ---------- 7. Auth ----------
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (route.protected) {
      console.log(
        `🔐 [${rid}] Rota protegida → ${route.admin ? "requireAdmin" : "requireAuth"}`,
      );

      const hasAuthHeader = !!req.headers.get("Authorization");
      console.log(
        `🔐 [${rid}] Authorization header presente? ${hasAuthHeader}`,
      );

      try {
        const authCtx = route.admin
          ? await requireAdmin(req, serviceClient)
          : await requireAuth(req, serviceClient);
        userId = authCtx.userId;
        userEmail = authCtx.email;
        console.log(
          `🔐 [${rid}] Autenticado: userId=${userId}, email=${userEmail}`,
        );
      } catch (err) {
        if (err instanceof AuthError) {
          console.log(
            `🔐 [${rid}] AuthError: ${err.message} (status=${err.status})`,
          );
          return safeError(err.message, err.status);
        }
        console.error(`🔐 [${rid}] Erro de auth inesperado:`, err);
        throw err;
      }

      console.log(`⏱️ [${rid}] Checando rate limit por userId=${userId}`);
      const ok = await checkRateLimit(
        serviceClient,
        userId,
        path,
        rlConfig.max,
        rlConfig.window,
      );
      console.log(`⏱️ [${rid}] Rate limit permitido? ${ok}`);
      if (!ok) return safeError("Too many requests", 429);
    }

    // ---------- 8. Executa handler ----------
    const ctx: HandlerContext = {
      req,
      url,
      path,
      method: req.method,
      serviceClient,
      userId,
      userEmail,
      clientIP,
    };

    console.log(`▶️  [${rid}] Executando handler...`);
    const res = await route.handler(ctx);
    console.log(
      `🏁 [${rid}] Handler respondeu status=${res.status} em ${Date.now() - T0}ms`,
    );
    return res;
  } catch (err) {
    const errMsg = (err as Error).message;
    const errStack = (err as Error).stack;
    console.error(`💥 [${rid}] ERRO NÃO TRATADO: ${errMsg}`);
    console.error(`💥 [${rid}] Stack: ${errStack}`);
    return safeError("Something went wrong", 500);
  }
});
