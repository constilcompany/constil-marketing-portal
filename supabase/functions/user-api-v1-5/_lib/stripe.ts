// ============================================================
// _lib/stripe.ts - Helpers Stripe e pricing
// ============================================================

import Stripe from "https://esm.sh/stripe@18.5.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitize } from "./validation.ts";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-11-20.acacia",
    });
  }
  return _stripe;
}

export interface DiscountResult {
  discountPercent: number;
  couponId: string | null;
  couponCodeResolved: string | null;
  influencerId: string | null;
  managerId: string | null;
}

export async function resolveDiscount(
  serviceClient: SupabaseClient,
  userId: string,
  couponCode?: string,
): Promise<DiscountResult> {
  const empty: DiscountResult = {
    discountPercent: 0,
    couponId: null,
    couponCodeResolved: null,
    influencerId: null,
    managerId: null,
  };

  if (!couponCode) return empty;

  const sanitizedCode = sanitize(couponCode, 50).toUpperCase();
  if (!sanitizedCode) return empty;

  const { data: coupon } = await serviceClient
    .from("coupons")
    .select("*, profiles!coupons_influencer_id_fkey(user_id, full_name)")
    .eq("code", sanitizedCode)
    .eq("is_active", true)
    .single();

  if (!coupon) return empty;

  const withinLimit =
    !coupon.usage_limit || coupon.usage_count < coupon.usage_limit;
  const notExpired =
    !coupon.expiry_date || new Date(coupon.expiry_date) > new Date();

  if (!withinLimit || !notExpired) return empty;

  let managerId: string | null = null;
  if (coupon.influencer_id) {
    const { data: link } = await serviceClient
      .from("manager_influencers")
      .select("manager_id")
      .eq("influencer_id", coupon.influencer_id)
      .single();
    managerId = link?.manager_id ?? null;
  }

  return {
    discountPercent: Number(coupon.discount_percent),
    couponId: coupon.id,
    couponCodeResolved: coupon.code,
    influencerId: coupon.influencer_id,
    managerId,
  };
}

export function calculatePricing(price: number, discountPercent: number) {
  const originalPrice = Number(price);
  const discountAmount =
    Math.round(((originalPrice * discountPercent) / 100) * 100) / 100;
  const finalPrice = Math.max(
    0,
    Math.round((originalPrice - discountAmount) * 100) / 100,
  );
  return { originalPrice, discountAmount, finalPrice };
}