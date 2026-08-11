import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// === SECURITY HELPERS ===

function sanitize(input: unknown, maxLength = 500): string {
  if (!input || typeof input !== "string") return "";
  return input.replace(/<[^>]*>/g, "").replace(/[<>'"]/g, "").trim().substring(0, maxLength);
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "");
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
  windowSeconds = 60
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

async function resolveDiscount(serviceClient: any, userId: string, couponCode?: string) {
  let discountPercent = 0;
  let couponId: string | null = null;
  let couponCodeResolved: string | null = null;
  let influencerId: string | null = null;
  let managerId: string | null = null;

  if (couponCode) {
    const sanitizedCode = sanitize(couponCode, 50).toUpperCase();
    if (!sanitizedCode) return { discountPercent, couponId, couponCodeResolved, influencerId, managerId };

    const { data: coupon } = await serviceClient
      .from("coupons")
      .select("*, profiles!coupons_influencer_id_fkey(user_id, full_name)")
      .eq("code", sanitizedCode)
      .eq("is_active", true)
      .single();

    if (coupon) {
      const withinLimit = !coupon.usage_limit || coupon.usage_count < coupon.usage_limit;
      const notExpired = !coupon.expiry_date || new Date(coupon.expiry_date) > new Date();
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

  return { discountPercent, couponId, couponCodeResolved, influencerId, managerId };
}

function calculatePricing(price: number, discountPercent: number) {
  const originalPrice = Number(price);
  const discountAmount = Math.round((originalPrice * discountPercent) / 100 * 100) / 100;
  const finalPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);
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
      const newExpiry = currentExpiry > new Date()
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
        invoice_remaining: wallet.invoice_remaining + (pkg.invoice_credits || 0),
        estimate_remaining: wallet.estimate_remaining + (pkg.estimate_credits || 0),
        ai_estimate_remaining: wallet.ai_estimate_remaining + (pkg.ai_estimate_credits || 0),
        invoice_unlimited: pkg.invoice_unlimited || wallet.invoice_unlimited,
        estimate_unlimited: pkg.estimate_unlimited || wallet.estimate_unlimited,
        ai_estimate_unlimited: pkg.ai_estimate_unlimited || wallet.ai_estimate_unlimited,
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

  const totalCredits = (pkg.invoice_credits || 0) + (pkg.estimate_credits || 0) + (pkg.ai_estimate_credits || 0) + (pkg.credit_amount || 0);
  const { data: currentCredits } = await serviceClient
    .from("user_credits")
    .select("balance")
    .eq("user_id", txnUserId)
    .single();
  await serviceClient
    .from("user_credits")
    .update({ balance: (currentCredits?.balance ?? 0) + totalCredits })
    .eq("user_id", txnUserId);

  const { data: sale } = await serviceClient.from("sales").insert({
    total_amount: txn.original_price || pkg.price,
    discount_amount: txn.discount_amount || 0,
    final_amount: txn.amount,
    coupon_id: txn.coupon_id || null,
    customer_user_id: txnUserId,
  }).select().single();

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
        const influencerAmount = Math.round((finalPaid * inflPercent) / 100 * 100) / 100;
        const managerAmount = txn.manager_id
          ? Math.round((finalPaid * mgrPercent) / 100 * 100) / 100
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/user-api\/?/, "");
  const path = rawPath.replace(/^auth\//, "");

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    cleanupRateLimits(serviceClient).catch(() => { });

    // === PUBLIC: GET /packages ===
    if (req.method === "GET" && path === "packages") {
      const { data, error } = await serviceClient
        .from("credit_packages")
        .select("id, name, description, credit_amount, price, billing_type, billing_interval, template_tier, invoice_credits, estimate_credits, ai_estimate_credits, invoice_unlimited, estimate_unlimited, ai_estimate_unlimited, is_active, is_free, trial_enabled, trial_days, created_at")
        .eq("is_active", true)
        .order("price", { ascending: true });
      if (error) return safeError("Failed to fetch packages", 500);
      
      // Separar planos para melhor visualização
      const freePlan = data.find(p => p.is_free === true);
      const paidPlans = data.filter(p => p.is_free !== true);
      
      return json({ 
        packages: data,
        free_plan: freePlan || null,
        paid_plans: paidPlans,
        has_free_plan: !!freePlan
      });
    }

    // === PUBLIC: POST /register === (MESMO CÓDIGO)
    if (req.method === "POST" && path === "register") {
      // ... seu código existente de register
      // (mantido igual ao original)
    }

    // === PUBLIC: POST /login === (MESMO CÓDIGO)
    if (req.method === "POST" && path === "login") {
      // ... seu código existente de login
      // (mantido igual ao original)
    }

    // === PUBLIC: POST /google === (MESMO CÓDIGO)
    if (req.method === "POST" && (path === "google" || path === "auth/google")) {
      // ... seu código existente de google
      // (mantido igual ao original)
    }

    // ===== AUTHENTICATED ENDPOINTS =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return safeError("Unauthorized", 401);
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return safeError("Unauthorized", 401);

    const userId = claimsData.claims.sub as string;

    // Rate limit
    const allowed = await checkRateLimit(serviceClient, userId, path, 120, 60);
    if (!allowed) return safeError("Too many requests", 429);

    // Get user email
    const { data: userProfile } = await serviceClient
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .single();
    const userEmail = userProfile?.email;

    // === GET /credits === (MESMO CÓDIGO)
    if (req.method === "GET" && path === "credits") {
      const { data, error } = await serviceClient
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();
      if (error) return safeError("Failed to fetch credits", 500);
      return json({ credits: data?.balance ?? 0 });
    }

    // === GET /get_profile === (MESMO CÓDIGO)
    if (req.method === "GET" && path === "get_profile") {
      // ... seu código existente
    }

    // === NOVO: POST /start-free ===
    if (req.method === "POST" && path === "start-free") {
      try {
        // Buscar pacote free
        const { data: freePackage, error: pkgError } = await serviceClient
          .from("credit_packages")
          .select("*")
          .eq("is_free", true)
          .eq("is_active", true)
          .single();

        if (pkgError || !freePackage) {
          return json({ 
            error: "Free plan not available. Please contact support." 
          }, 404);
        }

        // Verificar se já tem plano free ativo
        const { data: existingFree } = await serviceClient
          .from("subscriptions")
          .select("id, status")
          .eq("user_id", userId)
          .eq("is_free", true)
          .eq("is_active", true)
          .single();

        if (existingFree) {
          return json({ 
            error: "You already have an active free plan",
            subscription_id: existingFree.id
          }, 400);
        }

        // Verificar se tem plano pago ativo
        const { data: existingPaid } = await serviceClient
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .eq("is_free", false)
          .eq("is_active", true)
          .single();

        if (existingPaid) {
          return json({ 
            error: "You already have a paid plan. Free plan not available.",
            suggestion: "Cancel your paid plan first to switch to free"
          }, 400);
        }

        // Ativar plano free
        const now = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // Desativar outras assinaturas
        await serviceClient
          .from("subscriptions")
          .update({ is_active: false })
          .eq("user_id", userId)
          .eq("is_active", true);

        // Criar assinatura free
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

        // Atualizar wallet
        const { data: existingWallet } = await serviceClient
          .from("user_credit_wallets")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (existingWallet) {
          await serviceClient
            .from("user_credit_wallets")
            .update({
              invoice_remaining: existingWallet.invoice_remaining + (freePackage.invoice_credits || 0),
              estimate_remaining: existingWallet.estimate_remaining + (freePackage.estimate_credits || 0),
              ai_estimate_remaining: existingWallet.ai_estimate_remaining + (freePackage.ai_estimate_credits || 0),
            })
            .eq("user_id", userId);
        } else {
          await serviceClient
            .from("user_credit_wallets")
            .insert({
              user_id: userId,
              invoice_remaining: freePackage.invoice_credits || 0,
              estimate_remaining: freePackage.estimate_credits || 0,
              ai_estimate_remaining: freePackage.ai_estimate_credits || 0,
              invoice_unlimited: false,
              estimate_unlimited: false,
              ai_estimate_unlimited: false,
            });
        }

        // Atualizar créditos gerais
        const totalCredits = (freePackage.invoice_credits || 0) + 
                             (freePackage.estimate_credits || 0) + 
                             (freePackage.ai_estimate_credits || 0);

        if (totalCredits > 0) {
          const { data: currentCredits } = await serviceClient
            .from("user_credits")
            .select("balance")
            .eq("user_id", userId)
            .single();

          await serviceClient
            .from("user_credits")
            .upsert({
              user_id: userId,
              balance: (currentCredits?.balance || 0) + totalCredits,
              updated_at: now.toISOString()
            }, { onConflict: "user_id" });
        }

        // Registrar transação
        await serviceClient.from("credit_transactions").insert({
          user_id: userId,
          package_id: freePackage.id,
          transaction_type: "free_plan_activation",
          credits_change: totalCredits,
          amount_paid: 0,
          discount_applied: 0,
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
          }
        });

      } catch (error) {
        console.error("[FREE-PLAN] Error:", error);
        return safeError("Failed to activate free plan", 500);
      }
    }

    // === NOVO: GET /check-free-eligibility ===
    if (req.method === "GET" && path === "check-free-eligibility") {
      try {
        // Verificar se tem free plan ativo
        const { data: existingFree } = await serviceClient
          .from("subscriptions")
          .select("id, status, created_at")
          .eq("user_id", userId)
          .eq("is_free", true)
          .eq("is_active", true)
          .single();

        // Verificar se tem plano pago ativo
        const { data: existingPaid } = await serviceClient
          .from("subscriptions")
          .select("id, package_id, credit_packages!inner(name)")
          .eq("user_id", userId)
          .eq("is_free", false)
          .eq("is_active", true)
          .maybeSingle();

        // Verificar se já usou free antes
        const { data: usedBefore } = await serviceClient
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .eq("is_free", true)
          .eq("is_active", false)
          .maybeSingle();

        const hasFree = !!existingFree;
        const hasPaid = !!existingPaid;
        const usedFreeBefore = !!usedBefore;
        const eligible = !hasFree && !hasPaid && !usedFreeBefore;

        return json({
          eligible: eligible,
          has_active_free: hasFree,
          has_active_paid: hasPaid,
          used_free_before: usedFreeBefore,
          can_activate: eligible,
          message: eligible 
            ? "You are eligible for the free plan" 
            : hasFree 
              ? "You already have an active free plan"
              : hasPaid 
                ? "You have an active paid plan. Free plan is not available."
                : "You have already used the free plan.",
          current_status: {
            free_plan: existingFree ? {
              id: existingFree.id,
              status: existingFree.status,
              activated_at: existingFree.created_at
            } : null,
            paid_plan: existingPaid ? {
              id: existingPaid.id,
              package_name: existingPaid.credit_packages?.name || "Unknown"
            } : null,
            used_free_before: usedFreeBefore
          }
        });

      } catch (error) {
        console.error("[CHECK-FREE] Error:", error);
        return safeError("Failed to check eligibility", 500);
      }
    }

    // === GET /subscription === (MODIFICADO)
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
          const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
          (data as any).trial_days_remaining = daysLeft;
        }

        if (data.is_free) {
          (data as any).plan_type = "free";
          (data as any).expiry_in_days = Math.max(0, Math.ceil(
            (new Date(data.expiry_date).getTime() - new Date().getTime()) / 86400000
          ));
        } else {
          (data as any).plan_type = "paid";
        }
      }

      return json({ subscription: data || null });
    }

    // === GET /wallet === (MESMO CÓDIGO)
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
              ai_estimate_unlimited: false
            }
          });
        }
        return safeError("Failed to fetch wallet", 500);
      }
      return json({ wallet: data });
    }

    // === POST /start-trial === (MESMO CÓDIGO)
    if (req.method === "POST" && path === "start-trial") {
      // ... seu código existente de start-trial
      // (mantido igual ao original)
    }

    // === POST /create-checkout === (MESMO CÓDIGO)
    if (req.method === "POST" && path === "create-checkout") {
      // ... seu código existente de create-checkout
      // (mantido igual ao original)
    }

    // === POST /verify-trial === (MESMO CÓDIGO)
    if (req.method === "POST" && path === "verify-trial") {
      // ... seu código existente de verify-trial
      // (mantido igual ao original)
    }

    // === POST /consume-credit === (MESMO CÓDIGO)
    if (req.method === "POST" && path === "consume-credit") {
      // ... seu código existente de consume-credit
      // (mantido igual ao original)
    }

    // === GET /template-access === (MESMO CÓDIGO)
    if (req.method === "GET" && path === "template-access") {
      // ... seu código existente
    }

    // === POST /validate-coupon === (MESMO CÓDIGO)
    if (req.method === "POST" && path === "validate-coupon") {
      // ... seu código existente
    }

    return safeError("Not found", 404);
  } catch (err) {
    console.error("[USER-API] Error:", (err as Error).message);
    return safeError("Something went wrong", 500);
  }
});