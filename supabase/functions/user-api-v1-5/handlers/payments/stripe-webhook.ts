// ============================================================
// handlers/payments/stripe-webhook.ts - ⚠️ NOVO E CRÍTICO
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { getStripe } from "../../_lib/stripe.ts";
import { processSuccessfulPayment } from "../../_lib/credits.ts";
import type { HandlerContext } from "../../_lib/types.ts";

/**
 * Webhook do Stripe. REQUER `STRIPE_WEBHOOK_SECRET` configurado.
 * Este é o ÚNICO ponto confiável para ativar pagamentos.
 */
export async function stripeWebhookHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient } = ctx;

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return safeError("Missing signature", 400);
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return safeError("Invalid signature", 400);
  }

  console.log(`[Stripe Webhook] ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Fluxo trial
        if (session.metadata?.flow === "trial") {
          // Delega para verify-trial logic (ou processa direto)
          return json({ received: true, flow: "trial" });
        }

        // Pagamento one-time
        const { data: txn } = await serviceClient
          .from("payment_transactions")
          .select("*")
          .eq("stripe_payment_intent_id", session.id)
          .single();

        if (!txn) {
          console.warn(`Transaction not found for session ${session.id}`);
          return json({ received: true });
        }

        if (txn.status === "succeeded") {
          return json({ received: true, already_processed: true });
        }

        await serviceClient
          .from("payment_transactions")
          .update({ status: "succeeded" })
          .eq("id", txn.id);

        await processSuccessfulPayment(serviceClient, txn);
        return json({ received: true });
      }

      case "invoice.paid": {
        // Renovação de subscription
        const invoice = event.data.object;
        console.log(`Subscription renewed: ${invoice.subscription}`);
        return json({ received: true });
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await serviceClient
          .from("subscriptions")
          .update({ is_active: false, status: "canceled" })
          .eq("stripe_subscription_id", sub.id);
        return json({ received: true });
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return safeError("Webhook processing failed", 500);
  }
}