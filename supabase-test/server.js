// server.js - Versão COMPLETA com Service Role Key
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ============================================================
// SUPABASE - PRODUÇÃO (COM SERVICE ROLE)
// ============================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Credenciais do Supabase não configuradas!");
  process.exit(1);
}

// Criar cliente com SERVICE_ROLE_KEY para bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    },
  },
});

console.log("✅ Conectado ao Supabase (Produção) com Service Role");

// ============================================================
// CONSTANTES
// ============================================================
const PLAN_CHOICES = {
  1: "FREE",
  2: "BASIC_PLAN",
  3: "PROFESSIONAL",
  4: "ENTERPRISE",
};
const BILLING_CYCLE = { 0: "MONTHLY", 1: "YEARLY" };
const BILLING_CYCLE_REVERSE = { MONTHLY: 0, YEARLY: 1 };

const getPlanName = (code) => PLAN_CHOICES[code] || "FREE";
const getBillingCycle = (code) => BILLING_CYCLE[code] || "MONTHLY";
const toFloat = (v) => parseFloat(v) || 0;
const toInt = (v) => parseInt(v) || 0;

const getTemplateTier = (plan) => {
  if (!plan) return "free";
  if (plan.enterprise_templates) return "enterprise";
  if (plan.professional_templates) return "professional";
  if (plan.basic_templates) return "basic";
  return "free";
};

// ============================================================
// MAPPERS
// ============================================================
const mapPlan = (plan) => {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name || "FREE",
    price: toFloat(plan.price),
    billing_cycle: plan.billing_interval || "monthly",
    invoice_limit: toInt(plan.invoice_credits || 0),
    estimate_limit: toInt(plan.estimate_credits || 0),
    client_limit: 0,
    product_limit: 0,
    blue_print_limit: toInt(plan.credit_amount || 0),
    basic_templates: plan.template_tier === "basic" || true,
    professional_templates: plan.template_tier === "professional" || false,
    enterprise_templates: plan.template_tier === "enterprise" || false,
    template_tier: plan.template_tier || "basic",
    invoice_credits: toInt(plan.invoice_credits || 0),
    estimate_credits: toInt(plan.estimate_credits || 0),
    ai_estimate_credits: toInt(plan.ai_estimate_credits || 0),
    invoice_unlimited: plan.invoice_unlimited || false,
    estimate_unlimited: plan.estimate_unlimited || false,
    credit_amount:
      toInt(plan.credit_amount || 0) +
      toInt(plan.invoice_credits || 0) +
      toInt(plan.estimate_credits || 0),
    trial_days: plan.trial_days || 7,
    is_active: plan.is_active !== false,
  };
};

const mapSubscription = (sub) => {
  if (!sub) return null;
  const plan = sub.credit_packages;
  return {
    id: sub.id,
    user_id: sub.user_id,
    plan_id: sub.package_id,
    is_active: sub.is_active || false,
    start_date: sub.created_at || sub.start_date,
    end_date: sub.expiry_date,
    billing_cycle: sub.billing_type || "monthly",
    package_name: plan ? plan.name : "FREE",
    package_price: plan ? toFloat(plan.price) : 0,
    template_tier: plan ? plan.template_tier || "basic" : "basic",
    is_trial: sub.is_trial || false,
    expiry_date: sub.expiry_date,
    status: sub.status || (sub.is_active ? "active" : "inactive"),
  };
};

const mapWallet = (wallet) => {
  if (!wallet) {
    return {
      invoice_remaining: 0,
      estimate_remaining: 0,
      client_remaining: 0,
      product_remaining: 0,
      blue_print_remaining: 0,
      invoice_unlimited: false,
      estimate_unlimited: false,
      client_unlimited: false,
      product_unlimited: false,
      blue_print_unlimited: false,
      basic_templates: false,
      professional_templates: false,
      enterprise_templates: false,
    };
  }
  return {
    invoice_remaining: toInt(wallet.invoice_remaining || wallet.invoice || 0),
    estimate_remaining: toInt(
      wallet.estimate_remaining || wallet.estimate || 0,
    ),
    client_remaining: toInt(wallet.client_remaining || wallet.client || 0),
    product_remaining: toInt(wallet.product_remaining || wallet.product || 0),
    blue_print_remaining: toInt(
      wallet.blue_print_remaining || wallet.blue_print || 0,
    ),
    invoice_unlimited: wallet.invoice_unlimited || false,
    estimate_unlimited: wallet.estimate_unlimited || false,
    client_unlimited: wallet.client_unlimited || false,
    product_unlimited: wallet.product_unlimited || false,
    blue_print_unlimited: wallet.blue_print_unlimited || false,
    basic_templates: wallet.basic_templates || false,
    professional_templates: wallet.professional_templates || false,
    enterprise_templates: wallet.enterprise_templates || false,
  };
};

// ============================================================
// PLANOS PREDEFINIDOS
// ============================================================
const PREDEFINED_PLANS = [
  {
    name: "FREE",
    price: 0,
    credit_amount: 0,
    invoice_credits: 0,
    estimate_credits: 0,
    ai_estimate_credits: 0,
    invoice_unlimited: false,
    estimate_unlimited: false,
    ai_estimate_unlimited: false,
    billing_type: "subscription",
    billing_interval: "monthly",
    template_tier: "basic",
    trial_enabled: true,
    trial_days: 7,
    trial_invoice_credits: 5,
    trial_estimate_credits: 5,
    trial_ai_estimate_credits: 1,
    is_active: true,
  },
  {
    name: "BASIC_PLAN",
    price: 99,
    credit_amount: 30,
    invoice_credits: 20,
    estimate_credits: 15,
    ai_estimate_credits: 3,
    invoice_unlimited: false,
    estimate_unlimited: false,
    ai_estimate_unlimited: false,
    billing_type: "subscription",
    billing_interval: "monthly",
    template_tier: "basic",
    trial_enabled: true,
    trial_days: 7,
    trial_invoice_credits: 5,
    trial_estimate_credits: 5,
    trial_ai_estimate_credits: 1,
    is_active: true,
  },
  {
    name: "PROFESSIONAL",
    price: 199,
    credit_amount: 60,
    invoice_credits: 40,
    estimate_credits: 30,
    ai_estimate_credits: 8,
    invoice_unlimited: false,
    estimate_unlimited: false,
    ai_estimate_unlimited: false,
    billing_type: "subscription",
    billing_interval: "monthly",
    template_tier: "professional",
    trial_enabled: true,
    trial_days: 14,
    trial_invoice_credits: 10,
    trial_estimate_credits: 8,
    trial_ai_estimate_credits: 3,
    is_active: true,
  },
  {
    name: "ENTERPRISE",
    price: 399,
    credit_amount: 150,
    invoice_credits: 150,
    estimate_credits: 80,
    ai_estimate_credits: 20,
    invoice_unlimited: true,
    estimate_unlimited: true,
    ai_estimate_unlimited: true,
    billing_type: "subscription",
    billing_interval: "monthly",
    template_tier: "enterprise",
    trial_enabled: true,
    trial_days: 21,
    trial_invoice_credits: 30,
    trial_estimate_credits: 20,
    trial_ai_estimate_credits: 5,
    is_active: true,
  },
];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
async function getOrCreateSubscription(userId, planId, billingType) {
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const interval = billingType === "yearly" ? 365 : 30;
  const expiryDate = new Date(Date.now() + interval * 86400000);

  if (existingSub) {
    const { data } = await supabase
      .from("subscriptions")
      .update({
        package_id: planId,
        billing_type: billingType,
        expiry_date: expiryDate.toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSub.id)
      .select("*, credit_packages(*)")
      .single();
    return data;
  } else {
    const { data } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        package_id: planId,
        billing_type: billingType,
        expiry_date: expiryDate.toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select("*, credit_packages(*)")
      .single();
    return data;
  }
}

async function updateWallet(userId, plan) {
  const walletData = {
    invoice_remaining: toInt(plan.invoice_credits || 0),
    estimate_remaining: toInt(plan.estimate_credits || 0),
    ai_estimate_remaining: toInt(plan.ai_estimate_credits || 0),
    invoice_unlimited: plan.invoice_unlimited || false,
    estimate_unlimited: plan.estimate_unlimited || false,
    ai_estimate_unlimited: plan.ai_estimate_unlimited || false,
  };

  const { data: existingWallet } = await supabase
    .from("user_credit_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingWallet) {
    const { data } = await supabase
      .from("user_credit_wallets")
      .update({
        invoice_remaining:
          (existingWallet.invoice_remaining || 0) +
          walletData.invoice_remaining,
        estimate_remaining:
          (existingWallet.estimate_remaining || 0) +
          walletData.estimate_remaining,
        ai_estimate_remaining:
          (existingWallet.ai_estimate_remaining || 0) +
          walletData.ai_estimate_remaining,
        invoice_unlimited:
          walletData.invoice_unlimited || existingWallet.invoice_unlimited,
        estimate_unlimited:
          walletData.estimate_unlimited || existingWallet.estimate_unlimited,
        ai_estimate_unlimited:
          walletData.ai_estimate_unlimited ||
          existingWallet.ai_estimate_unlimited,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select("*")
      .single();
    return data;
  } else {
    const { data } = await supabase
      .from("user_credit_wallets")
      .insert({
        user_id: userId,
        ...walletData,
      })
      .select("*")
      .single();
    return data;
  }
}

// ============================================================
// ENDPOINTS
// ============================================================

// ROTA PRINCIPAL
app.get("/", async (req, res) => {
  try {
    const { data } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });
    const plans = (data || []).map(mapPlan);
    res.render("index", {
      title: "🧪 Gerenciador de Planos",
      plans: plans.length > 0 ? plans : PREDEFINED_PLANS.map(mapPlan),
    });
  } catch (error) {
    console.error("Erro ao carregar planos:", error.message);
    res.render("index", {
      title: "🧪 Gerenciador de Planos",
      plans: PREDEFINED_PLANS.map(mapPlan),
    });
  }
});

// 1. LISTAR USUÁRIOS
app.get("/api/users", async (req, res) => {
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "user_id, full_name, email, company_name, phone, avatar_url, created_at, first_name, last_name",
      );

    if (profilesError) {
      console.error("❌ Erro ao buscar profiles:", profilesError.message);
      return res
        .status(500)
        .json({ success: false, error: profilesError.message });
    }

    console.log(`📊 Encontrados ${profiles?.length || 0} perfis`);

    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("*, credit_packages(*)")
      .eq("is_active", true);

    const { data: wallets } = await supabase
      .from("user_credit_wallets")
      .select("*");

    const users = (profiles || []).map((profile) => {
      const sub = (subscriptions || []).find(
        (s) => s.user_id === profile.user_id,
      );
      const wallet = (wallets || []).find((w) => w.user_id === profile.user_id);

      let fullName = profile.full_name;
      if (!fullName || fullName === "") {
        const firstName = profile.first_name || "";
        const lastName = profile.last_name || "";
        fullName = `${firstName} ${lastName}`.trim();
        if (!fullName) fullName = profile.email || "N/A";
      }

      return {
        user_id: profile.user_id,
        email: profile.email || "N/A",
        full_name: fullName,
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        company_name: profile.company_name || "",
        phone: profile.phone || "",
        avatar_url: profile.avatar_url || "",
        created_at: profile.created_at,
        has_plan: !!sub,
        subscription: sub ? mapSubscription(sub) : null,
        wallet: mapWallet(wallet),
      };
    });

    res.json({
      success: true,
      data: {
        total: users.length,
        with_plans: users.filter((u) => u.has_plan).length,
        without_plans: users.filter((u) => !u.has_plan).length,
        users,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao listar usuários:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. VERIFICAR PLANO DO USUÁRIO
app.get("/api/users/:userId/plan", async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "user_id, full_name, email, company_name, phone, avatar_url, first_name, last_name",
      )
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    let fullName = profile.full_name;
    if (!fullName || fullName === "") {
      const firstName = profile.first_name || "";
      const lastName = profile.last_name || "";
      fullName = `${firstName} ${lastName}`.trim();
      if (!fullName) fullName = profile.email || "N/A";
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*, credit_packages(*)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    const { data: wallet } = await supabase
      .from("user_credit_wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    res.json({
      success: true,
      data: {
        user: {
          id: profile.user_id,
          email: profile.email || "N/A",
          full_name: fullName,
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          company_name: profile.company_name || "",
          phone: profile.phone || "",
          avatar_url: profile.avatar_url || "",
        },
        has_plan: !!subscription,
        subscription: subscription ? mapSubscription(subscription) : null,
        wallet: mapWallet(wallet),
      },
    });
  } catch (error) {
    console.error("❌ Erro ao buscar plano do usuário:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. LISTAR PLANOS
app.get("/api/packages", async (req, res) => {
  try {
    const { data } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });
    res.json({ success: true, data: (data || []).map(mapPlan) });
  } catch (error) {
    console.error("Erro ao listar planos:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. ATRIBUIR PLANO
app.post("/api/assign-plan", async (req, res) => {
  const { user_id, package_id, billing_type = "monthly", amount } = req.body;

  if (!user_id || !package_id) {
    return res
      .status(400)
      .json({ error: "user_id e package_id são obrigatórios" });
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .eq("user_id", user_id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const { data: plan } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", package_id)
      .eq("is_active", true)
      .single();

    if (!plan) {
      return res.status(404).json({ error: "Plano não encontrado ou inativo" });
    }

    const subscription = await getOrCreateSubscription(
      user_id,
      package_id,
      billing_type,
    );

    const wallet = await updateWallet(user_id, plan);

    try {
      await supabase.from("credit_transactions").insert({
        user_id,
        package_id: plan.id,
        transaction_type: "purchase",
        credits_change:
          toInt(plan.credit_amount || 0) +
          toInt(plan.invoice_credits || 0) +
          toInt(plan.estimate_credits || 0),
        amount_paid: amount || plan.price,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("⚠️ Erro ao registrar transação:", e.message);
    }

    res.json({
      success: true,
      message: `Plano "${plan.name}" atribuído com sucesso`,
      data: {
        user: {
          id: profile.user_id,
          email: profile.email,
          name: profile.full_name || profile.email,
        },
        package: {
          id: plan.id,
          name: plan.name,
          price: toFloat(plan.price),
          billing_type,
          template_tier: plan.template_tier || "basic",
        },
        subscription: mapSubscription(subscription),
        wallet: mapWallet(wallet),
        credits_added:
          toInt(plan.credit_amount || 0) +
          toInt(plan.invoice_credits || 0) +
          toInt(plan.estimate_credits || 0),
      },
    });
  } catch (error) {
    console.error("❌ Erro ao atribuir plano:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. REVOGAR PLANO
app.post("/api/users/:userId/revoke-plan", async (req, res) => {
  const { userId } = req.params;
  const { reason = "Revogado manualmente" } = req.body;

  try {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*, credit_packages(*)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!subscription) {
      return res.status(400).json({ error: "Usuário não possui plano ativo" });
    }

    await supabase
      .from("subscriptions")
      .update({
        is_active: false,
        status: "revoked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    res.json({
      success: true,
      message: "Plano revogado com sucesso",
      data: {
        user_id: userId,
        revoked_plan: {
          id: subscription.id,
          name: subscription.credit_packages?.name || "Unknown",
          reason,
          revoked_at: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("❌ Erro ao revogar plano:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. ESTATÍSTICAS DE USUÁRIOS
app.get("/api/users/stats", async (req, res) => {
  try {
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("count", { count: "exact", head: true });

    const { count: usersWithPlans } = await supabase
      .from("subscriptions")
      .select("count", { count: "exact", head: true })
      .eq("is_active", true);

    const { data: planDistribution } = await supabase
      .from("subscriptions")
      .select("package_id, credit_packages(name)")
      .eq("is_active", true);

    const planStats = {};
    (planDistribution || []).forEach((sub) => {
      const name = sub.credit_packages?.name || "Unknown";
      planStats[name] = (planStats[name] || 0) + 1;
    });

    const { data: wallets } = await supabase
      .from("user_credit_wallets")
      .select("invoice_remaining, estimate_remaining");

    let totalInvoice = 0,
      totalEstimate = 0;
    (wallets || []).forEach((w) => {
      totalInvoice += toInt(w.invoice_remaining);
      totalEstimate += toInt(w.estimate_remaining);
    });

    res.json({
      success: true,
      data: {
        total_users: totalUsers || 0,
        users_with_plans: usersWithPlans || 0,
        users_without_plans: (totalUsers || 0) - (usersWithPlans || 0),
        plan_distribution: planStats,
        conversion_rate:
          totalUsers > 0
            ? (((usersWithPlans || 0) / totalUsers) * 100).toFixed(2) + "%"
            : "0%",
        credits: {
          total_invoice_credits: totalInvoice,
          total_estimate_credits: totalEstimate,
          total_ai_credits: 0,
          users_with_unlimited: 0,
        },
      },
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. ESTATÍSTICAS GERAIS
app.get("/api/stats", async (req, res) => {
  try {
    const { count: packages } = await supabase
      .from("credit_packages")
      .select("count", { count: "exact", head: true })
      .eq("is_active", true);

    const { count: subscriptions } = await supabase
      .from("subscriptions")
      .select("count", { count: "exact", head: true })
      .eq("is_active", true);

    const { count: wallets } = await supabase
      .from("user_credit_wallets")
      .select("count", { count: "exact", head: true });

    res.json({
      success: true,
      data: {
        packages: packages || 0,
        subscriptions: subscriptions || 0,
        wallets: wallets || 0,
        coupons: 0,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. STATUS
app.get("/api/status", async (req, res) => {
  try {
    const { error } = await supabase
      .from("profiles")
      .select("count", { count: "exact", head: true });
    res.json({
      success: true,
      data: {
        connected: !error,
        message: error ? "❌ Erro" : "✅ Conectado",
        url: supabaseUrl,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.json({
      success: false,
      data: {
        connected: false,
        message: "❌ Falha na conexão",
        error: error.message,
      },
    });
  }
});

// 9. SEED PLANOS
app.post("/api/packages/seed", async (req, res) => {
  try {
    const { count } = await supabase
      .from("credit_packages")
      .select("count", { count: "exact", head: true });

    if (count > 0) {
      return res.json({
        success: true,
        message: `⚠️ Já existem ${count} planos. Use "Limpar Planos" primeiro.`,
        existing: count,
      });
    }

    let inserted = 0;
    for (const plan of PREDEFINED_PLANS) {
      const { error } = await supabase.from("credit_packages").insert({
        ...plan,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (!error) inserted++;
    }

    res.json({
      success: true,
      message: `${inserted} planos inseridos com sucesso`,
      inserted,
    });
  } catch (error) {
    console.error("Erro ao inserir planos:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. LIMPAR PLANOS
app.delete("/api/packages/clear", async (req, res) => {
  try {
    await supabase
      .from("subscriptions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("credit_transactions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("user_credit_wallets")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("credit_packages")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    res.json({
      success: true,
      message: "Todos os planos e dados relacionados foram removidos",
    });
  } catch (error) {
    console.error("Erro ao limpar planos:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. RESET COMPLETO
app.post("/api/packages/reset", async (req, res) => {
  try {
    await supabase
      .from("subscriptions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("credit_transactions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("user_credit_wallets")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("credit_packages")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    let inserted = 0;
    for (const plan of PREDEFINED_PLANS) {
      const { error } = await supabase.from("credit_packages").insert({
        ...plan,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (!error) inserted++;
    }

    res.json({
      success: true,
      message: `Reset completo! ${inserted} planos inseridos`,
      inserted,
    });
  } catch (error) {
    console.error("Erro ao resetar:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 12. USUÁRIOS COM PLANOS
app.get("/api/users/with-plans", async (req, res) => {
  try {
    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("*, credit_packages(*), profiles(*)")
      .eq("is_active", true);

    const users = (subscriptions || []).map((sub) => ({
      user_id: sub.user_id,
      email: sub.profiles?.email || "N/A",
      full_name:
        sub.profiles?.full_name ||
        sub.profiles?.first_name + " " + sub.profiles?.last_name ||
        "N/A",
      company_name: sub.profiles?.company_name || "N/A",
      has_plan: true,
      plan: {
        id: sub.package_id,
        name: sub.credit_packages?.name || "Unknown",
        price: sub.credit_packages?.price || 0,
        template_tier: sub.credit_packages?.template_tier || "basic",
        billing_type: sub.billing_type || "monthly",
        is_trial: sub.is_trial || false,
        expiry_date: sub.expiry_date,
        status: sub.status || "active",
      },
    }));

    res.json({
      success: true,
      data: { total: users.length, users },
    });
  } catch (error) {
    console.error("Erro ao listar usuários com planos:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 13. USUÁRIOS SEM PLANOS
app.get("/api/users/without-plans", async (req, res) => {
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, company_name, first_name, last_name");

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("is_active", true);

    const usersWithPlansIds = new Set((subs || []).map((s) => s.user_id));

    const users = (profiles || [])
      .filter((p) => !usersWithPlansIds.has(p.user_id))
      .map((p) => {
        let fullName = p.full_name;
        if (!fullName || fullName === "") {
          fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
          if (!fullName) fullName = p.email || "N/A";
        }
        return {
          user_id: p.user_id,
          email: p.email || "N/A",
          full_name: fullName,
          company_name: p.company_name || "",
        };
      });

    res.json({
      success: true,
      data: { total: users.length, users },
    });
  } catch (error) {
    console.error("Erro ao listar usuários sem planos:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 14. LOGS (SSE)
app.get("/api/logs/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const interval = setInterval(() => res.write(`: heartbeat\n\n`), 30000);
  req.on("close", () => clearInterval(interval));
});

// 15. LIMPAR LOGS
app.delete("/api/logs/clear", (req, res) => {
  res.json({ success: true });
});

// 16. EXPIRAR TRIALS
app.post("/api/expire-trials", async (req, res) => {
  try {
    console.log("🔄 Verificando trials expirados...");

    const { data: expiredTrials, error } = await supabase
      .from("subscriptions")
      .select(
        `
        id,
        user_id,
        package_id,
        expiry_date,
        credit_packages (
          name,
          price,
          invoice_credits,
          estimate_credits,
          ai_estimate_credits
        )
      `,
      )
      .eq("is_active", true)
      .eq("is_trial", true)
      .lt("expiry_date", new Date().toISOString());

    if (error) {
      console.error("❌ Erro ao buscar trials:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    if (expiredTrials.length === 0) {
      return res.json({
        success: true,
        expired_count: 0,
        message: "Nenhum trial expirado encontrado",
      });
    }

    const expiredIds = expiredTrials.map((t) => t.id);

    await supabase
      .from("subscriptions")
      .update({
        is_active: false,
        status: "expired",
        updated_at: new Date().toISOString(),
      })
      .in("id", expiredIds);

    console.log(`✅ ${expiredIds.length} trials expirados com sucesso`);

    res.json({
      success: true,
      expired_count: expiredIds.length,
      expired_ids: expiredIds,
      message: `${expiredIds.length} trials expirados com sucesso`,
    });
  } catch (error) {
    console.error("❌ Erro ao expirar trials:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 17. BUSCAR LOGS DE EXPIRAÇÃO
app.get("/api/expiry-logs", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("transaction_type", "consumption")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("Erro ao buscar logs:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 18. RESETAR WALLET DO USUÁRIO
app.post("/api/users/:userId/reset-wallet", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data: wallet } = await supabase
      .from("user_credit_wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!wallet) {
      return res.status(404).json({ error: "Wallet não encontrada" });
    }

    await supabase
      .from("user_credit_wallets")
      .update({
        invoice_remaining: 0,
        estimate_remaining: 0,
        ai_estimate_remaining: 0,
        invoice_unlimited: false,
        estimate_unlimited: false,
        ai_estimate_unlimited: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    res.json({
      success: true,
      message: "Wallet resetada com sucesso",
      user_id: userId,
    });
  } catch (error) {
    console.error("Erro ao resetar wallet:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 19. FORÇAR TRIAL
app.post("/api/users/:userId/force-trial", async (req, res) => {
  const { userId } = req.params;
  const { plan_id, days = 14 } = req.body;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    let planId = plan_id;
    if (!planId) {
      const { data: freePlan } = await supabase
        .from("credit_packages")
        .select("id")
        .eq("name", "FREE")
        .single();
      if (freePlan) planId = freePlan.id;
    }

    if (!planId) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }

    await supabase
      .from("subscriptions")
      .update({ is_active: false })
      .eq("user_id", userId);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        package_id: planId,
        is_active: true,
        is_trial: true,
        status: "trial",
        billing_type: "monthly",
        expiry_date: expiryDate.toISOString(),
        created_at: new Date().toISOString(),
      })
      .select("*, credit_packages(*)")
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `Trial de ${days} dias ativado`,
      data: {
        user_id: userId,
        subscription: mapSubscription(subscription),
        trial_end: expiryDate.toISOString(),
        days: days,
      },
    });
  } catch (error) {
    console.error("❌ Erro ao forçar trial:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// 🆕 ENDPOINT: ATIVAR PLANO DIRETAMENTE
// ============================================================
app.post("/api/activate-plan", async (req, res) => {
  const { user_id, package_id, billing_type = "monthly", days = 30 } = req.body;

  if (!user_id || !package_id) {
    return res.status(400).json({
      success: false,
      error: "❌ user_id e package_id são obrigatórios",
    });
  }

  try {
    console.log(`🔍 Verificando usuário: ${user_id}`);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, first_name, last_name, company_name")
      .eq("user_id", user_id)
      .single();

    if (profileError || !profile) {
      console.error("❌ Usuário não encontrado:", profileError?.message);
      return res.status(404).json({
        success: false,
        error: "❌ Usuário não encontrado. Verifique o user_id.",
      });
    }

    console.log(
      `✅ Usuário encontrado: ${profile.email || profile.full_name || user_id}`,
    );

    console.log(`🔍 Verificando plano: ${package_id}`);

    const { data: plan, error: planError } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", package_id)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      console.error("❌ Plano não encontrado:", planError?.message);
      return res.status(404).json({
        success: false,
        error: "❌ Plano não encontrado ou inativo. Verifique o package_id.",
      });
    }

    console.log(`✅ Plano encontrado: ${plan.name} - $${plan.price}`);

    console.log(`🔄 Desativando assinaturas existentes...`);
    await supabase
      .from("subscriptions")
      .update({
        is_active: false,
        status: "replaced",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user_id)
      .eq("is_active", true);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    console.log(`📅 Data de expiração: ${expiryDate.toISOString()}`);

    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: user_id,
        package_id: package_id,
        billing_type: billing_type,
        expiry_date: expiryDate.toISOString(),
        is_active: true,
        is_trial: false,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*, credit_packages(*)")
      .single();

    if (subError) {
      console.error("❌ Erro ao criar assinatura:", subError.message);
      return res.status(500).json({
        success: false,
        error: `❌ Erro ao criar assinatura: ${subError.message}`,
      });
    }

    console.log(`✅ Assinatura criada: ${subscription.id}`);

    console.log(`🔄 Atualizando wallet...`);

    const walletData = {
      invoice_remaining: toInt(plan.invoice_credits || 0),
      estimate_remaining: toInt(plan.estimate_credits || 0),
      ai_estimate_remaining: toInt(plan.ai_estimate_credits || 0),
      invoice_unlimited: plan.invoice_unlimited || false,
      estimate_unlimited: plan.estimate_unlimited || false,
      ai_estimate_unlimited: plan.ai_estimate_unlimited || false,
    };

    const { data: existingWallet } = await supabase
      .from("user_credit_wallets")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    let wallet;
    if (existingWallet) {
      const { data: updatedWallet } = await supabase
        .from("user_credit_wallets")
        .update({
          invoice_remaining:
            (existingWallet.invoice_remaining || 0) +
            walletData.invoice_remaining,
          estimate_remaining:
            (existingWallet.estimate_remaining || 0) +
            walletData.estimate_remaining,
          ai_estimate_remaining:
            (existingWallet.ai_estimate_remaining || 0) +
            walletData.ai_estimate_remaining,
          invoice_unlimited:
            walletData.invoice_unlimited || existingWallet.invoice_unlimited,
          estimate_unlimited:
            walletData.estimate_unlimited || existingWallet.estimate_unlimited,
          ai_estimate_unlimited:
            walletData.ai_estimate_unlimited ||
            existingWallet.ai_estimate_unlimited,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user_id)
        .select("*")
        .single();
      wallet = updatedWallet;
      console.log(`✅ Wallet atualizada (existente)`);
    } else {
      const { data: newWallet } = await supabase
        .from("user_credit_wallets")
        .insert({
          user_id: user_id,
          ...walletData,
        })
        .select("*")
        .single();
      wallet = newWallet;
      console.log(`✅ Wallet criada (nova)`);
    }

    console.log(`🔄 Registrando transação...`);

    const totalCredits =
      toInt(plan.credit_amount || 0) +
      toInt(plan.invoice_credits || 0) +
      toInt(plan.estimate_credits || 0);

    await supabase.from("credit_transactions").insert({
      user_id: user_id,
      package_id: plan.id,
      transaction_type: "purchase",
      credits_change: totalCredits,
      amount_paid: plan.price,
      created_at: new Date().toISOString(),
    });

    console.log(`✅ Transação registrada: +${totalCredits} créditos`);

    const response = {
      success: true,
      message: `✅ Plano "${plan.name}" ativado com sucesso para o usuário ${profile.email || profile.full_name || user_id}`,
      data: {
        user: {
          id: profile.user_id,
          email: profile.email || "N/A",
          full_name:
            profile.full_name ||
            `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
            "N/A",
          company_name: profile.company_name || "",
        },
        plan: {
          id: plan.id,
          name: plan.name,
          price: toFloat(plan.price),
          billing_type: billing_type,
          template_tier: plan.template_tier || "basic",
          invoice_credits: toInt(plan.invoice_credits || 0),
          estimate_credits: toInt(plan.estimate_credits || 0),
          ai_estimate_credits: toInt(plan.ai_estimate_credits || 0),
          credit_amount: toInt(plan.credit_amount || 0),
          invoice_unlimited: plan.invoice_unlimited || false,
          estimate_unlimited: plan.estimate_unlimited || false,
          ai_estimate_unlimited: plan.ai_estimate_unlimited || false,
        },
        subscription: {
          id: subscription.id,
          user_id: subscription.user_id,
          plan_id: subscription.package_id,
          is_active: subscription.is_active,
          billing_type: subscription.billing_type,
          expiry_date: subscription.expiry_date,
          created_at: subscription.created_at,
        },
        wallet: {
          invoice_remaining: wallet?.invoice_remaining || 0,
          estimate_remaining: wallet?.estimate_remaining || 0,
          ai_estimate_remaining: wallet?.ai_estimate_remaining || 0,
          invoice_unlimited: wallet?.invoice_unlimited || false,
          estimate_unlimited: wallet?.estimate_unlimited || false,
          ai_estimate_unlimited: wallet?.ai_estimate_unlimited || false,
        },
        credits_added: totalCredits,
        activated_at: new Date().toISOString(),
        expires_at: expiryDate.toISOString(),
        days: days,
      },
    };

    console.log(`🎉 Plano ativado com sucesso!`);
    res.json(response);
  } catch (error) {
    console.error("❌ Erro ao ativar plano:", error);
    res.status(500).json({
      success: false,
      error: `❌ Erro interno: ${error.message}`,
    });
  }
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Simulador rodando em http://localhost:${PORT}`);
  console.log(`📊 Usando tabelas EXISTENTES do banco de dados`);
  console.log(
    `📦 Tabelas: credit_packages, subscriptions, user_credit_wallets, profiles`,
  );
  console.log(`\n📋 ENDPOINTS PRINCIPAIS:`);
  console.log(`  GET  /api/users              - Todos os usuários`);
  console.log(`  GET  /api/users/:userId/plan - Plano de um usuário`);
  console.log(`  POST /api/assign-plan        - Atribuir plano`);
  console.log(`  POST /api/activate-plan      - 🆕 Ativar plano direto`);
  console.log(`  POST /api/users/:userId/revoke-plan - Revogar plano`);
  console.log(`  GET  /api/packages           - Listar planos`);
  console.log(`  POST /api/packages/seed      - Inserir planos`);
  console.log(`  DELETE /api/packages/clear   - Limpar planos`);
  console.log(`\n📋 ENDPOINTS DE TRIALS:`);
  console.log(`  POST /api/expire-trials      - Expirar trials`);
  console.log(`  POST /api/users/:userId/force-trial - Forçar trial`);
  console.log(`  POST /api/users/:userId/reset-wallet - Resetar wallet`);
  console.log(`${"=".repeat(60)}\n`);
});
