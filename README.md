# Paybue Viral Growth — User Panel Integration Guide

**Version:** 4.0  
**Last Updated:** 2026-03-25

---
## Overview

This document explains how to integrate the **Subscription Pricing Page** with a monthly/yearly plan toggle on your separate user-facing application. The admin dashboard creates and manages packages; your user panel fetches them via the REST API and renders a pricing UI with Stripe checkout.

---
## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Base URL](#api-base-url)
3. [Fetching Subscription Packages](#fetching-subscription-packages)
4. [Building the Monthly / Yearly Toggle](#building-the-monthly--yearly-toggle)
5. [Rendering Plan Cards](#rendering-plan-cards)
6. [Free Trial Integration](#free-trial-integration)
7. [Coupon Code Validation](#coupon-code-validation)
8. [Creating a Stripe Checkout Session](#creating-a-stripe-checkout-session)
9. [Verifying Payment After Redirect](#verifying-payment-after-redirect)
10. [Checking Active Subscription](#checking-active-subscription)
11. [My Subscription Page (Expiry & Usage)](#my-subscription-page-expiry--usage)
12. [Full Integration Flow](#full-integration-flow)
13. [Data Reference](#data-reference)
14. [Template Tier Access](#template-tier-access)
15. [Error Handling](#error-handling)

---

## Architecture Overview

```
┌─────────────────────┐       ┌─────────────────────┐       ┌──────────────┐
│   Admin Dashboard    │       │   Your User Panel    │       │    Stripe    │
│                      │       │                      │       │              │
│ • Create packages    │       │ • Fetch packages     │       │ • Checkout   │
│ • Set monthly/yearly │──────▶│ • Show toggle UI     │──────▶│ • Payment    │
│ • Set prices/credits │       │ • Apply coupons      │       │ • Redirect   │
│ • Activate/deactivate│       │ • Redirect to Stripe │◀──────│ • Confirm    │
└─────────────────────┘       └─────────────────────┘       └──────────────┘
```

---

## API Base URL

```
https://hasrpxdysyoukmsxveba.supabase.co/functions/v1/user-api
```

All authenticated endpoints require:
```
Authorization: Bearer <access_token>
```

---

## Fetching Subscription Packages

### `GET /packages`

Returns all **active** packages. Filter client-side by `billing_type` and `billing_interval`.

**Request:**
```bash
GET /user-api/packages
```

**Response:**
```json
{
  "packages": [
    {
      "id": "uuid-basic-monthly",
      "name": "Basic",
      "price": 90.00,
      "billing_type": "subscription",
      "billing_interval": "monthly",
      "template_tier": "basic",
      "credit_amount": 1500,
      "invoice_credits": 60,
      "estimate_credits": 60,
      "ai_estimate_credits": 20,
      "invoice_unlimited": false,
      "estimate_unlimited": false,
      "ai_estimate_unlimited": false,
      "trial_enabled": true,
      "trial_days": 14,
      "trial_invoice_credits": 5,
      "trial_estimate_credits": 5,
      "trial_ai_estimate_credits": 2
    },
    {
      "id": "uuid-pro-monthly",
      "name": "Professional",
      "price": 170.00,
      "billing_type": "subscription",
      "billing_interval": "monthly",
      "template_tier": "professional",
      "credit_amount": 3500,
      "invoice_credits": 150,
      "estimate_credits": 150,
      "ai_estimate_credits": 50,
      "invoice_unlimited": false,
      "estimate_unlimited": false,
      "ai_estimate_unlimited": false,
      "trial_enabled": false,
      "trial_days": null,
      "trial_invoice_credits": 0,
      "trial_estimate_credits": 0,
      "trial_ai_estimate_credits": 0
    }
  ]
}
```

---

## Building the Monthly / Yearly Toggle

### Step 1: Fetch & Group Packages

```typescript
// Fetch all packages once
const response = await fetch(`${API_BASE}/packages`);
const { packages } = await response.json();

// Filter to subscription packages only
const subscriptionPackages = packages.filter(p => p.billing_type === 'subscription');

// Group by interval
const monthlyPlans = subscriptionPackages.filter(p => p.billing_interval === 'monthly');
const yearlyPlans  = subscriptionPackages.filter(p => p.billing_interval === 'yearly');
```

### Step 2: Create the Toggle UI

```tsx
const [isYearly, setIsYearly] = useState(false);
const displayedPlans = isYearly ? yearlyPlans : monthlyPlans;

return (
  <div>
    {/* Toggle Switch */}
    <div className="toggle-container">
      <span className={!isYearly ? 'active' : ''}>Monthly</span>
      <label className="switch">
        <input
          type="checkbox"
          checked={isYearly}
          onChange={(e) => setIsYearly(e.target.checked)}
        />
        <span className="slider round"></span>
      </label>
      <span className={isYearly ? 'active' : ''}>Yearly</span>
    </div>

    {/* Savings callout */}
    <p>Save 20% when you choose the Yearly Plan.</p>

    {/* Plan cards */}
    <div className="plans-grid">
      {displayedPlans.map(plan => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  </div>
);
```

### Step 3: Toggle CSS Example

```css
.toggle-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-container span.active {
  font-weight: 600;
  color: #1a1a2e;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
}

.switch input { opacity: 0; width: 0; height: 0; }

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 26px;
}

.slider:before {
  content: "";
  position: absolute;
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider { background-color: #4f46e5; }
input:checked + .slider:before { transform: translateX(24px); }
```

---

## Rendering Plan Cards

Each plan card should display:

| Field | How to Display |
|-------|----------------|
| `name` | Plan title (e.g., "BASIC", "PROFESSIONAL", "ENTERPRISE") |
| `price` | Price with currency: `$90 USD / monthly` |
| `credit_amount` | Total credits: `1,500 CREDITS / MO` |
| `invoice_credits` | Feature line: `- 60 Invoices` |
| `estimate_credits` | Feature line: `- 60 Estimates` |
| `ai_estimate_credits` | Feature line: `- 20 AI Estimates` |
| `invoice_unlimited` | If `true`, show `- Unlimited Invoices` |
| `estimate_unlimited` | If `true`, show `- Unlimited Estimates` |
| `ai_estimate_unlimited` | If `true`, show `- Unlimited AI Estimates` |
| `template_tier` | Map to template count (see below) |

### Template Tier Display

```typescript
const templateDisplay = {
  basic: '3 Invoice & Estimate Templates',
  professional: '8 Invoice & Estimate Templates',
  enterprise: 'All Invoice & Estimate Templates',
};
```

### Example Plan Card Component (React)

```tsx
interface Plan {
  id: string;
  name: string;
  price: number;
  billing_interval: string;
  credit_amount: number;
  invoice_credits: number;
  estimate_credits: number;
  ai_estimate_credits: number;
  invoice_unlimited: boolean;
  estimate_unlimited: boolean;
  ai_estimate_unlimited: boolean;
  template_tier: string;
  trial_enabled: boolean;
  trial_days: number | null;
  trial_invoice_credits: number;
  trial_estimate_credits: number;
  trial_ai_estimate_credits: number;
}

const PlanCard = ({ plan, isPopular, isSelected, onSelect }) => (
  <div
    className={`plan-card ${isSelected ? 'selected' : ''} ${isPopular ? 'popular' : ''}`}
    onClick={() => onSelect(plan.id)}
  >
    {/* Header */}
    <div className="plan-header">
      <h3>{plan.name.toUpperCase()}</h3>
      {isPopular && <span className="badge">Most Popular</span>}
      <div className="price">
        <strong>${plan.price.toFixed(0)} USD</strong>
        <span>/ {plan.billing_interval}</span>
      </div>
      <p className="credits-summary">
        {plan.credit_amount.toLocaleString()} CREDITS / {plan.billing_interval === 'yearly' ? 'YR' : 'MO'}
      </p>
    </div>

    {/* Features */}
    <ul className="features">
      <li>
        ✅ {plan.invoice_unlimited ? 'Unlimited Invoices' : `${plan.invoice_credits} Invoices`}
      </li>
      <li>
        ✅ {plan.estimate_unlimited ? 'Unlimited Estimates' : `${plan.estimate_credits} Estimates`}
      </li>
      <li>
        ✅ {plan.ai_estimate_unlimited ? 'Unlimited AI Estimates' : `${plan.ai_estimate_credits} AI Estimates`}
      </li>
      <li>✅ {templateDisplay[plan.template_tier]}</li>
      <li>✅ Buy 500 Token Top-Up for $35</li>
      {plan.trial_enabled && (
        <li>🎁 {plan.trial_days}-Day Free Trial ({plan.trial_invoice_credits} Invoices, {plan.trial_estimate_credits} Estimates, {plan.trial_ai_estimate_credits} AI Est.)</li>
      )}
    </ul>

    {/* CTA — show trial button if eligible */}
    {plan.trial_enabled && !hasUsedTrial(plan.id) ? (
      <button className="btn-trial" onClick={() => startTrial(plan.id)}>
        Start {plan.trial_days}-Day Free Trial
      </button>
    ) : (
      <button className={isSelected ? 'btn-primary' : 'btn-outline'}>
        {isSelected ? '✓ Selected' : 'SELECT PLAN'}
      </button>
    )}
  </div>
);
```

---

## Free Trial Integration

Packages can optionally include a **free trial period** with **restricted credit limits**. During a trial, the user gets fewer credits than the full paid plan.

### Trial Fields in Package Response

| Field | Type | Description |
|-------|------|-------------|
| `trial_enabled` | boolean | Whether this package offers a free trial |
| `trial_days` | integer \| null | Duration of the trial in days |
| `trial_invoice_credits` | integer | Invoice credits granted during trial (restricted) |
| `trial_estimate_credits` | integer | Estimate credits granted during trial (restricted) |
| `trial_ai_estimate_credits` | integer | AI estimate credits granted during trial (restricted) |

> **Important:** Trial credits are separate from the full package credits. For example, a package might give 60 invoices on the paid plan but only 5 invoices during the trial.

### `POST /start-trial`

Starts a free trial via **Stripe Checkout** in subscription mode. The user enters card details but is **NOT charged** until the trial period ends. After the trial, Stripe **automatically charges** the saved card.

**Request:**
```bash
POST /user-api/start-trial
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "package_id": "uuid-of-selected-plan",
  "success_url": "https://your-app.com/payment-success?session_id={CHECKOUT_SESSION_ID}&flow=trial",
  "cancel_url": "https://your-app.com/pricing"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `package_id` | string | ✅ | The package to start a trial for |
| `success_url` | string | ❌ | Redirect after Stripe checkout |
| `cancel_url` | string | ❌ | Redirect if user cancels |

**Response (200 — Checkout URL returned):**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_...",
  "session_id": "cs_live_...",
  "trial_days": 14,
  "package_name": "Basic"
}
```

**Error (400):**
```json
{ "error": "You have already used a trial for this package" }
```

### `POST /verify-trial`

After the user completes Stripe Checkout, call this endpoint to activate the trial subscription.

**Request:**
```bash
POST /user-api/verify-trial
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "session_id": "cs_live_..."
}
```

**Response (200):**
```json
{
  "status": "trial_activated",
  "trial_end": "2026-04-08T12:00:00Z",
  "trial_days": 14,
  "package_name": "Basic",
  "stripe_subscription_id": "sub_..."
}
```

**What happens server-side:**

| Action | Details |
|--------|---------|
| ✅ Deactivates existing subscription | Replaces any active plan with the trial |
| ✅ Creates trial subscription | `status: 'trial'`, `is_trial: true` |
| ✅ Grants restricted credits | Uses `trial_invoice_credits`, `trial_estimate_credits`, `trial_ai_estimate_credits` (NOT full package credits) |
| ✅ Sets expiry | `trial_end_at = now + trial_days` |
| ❌ No unlimited access | Trials never grant unlimited flags |
| ❌ No charge | Card saved but NOT charged during trial |

### Frontend Implementation

```tsx
const startTrial = async (packageId: string) => {
  const res = await fetch(`${API_BASE}/start-trial`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      package_id: packageId,
      success_url: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&flow=trial`,
      cancel_url: `${window.location.origin}/pricing`,
    }),
  });
  const data = await res.json();

  if (data.checkout_url) {
    // Redirect user to Stripe Checkout (card collection, no charge)
    window.location.href = data.checkout_url;
  } else {
    alert(data.error);
  }
};

// After redirect back from Stripe, verify the trial:
const verifyTrial = async (sessionId: string) => {
  const res = await fetch(`${API_BASE}/verify-trial`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ session_id: sessionId }),
  });
  const data = await res.json();

  if (data.status === 'trial_activated') {
    alert(`Trial started! Ends on ${new Date(data.trial_end).toLocaleDateString()}`);
    // Redirect to dashboard
  }
};
```

### Auto-Charge After Trial Ends

When the trial period ends, **Stripe automatically charges** the saved card:

| Event | What Happens |
|-------|-------------|
| Trial ends → Payment succeeds | Subscription converts to active paid, full credits granted, commissions recorded |
| Trial ends → Payment fails | Subscription marked `past_due`, Stripe retries for several days |
| All retries fail | Stripe cancels subscription, marked `cancelled` in DB |

A **Stripe webhook** (`/functions/v1/stripe-webhook`) handles these events automatically. No manual intervention needed.

### Trial Expiry

Trials are **automatically expired** by a background job that runs hourly. When a trial expires:
- `status` changes from `'trial'` to `'expired'`
- `is_active` becomes `false`
- Credits are **not revoked** (user keeps what remains, but can't renew without upgrading)

### Preventing Abuse

- Users can only start **one trial per package** (enforced server-side)
- If a user has already used a trial for a package, hide the "Start Free Trial" button and show "SELECT PLAN" instead

## Coupon Code Validation

Before checkout, users can apply an influencer coupon code for a discount.

### `POST /validate-coupon`

**Request:**
```bash
POST /user-api/validate-coupon
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "coupon_code": "SAVE20",
  "package_id": "uuid-of-selected-plan"
}
```

**Response (200 — Valid):**
```json
{
  "valid": true,
  "discount_percent": 20,
  "original_price": 170.00,
  "discounted_price": 136.00,
  "influencer_name": "John Doe"
}
```

**Response (200 — Invalid):**
```json
{
  "valid": false,
  "error": "Coupon expired or inactive"
}
```

### Frontend Implementation

```tsx
const [couponCode, setCouponCode] = useState('');
const [discount, setDiscount] = useState(null);

const applyCoupon = async () => {
  const res = await fetch(`${API_BASE}/validate-coupon`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      coupon_code: couponCode,
      package_id: selectedPlanId,
    }),
  });
  const data = await res.json();
  if (data.valid) {
    setDiscount(data);
    alert(`Coupon applied! ${data.discount_percent}% off — You pay $${data.discounted_price}`);
  } else {
    alert(data.error || 'Invalid coupon');
  }
};
```

---

## Creating a Stripe Checkout Session

After the user selects a plan (and optionally applies a coupon), redirect them to Stripe.

### `POST /create-checkout`

**Request:**
```bash
POST /user-api/create-checkout
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "package_id": "uuid-of-selected-plan",
  "billing_type": "subscription",
  "coupon_code": "SAVE20",
  "success_url": "https://yourapp.com/payment-success?session_id={CHECKOUT_SESSION_ID}",
  "cancel_url": "https://yourapp.com/pricing"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `package_id` | string | ✅ | The selected package ID |
| `billing_type` | string | ✅ | `subscription` or `one_time` |
| `coupon_code` | string | ❌ | Influencer coupon code |
| `success_url` | string | ❌ | Redirect URL after successful payment |
| `cancel_url` | string | ❌ | Redirect URL if user cancels |

**Response (200):**
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_live_..."
}
```

### Frontend Implementation

```typescript
const handleCheckout = async (selectedPlanId: string, couponCode?: string) => {
  const response = await fetch(`${API_BASE}/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      package_id: selectedPlanId,
      billing_type: 'subscription',
      coupon_code: couponCode || undefined,
      success_url: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${window.location.origin}/pricing`,
    }),
  });

  const data = await response.json();

  if (data.url) {
    // Redirect user to Stripe Checkout
    window.location.href = data.url;
  } else {
    alert(data.error || 'Failed to start checkout');
  }
};
```

---

## Verifying Payment After Redirect

When Stripe redirects back to your `success_url`, verify the payment:

### `POST /verify-payment`

**Request:**
```bash
POST /user-api/verify-payment
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "session_id": "cs_live_abc123..."
}
```

**Response (200):**
```json
{
  "success": true,
  "credits_added": 3500,
  "subscription_active": true,
  "amount_paid": 136.00
}
```

### Frontend Implementation

```tsx
// On your /payment-success page:
useEffect(() => {
  const sessionId = new URLSearchParams(window.location.search).get('session_id');
  if (sessionId) {
    fetch(`${API_BASE}/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Show success message, redirect to dashboard
        }
      });
  }
}, []);
```

---

## Checking Active Subscription

### `GET /subscription`

**Request:**
```bash
GET /user-api/subscription
Authorization: Bearer <access_token>
```

**Response (200 — Active paid subscription):**
```json
{
  "subscription": {
    "id": "uuid",
    "package_id": "uuid",
    "billing_type": "monthly",
    "start_date": "2026-03-01T00:00:00Z",
    "expiry_date": "2026-04-01T00:00:00Z",
    "is_active": true,
    "is_trial": false,
    "status": "active",
    "template_tier": "professional",
    "credit_packages": {
      "name": "Professional Plan",
      "price": 170.00
    }
  }
}
```

**Response (200 — Active trial):**
```json
{
  "subscription": {
    "id": "uuid",
    "package_id": "uuid",
    "billing_type": "monthly",
    "start_date": "2026-03-25T00:00:00Z",
    "expiry_date": "2026-04-08T00:00:00Z",
    "is_active": true,
    "is_trial": true,
    "status": "trial",
    "trial_start_at": "2026-03-25T00:00:00Z",
    "trial_end_at": "2026-04-08T00:00:00Z",
    "trial_days_remaining": 12,
    "template_tier": "basic",
    "credit_packages": {
      "name": "Basic",
      "price": 90.00
    }
  }
}
```

**Response (200 — No subscription):**
```json
{ "subscription": null }
```

Use this to:
- Highlight the user's current plan with a "Your Plan" badge
- Disable the "Select Plan" button on their current plan
- Show subscription expiry date
- **If `is_trial` is true**: show "Trial ends in X days" countdown and "Upgrade Now" button

---

## My Subscription Page (Expiry & Usage)

Build a dedicated "My Subscription" page so users can see their plan status, expiry, and credit usage at a glance.

### What to Display

| Section | Data Source | Details |
|---------|------------|---------|
| **Plan Name** | `GET /subscription` → `credit_packages.name` | e.g., "Basic" |
| **Expiry Date** | `GET /subscription` → `expiry_date` | Show formatted date |
| **Days Remaining** | Calculate: `expiry_date - now` | Show countdown |
| **Status Badge** | `status` field | `trial`, `active`, or `expired` |
| **Trial Countdown** | `trial_days_remaining` (if `is_trial`) | "Trial ends in 12 days" |
| **Credit Usage** | `GET /wallet` | Show remaining vs allocated per bucket |

### Credit Usage Display (Trial vs Paid)

When the user is on a **trial**, show the **trial credit limits** (not the full package credits):

```tsx
// Determine allocated credits based on trial vs paid
const pkg = subscription.credit_packages;
const isTrial = subscription.is_trial;

const allocatedInvoice = isTrial ? pkg.trial_invoice_credits : pkg.invoice_credits;
const allocatedEstimate = isTrial ? pkg.trial_estimate_credits : pkg.estimate_credits;
const allocatedAi = isTrial ? pkg.trial_ai_estimate_credits : pkg.ai_estimate_credits;

// Get remaining from wallet
const wallet = await fetchWallet(); // GET /wallet

// Display: "3 / 5 Invoice Credits remaining"
const invoiceUsed = allocatedInvoice - wallet.invoice_remaining;
```

### Example UI Layout

```
┌─────────────────────────────────────────────────────┐
│  MY SUBSCRIPTION                                     │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Plan:    │  │ Expires:     │  │ Days Left:     │ │
│  │ Basic    │  │ Apr 8, 2026  │  │ 12 days        │ │
│  └──────────┘  └──────────────┘  └────────────────┘ │
│                                                       │
│  ⚠️ Trial Active — Trial ends in 12 days             │
│  [Upgrade Now]                                        │
│                                                       │
│  ┌─── CREDIT USAGE (Trial Limits) ─────────────────┐│
│  │                                                   ││
│  │  📄 Invoice Credits     3 / 5  remaining         ││
│  │  ████████░░░░░░░░░░░░   (2 used)                ││
│  │                                                   ││
│  │  📊 Estimate Credits    4 / 5  remaining         ││
│  │  ██████░░░░░░░░░░░░░░   (1 used)                ││
│  │                                                   ││
│  │  🤖 AI Estimate Credits 2 / 2  remaining         ││
│  │  ░░░░░░░░░░░░░░░░░░░░   (0 used)                ││
│  │                                                   ││
│  └───────────────────────────────────────────────────┘│
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Frontend Implementation

```tsx
const MySubscriptionPage = () => {
  const [sub, setSub] = useState(null);
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const [subRes, walletRes] = await Promise.all([
        fetch(`${API_BASE}/subscription`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch(`${API_BASE}/wallet`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
      ]);
      const { subscription } = await subRes.json();
      const { wallet } = await walletRes.json();
      setSub(subscription);
      setWallet(wallet);
    };
    fetchData();
  }, []);

  if (!sub) return <p>No active subscription. <a href="/pricing">View Plans</a></p>;

  const now = new Date();
  const expiry = new Date(sub.expiry_date);
  const daysLeft = Math.max(0, Math.ceil((expiry - now) / 86400000));
  const isExpired = expiry <= now;
  const isTrial = sub.is_trial && sub.status === 'trial';

  return (
    <div>
      <h1>My Subscription</h1>

      {/* Plan info */}
      <div>Plan: {sub.credit_packages?.name}</div>
      <div>Expires: {expiry.toLocaleDateString()}</div>
      <div>Days Remaining: {isExpired ? 'Expired' : `${daysLeft} days`}</div>
      <div>Status: {sub.status}</div>

      {/* Trial banner */}
      {isTrial && !isExpired && (
        <div className="trial-banner">
          ⏱ Trial ends in {sub.trial_days_remaining} days
          <button onClick={() => navigate('/pricing')}>Upgrade Now</button>
        </div>
      )}

      {/* Expired banner */}
      {isExpired && (
        <div className="expired-banner">
          ⚠️ Your plan expired on {expiry.toLocaleDateString()}
          <button onClick={() => navigate('/pricing')}>Renew Plan</button>
        </div>
      )}

      {/* Credit usage */}
      <h2>Credit Usage {isTrial ? '(Trial Limits)' : ''}</h2>
      {wallet && (
        <div>
          <CreditBar label="Invoice" remaining={wallet.invoice_remaining} allocated={...} />
          <CreditBar label="Estimate" remaining={wallet.estimate_remaining} allocated={...} />
          <CreditBar label="AI Estimate" remaining={wallet.ai_estimate_remaining} allocated={...} />
        </div>
      )}
    </div>
  );
};
```

---

## Full Integration Flow

```
┌───────────────────────────────────────────────────────────────┐
│                    COMPLETE USER FLOW                         │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. GET /packages                                             │
│     └─ Filter: billing_type === 'subscription'               │
│     └─ Group: billing_interval === 'monthly' | 'yearly'      │
│                                                               │
│  2. User toggles Monthly ⟷ Yearly                           │
│     └─ Re-render cards with filtered plans                   │
│                                                               │
│  3. User selects a plan (clicks "SELECT PLAN")               │
│     └─ Store selected package_id                             │
│                                                               │
│  3a. IF trial_enabled → Show "Start Free Trial" button       │
│      └─ POST /start-trial { package_id }                     │
│      └─ Grants restricted trial credits (NOT full credits)   │
│      └─ Redirect to dashboard → show trial countdown         │
│                                                               │
│  4. (Optional) User enters coupon code                       │
│     └─ POST /validate-coupon                                 │
│     └─ Show discount preview                                 │
│                                                               │
│  5. User clicks "Continue my upgrade"                        │
│     └─ POST /create-checkout                                 │
│     └─ Redirect to Stripe Checkout URL                       │
│                                                               │
│  6. Stripe redirects to success_url                          │
│     └─ POST /verify-payment { session_id }                   │
│     └─ Full credits allocated, subscription activated        │
│                                                               │
│  7. Show success page → redirect to dashboard                │
│     └─ GET /subscription — confirm active plan               │
│     └─ GET /wallet — show updated credit balances            │
│                                                               │
│  8. My Subscription page                                      │
│     └─ GET /subscription — plan, expiry, trial status        │
│     └─ GET /wallet — credit usage per bucket                 │
│     └─ Show trial countdown or expiry warning                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Reference

### Package Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique package UUID |
| `name` | string | Display name (e.g., "Basic", "Professional") |
| `price` | number | Price in USD |
| `billing_type` | string | `subscription` or `one_time` |
| `billing_interval` | string \| null | `monthly` or `yearly` (null for one-time) |
| `credit_amount` | integer | Total credit pool amount |
| `template_tier` | string | `basic`, `professional`, or `enterprise` |
| `invoice_credits` | integer | Invoice bucket allocation (paid plan) |
| `estimate_credits` | integer | Estimate bucket allocation (paid plan) |
| `ai_estimate_credits` | integer | AI estimate bucket allocation (paid plan) |
| `invoice_unlimited` | boolean | Unlimited invoices flag |
| `estimate_unlimited` | boolean | Unlimited estimates flag |
| `ai_estimate_unlimited` | boolean | Unlimited AI estimates flag |
| `trial_enabled` | boolean | Whether this package offers a free trial |
| `trial_days` | integer \| null | Trial duration in days |
| `trial_invoice_credits` | integer | Restricted invoice credits during trial |
| `trial_estimate_credits` | integer | Restricted estimate credits during trial |
| `trial_ai_estimate_credits` | integer | Restricted AI estimate credits during trial |

### Template Tier Hierarchy

| Tier | Accessible Templates | Template Count |
|------|---------------------|----------------|
| `basic` | Basic only | 3 templates |
| `professional` | Basic + Professional | 8 templates |
| `enterprise` | All tiers | All templates |

---

## Template Tier Access

### `GET /template-access`

```bash
GET /user-api/template-access
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "tier": "professional",
  "templates": ["basic", "professional"]
}
```

Use this to gate which email templates are available to the user.

---

## Error Handling

All errors return:
```json
{ "error": "Human-readable error message" }
```

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad request / missing fields |
| 401 | Unauthorized / invalid token |
| 402 | Insufficient credits |
| 403 | Action disabled by admin |
| 500 | Internal server error |

---

## Admin Package Setup

For the monthly/yearly toggle to work, the admin must create **paired packages**:

1. Go to **Dashboard → Packages → Add Package**
2. Create a **monthly** subscription (e.g., "Basic" at $90/mo)
3. Create a **yearly** subscription with the same name (e.g., "Basic" at $864/yr — 20% savings)
4. Repeat for each tier (Professional, Enterprise)

The user panel groups packages by `name` and switches between `billing_interval` values.

---

## Quick Start Checklist

- [ ] Fetch packages via `GET /packages`
- [ ] Filter by `billing_type === 'subscription'`
- [ ] Group by `billing_interval` (`monthly` / `yearly`)
- [ ] Build toggle switch UI
- [ ] Render plan cards with features
- [ ] Add coupon input with `POST /validate-coupon`
- [ ] Wire "Select Plan" → `POST /create-checkout` → Stripe redirect
- [ ] Build `/payment-success` page with `POST /verify-payment`
- [ ] Check active subscription via `GET /subscription`
- [ ] Highlight current plan, show expiry date
- [ ] Show "Start Free Trial" button for trial-enabled packages (`POST /start-trial`)
- [ ] Build "My Subscription" page with expiry, trial countdown, and credit usage
- [ ] Handle trial expiry (show upgrade prompt when trial expires)

---

*This document is for internal team use. Do not share API keys, tokens, or base URLs publicly.*
