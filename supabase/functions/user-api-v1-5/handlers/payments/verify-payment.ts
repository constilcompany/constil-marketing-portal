// ============================================================
// handlers/payments/verify-payment.ts
// ⚠️ Mantido como fallback do webhook. Idempotente.
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { getStripe } from "../../_lib/stripe.ts";
import { processSuccessfulPayment } from "../../_lib/credits.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function verifyPaymentHandler(
  ctx: HandlerContext,
): Promise<Response> {
  const { req, serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

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

  if (!txn) return json({ error: "Transaction not found" }, 404);
  if (txn.user_id !== userId) return safeError("Unauthorized", 403);

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
