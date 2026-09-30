// ============================================================
// _lib/credits.ts - Lógica de créditos e pagamentos
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Processa um pagamento bem-sucedido: adiciona créditos, atualiza
 * subscription, gera comissões. Idempotente via `payment_transactions.status`.
 */
export async function processSuccessfulPayment(
  serviceClient: SupabaseClient,
  txn: any,
) {
  const txnUserId = txn.user_id;

  const { data: pkg } = await serviceClient
    .from("credit_packages")
    .select("*")
    .eq("id", txn.package_id)
    .single();
  if (!pkg) throw new Error("Package not found");

  // Incrementa uso do cupom
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

  // Atribuição de influencer
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

  // Subscription (se aplicável)
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

  // Wallet
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

  // Saldo geral
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

  // Sale
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

  // Comissões
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