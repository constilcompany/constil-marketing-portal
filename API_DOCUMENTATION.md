# Paybue Viral Growth Ecosystem — REST API Documentation

**Version:** 11.1  
**Last Updated:** 2026-04-21

---

## Base URLs

| Service | Base URL |
|---------|----------|
| Supabase REST | `https://avppbvsxayehguepyjkb.supabase.co/rest/v1` |
| Supabase Auth | `https://avppbvsxayehguepyjkb.supabase.co/auth/v1` |
| Supabase Storage | `https://avppbvsxayehguepyjkb.supabase.co/storage/v1` |
| User API (custom edge fn) | `https://avppbvsxayehguepyjkb.supabase.co/functions/v1/user-api` |
| Stripe Webhook | `https://avppbvsxayehguepyjkb.supabase.co/functions/v1/stripe-webhook` |
| Support Query | `https://avppbvsxayehguepyjkb.supabase.co/functions/v1/submit-support-query` |

**Public anon key (safe to ship in frontend):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3Njk5NDIsImV4cCI6MjA4NjM0NTk0Mn0.Uf-7y4OWh2sYEqit7p6dZ4FzO7oV6fT_uB-hYfAnS6Y
```

All Supabase REST/Auth/Storage requests require both headers:
```
apikey: <anon_key>
Authorization: Bearer <user_access_token_or_anon_key>
```

---

## Table of Contents

1. [Authentication & Sessions](#authentication--sessions)
2. [Security Architecture](#security-architecture)
3. [User API — Public Endpoints](#user-api--public-endpoints)
   - [GET /packages](#get-packages)
   - [POST /register](#post-register)
   - [POST /login](#post-login)
   - [POST /send-signup-otp](#post-send-signup-otp)
   - [POST /forgot-password](#post-forgot-password)
   - [POST /verify-otp](#post-verify-otp)
   - [POST /reset-password](#post-reset-password)
   - [POST /auth/google](#post-authgoogle)
   - [POST /submit-support-query](#post-submit-support-query)
4. [User API — Authenticated Endpoints](#user-api--authenticated-endpoints)
   - [GET /credits](#get-credits)
   - [GET /wallet](#get-wallet)
   - [GET /subscription](#get-subscription)
   - [GET /template-access](#get-template-access)
   - [GET /credit-config](#get-credit-config)
   - [POST /create-checkout](#post-create-checkout)
   - [POST /verify-payment](#post-verify-payment)
   - [POST /validate-coupon](#post-validate-coupon)
   - [POST /start-trial](#post-start-trial)
   - [POST /verify-trial](#post-verify-trial)
   - [POST /consume-credit](#post-consume-credit)
   - [POST /invoice-generated](#post-invoice-generated-legacy)
5. [Subscription Pricing Page Integration](#subscription-pricing-page-integration)
   - [Monthly / Yearly Toggle](#monthly--yearly-toggle)
   - [Rendering Plan Cards](#rendering-plan-cards)
   - [Coupon Code Flow](#coupon-code-flow)
   - [Full Coupon Discount Checkout Flow (Step-by-Step)](#full-coupon-discount-checkout-flow-step-by-step)
   - [Checkout & Payment Flow](#checkout--payment-flow)
6. [Business Management Resources (Direct Supabase REST)](#business-management-resources-direct-supabase-rest)
   - [Auth & Headers](#auth--headers)
   - [Company Profile](#company-profile)
   - [Company Legal Info](#company-legal-info)
   - [Clients](#clients)
   - [Products](#products)
   - [Taxes](#taxes)
   - [Discounts](#discounts)
   - [Invoices](#invoices)
   - [Invoice Items](#invoice-items)
   - [Invoice Item Taxes / Discounts](#invoice-item-taxes--discounts)
   - [Invoice PDFs](#invoice-pdfs)
   - [Invoice Mails](#invoice-mails)
   - [Invoice Template Locks](#invoice-template-locks)
   - [Estimates](#estimates)
   - [Estimate Items](#estimate-items)
   - [Estimate PDFs / Mails / Locks](#estimate-pdfs--mails--locks)
   - [AI Invoices](#ai-invoices)
   - [AI Estimates & Results](#ai-estimates--results)
   - [Storage Buckets](#storage-buckets)
   - [Enums Reference](#enums-reference)
6. [Integration Flows](#integration-flows)
7. [Error Handling](#error-handling)
8. [Security Notes](#security-notes)
9. [Admin Dashboard Endpoints](#admin-dashboard-endpoints)

---

## Authentication & Sessions

### Token-Based Authentication

All **authenticated endpoints** require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The `access_token` is obtained from the `POST /login` endpoint.

### Session Lifecycle

The system maintains server-side sessions for security and audit:

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Login   │────▶│ Create       │────▶│ Active       │────▶│ Logout       │
│          │     │ Session      │     │ Session      │     │              │
└──────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                   │
                                                                   ▼
                                                            ┌──────────────┐
                                                            │ Invalidate   │
                                                            │ All Sessions │
                                                            │ Clear Storage│
                                                            └──────────────┘
```

**On Login:**
- A `sessions` record is created with `user_id`, `is_active: true`, `ip_address`, and `user_agent`.
- The `session_id` is stored in `sessionStorage` on the client.

**On Logout:**
1. Backend: All active sessions for the user are invalidated via `invalidate_user_sessions()` RPC.
2. Auth: `supabase.auth.signOut()` is called.
3. Client: All state is cleared (`localStorage`, `sessionStorage`, in-memory state).

**Sessions Table Schema:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Session ID (PK) |
| `user_id` | uuid | References `auth.users` |
| `is_active` | boolean | Whether session is valid |
| `ip_address` | text | Client IP (truncated to 45 chars) |
| `user_agent` | text | Browser user agent (truncated to 255 chars) |
| `created_at` | timestamptz | Session creation time |
| `last_active_at` | timestamptz | Last activity timestamp |

### Token Validation

- Tokens are validated server-side on every authenticated request using `auth.getClaims()`.
- **Roles and permissions are NEVER trusted from the frontend.** All access control is enforced in the backend.

---

## Security Architecture

### Rate Limiting

All endpoints are rate-limited to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /register` | 5 requests | 5 minutes (per IP) |
| `POST /login` | 10 requests | 5 minutes (per IP + email) |
| `POST /send-signup-otp` | 3 requests | 5 minutes (per IP + email) |
| `POST /forgot-password` | 3 requests | 5 minutes (per IP + email) |
| All authenticated endpoints | 120 requests | 1 minute (per user) |

When rate-limited, the API returns:

```json
HTTP 429
{ "error": "Too many requests. Please try again later." }
```

Rate limit entries are stored in the `rate_limits` table and automatically cleaned up every 5 minutes.

### Input Sanitization

All user inputs are sanitized server-side:

- **HTML tag stripping**: `<script>`, `<img>`, etc. are removed.
- **Dangerous character removal**: `<`, `>`, `'`, `"` are stripped.
- **Length enforcement**: Each field has a max length (email: 255, names: 100, coupon codes: 50, general: 500).
- **Email validation**: Format checked via regex, max 255 chars.
- **UUID validation**: All IDs are validated against UUID v4 format.
- **Password requirements**: 8–128 characters.

### Safe Error Responses

Internal errors are **never exposed** to clients. The API maps errors to safe messages:

| Status Code | Response |
|-------------|----------|
| 400 | `{ "error": "Invalid request" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Not found" }` |
| 429 | `{ "error": "Too many requests. Please try again later." }` |
| 500 | `{ "error": "Something went wrong" }` |

Stack traces, SQL errors, and internal system details are **never** included in API responses.

### Row-Level Security (RLS)

All database tables have RLS enabled. Key policies:

- **Users can only access their own data** (enforced via `auth.uid()` matching).
- **Admin operations** use a `has_role()` security definer function — never client-side checks.
- **Session validation** uses `validate_session()` security definer function.
- **No unrestricted `SELECT *`** without user-scoped filters.

### Frontend Security Principles

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   Frontend   │          │   Backend    │          │   Database   │
│              │          │              │          │              │
│ • UI only    │─────────▶│ • Validates  │─────────▶│ • RLS        │
│ • No trust   │          │ • Sanitizes  │          │ • User-scoped│
│ • No secrets │          │ • Rate limits│          │ • No globals │
│ • No roles   │          │ • Auth check │          │              │
└──────────────┘          └──────────────┘          └──────────────┘
```

- **No API keys** in frontend code (only publishable/anon keys).
- **No direct external API calls** from frontend.
- **Roles are never stored in localStorage** — always fetched via server-side RPC.

---

## User API — Public Endpoints

### GET /packages

Fetches all active credit packages with segmented bucket details. Returns both `one_time` and `subscription` packages with `monthly` and `yearly` intervals.

**Request:**
```
GET /user-api/packages
```

**Headers:** None required

**Response (200):**
```json
{
  "packages": [
    {
      "id": "uuid-basic-monthly",
      "name": "Basic",
      "credit_amount": 1500,
      "price": 90.00,
      "billing_type": "subscription",
      "billing_interval": "monthly",
      "template_tier": "basic",
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
    }
  ]
}
```

**Package Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Package UUID |
| `name` | string | Display name (e.g., "Basic", "Professional", "Enterprise") |
| `credit_amount` | integer | Total credit pool amount |
| `price` | number | Price in USD |
| `billing_type` | string | `one_time` or `subscription` |
| `billing_interval` | string\|null | `monthly` or `yearly` (only for subscriptions) |
| `template_tier` | string | `basic`, `professional`, or `enterprise` |
| `invoice_credits` | integer | Credits for invoice bucket (paid plan) |
| `estimate_credits` | integer | Credits for estimate bucket (paid plan) |
| `ai_estimate_credits` | integer | Credits for AI estimate bucket (paid plan) |
| `invoice_unlimited` | boolean | Unlimited invoices toggle |
| `estimate_unlimited` | boolean | Unlimited estimates toggle |
| `ai_estimate_unlimited` | boolean | Unlimited AI estimates toggle |
| `trial_enabled` | boolean | Whether this package offers a free trial |
| `trial_days` | integer\|null | Trial duration in days |
| `trial_invoice_credits` | integer | Restricted invoice credits during trial |
| `trial_estimate_credits` | integer | Restricted estimate credits during trial |
| `trial_ai_estimate_credits` | integer | Restricted AI estimate credits during trial |

**Filtering for Pricing Page:**

```typescript
// Get subscription packages only
const subscriptions = packages.filter(p => p.billing_type === 'subscription');

// Split by interval for monthly/yearly toggle
const monthlyPlans = subscriptions.filter(p => p.billing_interval === 'monthly');
const yearlyPlans  = subscriptions.filter(p => p.billing_interval === 'yearly');
```

---

### POST /register

Creates a new user account with optional coupon attribution.

**Rate Limit:** 5 requests per 5 minutes (per IP address)

**Request:**
```
POST /user-api/register
Content-Type: application/json
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe",
  "coupon_code": "SAVE20",
  "phone": "+1234567890",
  "address": "123 Main Street, City",
  "zip_code": "12345"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ Yes | Valid email format, max 255 chars |
| `password` | string | ✅ Yes | 8–128 characters |
| `full_name` | string | ✅ Yes | Max 100 chars, HTML stripped |
| `coupon_code` | string | ❌ No | Max 50 chars, auto-uppercased |
| `phone` | string | ❌ No | Max 20 chars |
| `address` | string | ❌ No | Max 500 chars |
| `zip_code` | string | ❌ No | Max 20 chars |

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "message": "Account created successfully"
}
```

**Error Responses:**

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Missing required fields" }` |
| 400 | `{ "error": "Invalid email format" }` |
| 400 | `{ "error": "Password must be 8-128 characters" }` |
| 400 | `{ "error": "Registration failed" }` |
| 429 | `{ "error": "Too many requests. Please try again later." }` |

**Notes:**
- If a valid `coupon_code` is provided, the user is permanently attributed to the influencer who owns that coupon.
- Coupon must be active, within usage limit, and not expired.
- On registration, user automatically receives an empty segmented credit wallet.
- All inputs are sanitized (HTML stripped, dangerous characters removed).

---

### POST /login

Authenticates a user, creates a server-side session, and returns tokens.

**Rate Limit:** 10 requests per 5 minutes (per IP + email combination)

**Request:**
```
POST /user-api/login
Content-Type: application/json
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ Yes | Valid email format |
| `password` | string | ✅ Yes | Non-empty string |

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "v1.MjQ1OGI5...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Server-Side Actions:**
1. ✅ Validates credentials via Supabase Auth
2. ✅ Creates active session record (with IP address and user agent)
3. ✅ Returns JWT tokens

**Error Responses:**

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Missing credentials" }` |
| 400 | `{ "error": "Invalid email format" }` |
| 401 | `{ "error": "Invalid credentials" }` |
| 429 | `{ "error": "Too many login attempts. Please try again later." }` |

---

### POST /send-signup-otp

Sends a 6-digit OTP code to verify a new user's email **before** registration completes. Does **not** require the email to exist in `auth.users`. Use this for signup email verification.

**Rate Limit:** 3 requests per 5 minutes (per IP + email combination)

**Request:**
```
POST /user-api/send-signup-otp
Content-Type: application/json
```

**Body:**
```json
{
  "email": "newuser@example.com"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ Yes | Valid email format, max 255 chars |

**Response (200):**
```json
{
  "success": true,
  "message": "If the email is valid, a verification code has been sent."
}
```

**OTP Details:**
- 6-digit numeric code
- Expires after 10 minutes
- Previous unused OTPs for the same email are automatically invalidated
- Email subject: **"Your Constil Verification Code"**
- Email heading: **"Verify Your Email"**
- Sent from `support@constil.com` via SendGrid API

**Signup Verification Flow (Step-by-Step):**
1. User enters email on signup form
2. Frontend calls `POST /send-signup-otp` with the email
3. User receives a 6-digit OTP code via email with "Verify Your Email" heading
4. Frontend calls `POST /verify-otp` with email + OTP
5. On success, frontend proceeds to call `POST /register` to create the account

> 💡 The `/verify-otp` and `/register` endpoints work independently. You can call `/register` directly without OTP verification if your flow doesn't require it, but using OTP verification first is recommended.

---

### POST /forgot-password

Sends a 6-digit OTP code to the user's email via SendGrid for password reset. Always returns success to prevent email enumeration. **Requires the email to already exist in `auth.users`.**

**Rate Limit:** 3 requests per 5 minutes (per IP + email combination)

**Request:**
```
POST /user-api/forgot-password
Content-Type: application/json
```

**Body:**
```json
{
  "email": "user@example.com"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ Yes | Valid email format, max 255 chars |

**Response (200):**
```json
{
  "success": true,
  "message": "If an account exists with that email, a reset code has been sent."
}
```

> ⚠️ This endpoint always returns `200 OK` regardless of whether the email exists. This is intentional to prevent email enumeration attacks.

**OTP Details:**
- 6-digit numeric code
- Expires after 10 minutes
- Previous unused OTPs for the same email are automatically invalidated
- Email subject: **"Your Constil Verification Code"**
- Email heading: **"Your Verification Code"**
- Sent from `support@constil.com` via SendGrid API

**SendGrid Configuration (for OTP emails):**

| Setting | Value |
|---------|-------|
| API Method | SendGrid Web API v3 (`https://api.sendgrid.com/v3/mail/send`) |
| Auth | `Authorization: Bearer <SENDGRID_API_KEY>` (stored as edge function secret) |
| Sender Email | `support@constil.com` |
| Sender Name | `Constil Support` |
| Content Type | `text/html` |

> **⚠️ IMPORTANT — If OTP emails are not being received:**
>
> 1. **Verify the `SENDGRID_API_KEY` secret is set** — The edge function reads `Deno.env.get("SENDGRID_API_KEY")`. If this secret is missing or empty, the OTP is generated and stored in the database but **no email is sent** (the code silently skips sending). The endpoint still returns `200 OK` because of the anti-enumeration design.
>
> 2. **Verify SendGrid sender identity** — The `from` address is `support@constil.com`. SendGrid requires this address (or its domain) to be verified as a [Sender Identity](https://docs.sendgrid.com/ui/sending-email/sender-verification). If it's not verified, SendGrid will reject the email with a `403 Forbidden` response, but the API will still return success (errors are caught silently).
>
> 3. **Check SendGrid API key permissions** — The API key must have the `Mail Send` permission. A key with only read access will fail silently.
>
> 4. **Check rate limits** — The endpoint is rate-limited to 3 requests per 5 minutes per IP+email. If rate-limited, the response will be `429`.
>
> 5. **Verify the user exists** — The backend calls `serviceClient.auth.admin.listUsers()` and checks if the email exists. If the email is not found, no OTP is generated — but the response is still `200 OK` (anti-enumeration).
>
> 6. **Check the `password_reset_otps` table** — To confirm OTPs are being generated, query:
>    ```sql
>    SELECT * FROM password_reset_otps WHERE email = 'user@example.com' ORDER BY created_at DESC LIMIT 5;
>    ```
>    If rows exist but `used = false` and `expires_at` is in the future, the OTP was created but the email may not have been sent.
>
> 7. **Check SendGrid Activity Feed** — In the SendGrid dashboard → Activity → search by recipient email. This shows if the email was accepted, delivered, bounced, or blocked.
>
> 8. **Check spam/junk folder** — SendGrid emails from unverified or new domains often land in spam.

**Error Responses:**

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Email is required" }` |
| 400 | `{ "error": "Invalid email format" }` |
| 429 | `{ "error": "Too many requests. Please try again later." }` |

---

### POST /verify-otp

Verifies a 6-digit OTP code without resetting the password. Use this to validate the code before allowing the user to enter a new password.

**Request:**
```
POST /user-api/verify-otp
Content-Type: application/json
```

**Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ Yes | Valid email format, max 255 chars |
| `otp` | string | ✅ Yes | 6-digit code |

**Response (200):**
```json
{
  "success": true,
  "message": "OTP verified"
}
```

**Error Responses:**

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Email and OTP are required" }` |
| 400 | `{ "error": "Invalid email format" }` |
| 400 | `{ "error": "Invalid or expired code" }` |

---

### POST /reset-password

Resets the user's password using a verified OTP code. The OTP is consumed (marked as used) after a successful reset.

**Request:**
```
POST /user-api/reset-password
Content-Type: application/json
```

**Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "password": "newSecurePassword123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ Yes | Valid email format, max 255 chars |
| `otp` | string | ✅ Yes | 6-digit code (must be valid & unexpired) |
| `password` | string | ✅ Yes | 8-128 characters |

**Response (200):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Password Reset Flow (Step-by-Step):**
1. Call `POST /forgot-password` with the user's email
2. User receives a 6-digit OTP code via email
3. Call `POST /verify-otp` to validate the code (optional but recommended for UX)
4. Call `POST /reset-password` with email, OTP, and new password
5. OTP is consumed — cannot be reused

**Error Responses:**

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Email, OTP and password are required" }` |
| 400 | `{ "error": "Invalid email format" }` |
| 400 | `{ "error": "Password must be 8-128 characters" }` |
| 400 | `{ "error": "Invalid or expired code" }` |
| 400 | `{ "error": "Failed to update password" }` |
| 404 | `{ "error": "User not found" }` |

### Password Reset — Debugging Checklist for External User Panel

If users report that they are **not receiving OTP emails** when using `POST /forgot-password`, follow this checklist in order:

#### Step 1: Confirm OTP is being generated
```sql
SELECT id, email, otp_code, used, expires_at, created_at
FROM password_reset_otps
WHERE email = 'user@example.com'
ORDER BY created_at DESC
LIMIT 5;
```
- ✅ If rows exist → OTP is generated, problem is with email delivery (go to Step 2)
- ❌ If no rows → User may not exist in `auth.users`, or the request is being rate-limited

#### Step 2: Verify SendGrid API Key is configured
The edge function reads: `Deno.env.get("SENDGRID_API_KEY")`

If this secret is **not set or empty**, the code block that sends the email is **completely skipped** — no error is thrown. The endpoint still returns `200 OK`.

**How to verify:** Check if `SENDGRID_API_KEY` is present in the project's edge function secrets.

#### Step 3: Verify SendGrid sender identity
The `from` address is hardcoded as:
```json
{ "email": "support@constil.com", "name": "Constil" }
```
In SendGrid dashboard → Settings → Sender Authentication:
- Either `support@constil.com` must be verified as a Single Sender, OR
- The domain `constil.com` must be authenticated (domain-level verification)

If neither is verified, SendGrid returns `403` and the email is not sent.

#### Step 4: Check SendGrid Activity Feed
SendGrid Dashboard → Activity → search by recipient email address. Look for:
- **Delivered** → Email sent successfully (check spam folder)
- **Bounced** → Recipient email address invalid
- **Blocked** → SendGrid blocked the send (usually sender identity issue)
- **Deferred** → Temporarily delayed
- **No entry** → Email was never sent (API key or sender identity issue)

#### Step 5: Check edge function logs
Look at the `user-api` edge function logs for any errors during the `/forgot-password` request. The SendGrid API call is wrapped in a try/catch that silently catches errors, but other issues (like rate limiting or database errors) will show up.

#### Step 6: Test manually with curl
```bash
curl -X POST https://avppbvsxayehguepyjkb.supabase.co/functions/v1/user-api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```
Expected response (always):
```json
{"success": true, "message": "If an account exists with that email, a reset code has been sent."}
```
Then check the `password_reset_otps` table and the user's inbox/spam.

#### Common Root Causes Summary

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| OTP not in DB | User doesn't exist / rate-limited | Check `auth.users` table, check rate limits |
| OTP in DB, no email | `SENDGRID_API_KEY` not set | Add the secret to edge function environment |
| OTP in DB, no email | Sender identity not verified | Verify `support@constil.com` in SendGrid |
| Email in SendGrid activity as "Blocked" | Sender not authenticated | Verify sender/domain in SendGrid |
| Email delivered but not in inbox | Spam filter | Check spam/junk folder |
| 429 response | Rate limited (3 per 5 min) | Wait 5 minutes and retry |

---

### POST /auth/google

Authenticates a user via Google Sign-In using a Google ID token. If the user doesn't exist, a new account is created automatically. Supports optional profile fields and coupon attribution on first sign-in.

**Google Client ID:** `342162059275-kesv2urijk509nt9aioqok8uc5nvrap0.apps.googleusercontent.com`

**Request:**
```
POST /user-api/auth/google
Content-Type: application/json
```

**Body:**
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "full_name": "John Doe",
  "phone": "+1234567890",
  "address": "123 Main St",
  "zip_code": "12345",
  "coupon_code": "SAVE10"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id_token` | string | ✅ Yes | Google ID token from Google Sign-In |
| `full_name` | string | ❌ No | Override display name (if not using Google's name) |
| `phone` | string | ❌ No | User phone number (max 20 chars) |
| `address` | string | ❌ No | User address (max 500 chars) |
| `zip_code` | string | ❌ No | User zip/postal code (max 20 chars) |
| `coupon_code` | string | ❌ No | Influencer coupon code for attribution (applied on first sign-in only) |

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "v1.MjQ1OGI5...",
  "user": {
    "id": "uuid",
    "email": "user@gmail.com"
  },
  "is_new_user": true
}
```

| Field | Description |
|-------|-------------|
| `is_new_user` | `true` if this is the user's first sign-in (account was just created) |

**Server-Side Actions:**
1. ✅ Rate limits Google auth (10 attempts per 5 minutes per IP)
2. ✅ Verifies Google ID token via Supabase Auth
3. ✅ Creates new user if first-time sign-in
4. ✅ Updates profile with optional fields (phone, address, zip_code, full_name)
5. ✅ Processes coupon attribution for new users
6. ✅ Creates active session record
7. ✅ Returns JWT tokens + `is_new_user` flag

**Client-Side Integration (Web):**
```javascript
// 1. Use Google Sign-In SDK to get the ID token
google.accounts.id.initialize({
  client_id: '342162059275-kesv2urijk509nt9aioqok8uc5nvrap0.apps.googleusercontent.com',
  callback: handleCredentialResponse,
});

// 2. Send ID token to your API
async function handleCredentialResponse(response) {
  const res = await fetch('https://avppbvsxayehguepyjkb.supabase.co/functions/v1/user-api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_token: response.credential,
      phone: '+1234567890',       // optional
      address: '123 Main St',     // optional
      zip_code: '12345',          // optional
      coupon_code: 'SAVE10',      // optional, for influencer attribution
    }),
  });
  const data = await res.json();
  // Store access_token for authenticated requests
  // data.is_new_user tells you if this is a first-time user
}
```

**Authorized JavaScript Origins (Google Cloud Console):**
```
http://localhost:5173
https://growthhub.assuredtechno.com
https://bloom-marketing-co.lovable.app
```

**Error Responses:**

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Google id_token is required" }` |
| 401 | `{ "error": "Google sign-in failed" }` |
| 429 | `{ "error": "Too many requests. Please try again later." }` |

---

### POST /submit-support-query

Submits a support/contact query from any external user (no authentication required). The query is stored in the database and appears in the Admin Dashboard under **Support Queries**.

**Endpoint:** `https://avppbvsxayehguepyjkb.supabase.co/functions/v1/submit-support-query`

> ⚠️ This is a **separate edge function** — not part of the `/user-api` path.

**Request:**
```
POST /submit-support-query
Content-Type: application/json
```

**Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "company_name": "Acme Inc",
  "message": "I need help with my subscription billing."
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `first_name` | string | ✅ Yes | Max 100 chars, HTML stripped |
| `last_name` | string | ✅ Yes | Max 100 chars, HTML stripped |
| `email` | string | ✅ Yes | Valid email format, max 255 chars |
| `company_name` | string | ❌ No | Max 200 chars, HTML stripped |
| `message` | string | ✅ Yes | Max 2000 chars, HTML stripped |

**Response (200 — Success):**
```json
{
  "success": true,
  "message": "Support query submitted successfully"
}
```

**Error Responses:**

| Status | Response |
|--------|----------|
| 400 | `{ "error": "First name is required (max 100 chars)" }` |
| 400 | `{ "error": "Last name is required (max 100 chars)" }` |
| 400 | `{ "error": "Valid email is required" }` |
| 400 | `{ "error": "Company name too long (max 200 chars)" }` |
| 400 | `{ "error": "Message is required (max 2000 chars)" }` |
| 405 | `{ "error": "Method not allowed" }` |
| 500 | `{ "error": "Something went wrong" }` |

**Notes:**
- No authentication required — this is a public-facing form endpoint.
- All inputs are sanitized server-side (HTML tags stripped).
- The query is inserted into the `support_queries` table with `status: 'open'`.
- Admins can view and manage queries from the Admin Dashboard → **Support Queries** tab.
- Admins can update query status: `open` → `in_progress` → `resolved` → `closed`.

**Support Queries Table Schema:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Query ID (PK) |
| `first_name` | text | Submitter's first name |
| `last_name` | text | Submitter's last name |
| `email` | text | Submitter's email address |
| `company_name` | text | Company name (optional, defaults to empty string) |
| `message` | text | Support message content |
| `status` | text | Query status: `open`, `in_progress`, `resolved`, `closed` |
| `created_at` | timestamptz | Submission timestamp |

**Frontend Integration Example:**

```typescript
const SUPPORT_URL = 'https://avppbvsxayehguepyjkb.supabase.co/functions/v1/submit-support-query';

const submitSupportQuery = async (formData: {
  first_name: string;
  last_name: string;
  email: string;
  company_name?: string;
  message: string;
}) => {
  const res = await fetch(SUPPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  const data = await res.json();

  if (data.success) {
    // Show success message: "Your query has been submitted!"
  } else {
    // Show error: data.error
  }
};
```

**Public Support Form Route:** `/support`  
**Admin Query Management Route:** `/dashboard/support-queries` (admin only)

---

## User API — Authenticated Endpoints

> All endpoints below require `Authorization: Bearer <access_token>`  
> All endpoints are rate-limited to **120 requests per minute** per user.  
> All endpoints validate the token server-side via `auth.getClaims()`.

---

### GET /credits

Returns the user's legacy credit pool balance.

**Request:**
```
GET /user-api/credits
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{ "credits": 450 }
```

---

### GET /wallet

Returns the user's segmented credit wallet with per-bucket balances and unlimited flags, plus the current active subscription summary for that same authenticated user.

**Request:**
```
GET /user-api/wallet
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "wallet": {
    "id": "uuid",
    "user_id": "uuid",
    "invoice_remaining": 42,
    "estimate_remaining": 15,
    "ai_estimate_remaining": 3,
    "invoice_unlimited": false,
    "estimate_unlimited": false,
    "ai_estimate_unlimited": false,
    "created_at": "2026-02-01T00:00:00Z",
    "updated_at": "2026-02-21T10:30:00Z"
  },
  "subscription": {
    "id": "uuid",
    "user_id": "uuid",
    "package_id": "uuid",
    "billing_type": "monthly",
    "start_date": "2026-02-01T00:00:00Z",
    "expiry_date": "2026-03-01T00:00:00Z",
    "is_active": true,
    "is_trial": false,
    "status": "active",
    "template_tier": "professional",
    "credit_packages": {
      "name": "Professional Plan"
    }
  }
}
```

**Response (200 — no active subscription):**
```json
{
  "wallet": {
    "id": "uuid",
    "user_id": "uuid",
    "invoice_remaining": 42,
    "estimate_remaining": 15,
    "ai_estimate_remaining": 3,
    "invoice_unlimited": false,
    "estimate_unlimited": false,
    "ai_estimate_unlimited": false,
    "created_at": "2026-02-01T00:00:00Z",
    "updated_at": "2026-02-21T10:30:00Z"
  },
  "subscription": null
}
```

**Wallet Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `invoice_remaining` | integer | Remaining invoice credits in bucket |
| `estimate_remaining` | integer | Remaining estimate credits in bucket |
| `ai_estimate_remaining` | integer | Remaining AI estimate credits in bucket |
| `invoice_unlimited` | boolean | If `true`, invoices don't deduct credits |
| `estimate_unlimited` | boolean | If `true`, estimates don't deduct credits |
| `ai_estimate_unlimited` | boolean | If `true`, AI estimates don't deduct credits |

**Subscription Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `expiry_date` | timestamp | Subscription end date shown to the authenticated user |
| `billing_type` | string | Billing cycle for the active plan |
| `status` | string | Current subscription state |
| `is_trial` | boolean | Whether the active plan is still in trial mode |
| `credit_packages.name` | string | Display name of the subscribed plan |

---

### GET /subscription

Returns the user's active subscription details (or `null` if no active subscription).

**Request:**
```
GET /user-api/subscription
Authorization: Bearer <access_token>
```

**Response (200 — Active paid subscription):**
```json
{
  "subscription": {
    "id": "uuid",
    "user_id": "uuid",
    "package_id": "uuid",
    "billing_type": "monthly",
    "start_date": "2026-02-01T00:00:00Z",
    "expiry_date": "2026-03-01T00:00:00Z",
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

**Response (200 — Active trial subscription):**
```json
{
  "subscription": {
    "id": "uuid",
    "user_id": "uuid",
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

---

### GET /template-access

Checks which email template tiers the user can access based on their subscription.

**Request:**
```
GET /user-api/template-access
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "tier": "professional",
  "templates": ["basic", "professional"]
}
```

**Tier Hierarchy:**

| Subscription Tier | Accessible Templates |
|---|---|
| `basic` | `["basic"]` |
| `professional` | `["basic", "professional"]` |
| `enterprise` | `["basic", "professional", "enterprise"]` |

**Notes:**
- Users without an active subscription default to `basic`.
- Backend enforces this — frontend should check before showing templates.

---

### GET /credit-config

Fetches current dynamic credit costs for all active actions. **Frontend must always call this — never hardcode credit costs.**

**Request:**
```
GET /user-api/credit-config
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "config": [
    { "action_type": "invoice", "credit_cost": 1, "is_active": true },
    { "action_type": "estimate", "credit_cost": 2, "is_active": true },
    { "action_type": "ai_estimate", "credit_cost": 50, "is_active": true }
  ]
}
```

**Notes:**
- Costs are set by the Super Admin and can change at any time.
- If `is_active` is `false`, that action is currently disabled (returns 403 on consume).

---

### POST /create-checkout

Creates a Stripe Checkout session for purchasing a package. Returns a Stripe URL to redirect the user.

**Request:**
```
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

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `package_id` | string | ✅ Yes | Valid UUID format |
| `billing_type` | string | ✅ Yes | `subscription` or `one_time` |
| `coupon_code` | string | ❌ No | Max 50 chars, sanitized |
| `success_url` | string | ❌ No | Redirect URL after payment |
| `cancel_url` | string | ❌ No | Redirect URL if cancelled |

**Response (200):**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_...",
  "session_id": "cs_live_abc123",
  "original_price": 170.00,
  "discount_percent": 20,
  "discount_amount": 34.00,
  "final_price": 136.00
}
```

**Error (400):**
```json
{ "error": "Invalid or inactive package" }
```

**Notes:**
- Discount is calculated server-side from the coupon.
- Metadata (user_id, package_id, coupon_id, influencer_id, manager_id) is attached to the Stripe session for post-payment processing.
- If the user already has an attribution (from registration), the discount is applied automatically even without a coupon_code.

---

### POST /verify-payment

Verifies a Stripe Checkout session after the user is redirected back. On success, activates subscription, allocates credits, and triggers commissions.

**Request:**
```
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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_id` | string | ✅ Yes | Stripe Checkout session ID from redirect URL |

**Response (200):**
```json
{
  "status": "succeeded",
  "credits_added": 3500,
  "package_name": "Professional",
  "final_price": 136.00,
  "original_price": 170.00,
  "discount_amount": 34.00
}
```

**Security:** The transaction's `user_id` is verified against the authenticated user — users cannot verify another user's payment.

**Error (400):**
```json
{ "error": "Payment not completed" }
```

**Post-Payment Actions (server-side):**
1. ✅ Creates/renews subscription record
2. ✅ Allocates segmented credits to wallet buckets
3. ✅ Updates legacy credit pool
4. ✅ Records payment transaction
5. ✅ Creates sale record
6. ✅ Triggers commission engine (locked commissions for influencer/manager)

---

### POST /validate-coupon

Pre-validates a coupon code and returns discount preview before checkout.

**Request:**
```
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

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `coupon_code` | string | ✅ Yes | Max 50 chars, sanitized, auto-uppercased |
| `package_id` | string | ❌ No | Valid UUID format |

**Response (200 — Valid):**
```json
{
  "valid": true,
  "discount_percent": 20,
  "influencer_name": "John Doe",
  "price_preview": {
    "original_price": 170.00,
    "discount_amount": 34.00,
    "final_price": 136.00,
    "package_name": "Professional"
  }
}
```

**Response (200 — Invalid):**
```json
{
  "valid": false,
  "error": "Coupon expired or inactive"
}
```

---

### POST /start-trial

Starts a free trial for a package via **Stripe Checkout** in subscription mode. The user enters card details but is **NOT charged** until the trial period ends. After the trial, Stripe **automatically charges** the card. If payment fails, Stripe retries for a few days before cancelling.

**Request:**
```
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

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `package_id` | string | ✅ Yes | Valid UUID format |
| `success_url` | string | ❌ No | Redirect URL after checkout |
| `cancel_url` | string | ❌ No | Redirect URL if cancelled |

**Response (200 — Checkout session created):**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_...",
  "session_id": "cs_live_...",
  "trial_days": 14,
  "package_name": "Basic"
}
```

**Error (400 — Already used trial):**
```json
{ "error": "You have already used a trial for this package" }
```

**Error (400 — Trial not available):**
```json
{ "error": "Trial not available for this package" }
```

**Flow:**
1. User clicks "Start Free Trial" → calls `POST /start-trial`
2. User is redirected to Stripe Checkout → enters card details (NOT charged)
3. After completing checkout, user is redirected to `success_url`
4. Your app calls `POST /verify-trial` with the `session_id` to activate the trial

---

### POST /verify-trial

Confirms a Stripe Checkout session for a trial subscription and activates the trial in the database.

**Request:**
```
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

**Response (200 — Trial activated):**
```json
{
  "status": "trial_activated",
  "trial_end": "2026-04-08T12:00:00Z",
  "trial_days": 14,
  "package_name": "Basic"
}
```

**Response (200 — Already processed):**
```json
{ "status": "already_processed", "message": "Trial already activated" }
```

**Security:** The session's `user_id` metadata is verified against the authenticated user — users cannot activate another user's trial.

**Post-Verify Actions (server-side):**
1. ✅ Deactivates any existing active subscription
2. ✅ Creates trial subscription (`status: 'trial'`, `is_trial: true`)
3. ✅ Sets `trial_end_at = now + trial_days`
4. ✅ Stores `stripe_subscription_id` for webhook matching
5. ✅ Grants restricted credits (`trial_invoice_credits`, `trial_estimate_credits`, `trial_ai_estimate_credits`)
6. ❌ Does NOT grant unlimited access (even if paid plan has unlimited)
7. ❌ Does NOT grant full package credits

---

### Stripe Webhook — Auto-Charge After Trial

A webhook at `/functions/v1/stripe-webhook` handles automatic post-trial charging:

| Event | Action |
|-------|--------|
| `invoice.paid` (amount > $0) | Converts trial to active paid subscription, grants full package credits, records payment & commissions |
| `invoice.payment_failed` | Marks subscription as `past_due` (Stripe retries automatically) |
| `customer.subscription.deleted` | Marks subscription as `cancelled`, deactivates it |

**Webhook Security:**
- Supports `STRIPE_WEBHOOK_SECRET` for signature verification.
- If configured, rejects requests without a valid `stripe-signature` header.
- Internal errors return generic `{ "error": "Processing error" }` — never exposes details.

**Trial Expiry (Background Job):**
- A background job runs hourly to expire trials past `trial_end_at`
- Expired trials: `status → 'expired'`, `is_active → false`
- Stripe handles the auto-charge independently — the DB status tracks the trial period

---

### POST /consume-credit

Deducts credits from the user's segmented wallet bucket. Falls back to the legacy credit pool if the specific bucket is empty. Respects unlimited flags.

**Request:**
```
POST /user-api/consume-credit
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "action_type": "invoice",
  "reference_id": "inv_abc123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `action_type` | string | ✅ Yes | One of: `invoice`, `estimate`, `ai_estimate` |
| `reference_id` | string | ❌ No | Max 255 chars, sanitized |

**Response (200 — Bucket deduction):**
```json
{
  "success": true,
  "credits_deducted": 1,
  "remaining_credits": 41,
  "bucket": "invoice"
}
```

**Response (200 — Unlimited action):**
```json
{
  "success": true,
  "credits_deducted": 0,
  "remaining_credits": 50,
  "unlimited": true
}
```

**Response (200 — Legacy pool fallback):**
```json
{
  "success": true,
  "credits_deducted": 1,
  "remaining_credits": 449,
  "can_generate": true
}
```

**Error (402 — Insufficient Credits):**
```json
{
  "error": "Insufficient credits. Please top up.",
  "can_generate": false,
  "required": 50,
  "available": 30
}
```

**Error (400 — Invalid Action):**
```json
{ "error": "Invalid action type" }
```

**Error (403 — Action Disabled):**
```json
{ "error": "Action currently disabled" }
```

**Deduction Priority:**
1. Check segmented wallet bucket → if unlimited, log usage but don't deduct
2. If bucket has enough credits → deduct from bucket
3. If bucket is empty → fall back to legacy credit pool
4. If legacy pool also insufficient → return 402

**Notes:**
- **Does NOT trigger commissions.** Commissions are only generated on purchases/top-ups.
- `reference_id` is stored for full audit trail.
- `action_type` is validated against a whitelist — unknown types are rejected.

---

### POST /invoice-generated *(Legacy)*

> ⚠️ **Deprecated** — Use `POST /consume-credit` with `action_type: "invoice"` instead.

Deducts credits for invoice generation using dynamic config.

**Request:**
```
POST /user-api/invoice-generated
Authorization: Bearer <access_token>
```

**Body:** None required

**Response (200):**
```json
{
  "success": true,
  "remaining_credits": 449,
  "can_generate": true
}
```

---

---

## Subscription Pricing Page Integration

This section explains how to build a **subscription pricing page** with a **monthly/yearly toggle** on your separate user-facing application, matching the admin-created packages.

### Architecture

```
┌─────────────────────┐       ┌─────────────────────┐       ┌──────────────┐
│   Admin Dashboard    │       │   Your User Panel    │       │    Stripe    │
│                      │       │                      │       │              │
│ • Create packages    │       │ • GET /packages      │       │ • Checkout   │
│ • Set monthly/yearly │──────▶│ • Monthly/Yearly UI  │──────▶│ • Payment    │
│ • Set prices/credits │       │ • Apply coupons      │       │ • Redirect   │
│ • Activate/deactivate│       │ • Redirect to Stripe │◀──────│ • Confirm    │
└─────────────────────┘       └─────────────────────┘       └──────────────┘
```

### Monthly / Yearly Toggle

**Step 1: Fetch & Filter Packages**

```typescript
const API_BASE = 'https://avppbvsxayehguepyjkb.supabase.co/functions/v1/user-api';

const response = await fetch(`${API_BASE}/packages`);
const { packages } = await response.json();

// Filter to subscription packages only
const subscriptionPackages = packages.filter(p => p.billing_type === 'subscription');

// Group by interval
const monthlyPlans = subscriptionPackages.filter(p => p.billing_interval === 'monthly');
const yearlyPlans  = subscriptionPackages.filter(p => p.billing_interval === 'yearly');
```

**Step 2: Build Toggle UI (React Example)**

```tsx
const [isYearly, setIsYearly] = useState(false);
const displayedPlans = isYearly ? yearlyPlans : monthlyPlans;

return (
  <div>
    {/* Savings callout */}
    <p>Save 20% when you choose the Yearly Plan.</p>

    {/* Toggle Switch */}
    <div className="toggle-container">
      <span className={!isYearly ? 'active' : ''}>Monthly</span>
      <label className="switch">
        <input type="checkbox" checked={isYearly} onChange={e => setIsYearly(e.target.checked)} />
        <span className="slider round"></span>
      </label>
      <span className={isYearly ? 'active' : ''}>Yearly</span>
    </div>

    {/* Plan cards */}
    <div className="plans-grid">
      {displayedPlans.map(plan => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  </div>
);
```

**Step 3: Toggle CSS**

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

### Rendering Plan Cards

Each plan card should display these fields:

| Package Field | Display As |
|---------------|------------|
| `name` | Plan title: "BASIC", "PROFESSIONAL", "ENTERPRISE" |
| `price` | `$90 USD / monthly` or `$864 USD / yearly` |
| `credit_amount` | `1,500 CREDITS / MO` or `18,000 CREDITS / YR` |
| `invoice_credits` | `- 60 Invoices` |
| `estimate_credits` | `- 60 Estimates` |
| `ai_estimate_credits` | `- 20 AI Estimates` |
| `invoice_unlimited` | If `true` → `- Unlimited Invoices` |
| `estimate_unlimited` | If `true` → `- Unlimited Estimates` |
| `ai_estimate_unlimited` | If `true` → `- Unlimited AI Estimates` |
| `template_tier` | Map to template count (see below) |

**Template Tier Display Mapping:**

```typescript
const templateDisplay = {
  basic: '3 Invoice & Estimate Templates',
  professional: '8 Invoice & Estimate Templates',
  enterprise: 'All Invoice & Estimate Templates',
};
```

**Example Plan Card Component (React):**

```tsx
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
        <span> / {plan.billing_interval}</span>
      </div>
      <p className="credits-summary">
        {plan.credit_amount.toLocaleString()} CREDITS / {plan.billing_interval === 'yearly' ? 'YR' : 'MO'}
      </p>
    </div>

    {/* Features */}
    <ul className="features">
      <li>✅ {plan.invoice_unlimited ? 'Unlimited Invoices' : `${plan.invoice_credits} Invoices`}</li>
      <li>✅ {plan.estimate_unlimited ? 'Unlimited Estimates' : `${plan.estimate_credits} Estimates`}</li>
      <li>✅ {plan.ai_estimate_unlimited ? 'Unlimited AI Estimates' : `${plan.ai_estimate_credits} AI Estimates`}</li>
      <li>✅ {templateDisplay[plan.template_tier]}</li>
      <li>✅ Buy 500 Token Top-Up for $35</li>
    </ul>

    {/* CTA */}
    <button className={isSelected ? 'btn-primary' : 'btn-outline'}>
      {isSelected ? '✓ Selected' : 'SELECT PLAN'}
    </button>
  </div>
);
```

---

### Coupon Code Flow

Allow users to apply an influencer coupon code before checkout.

**Step 1: Validate the Coupon**

```typescript
const applyCoupon = async (couponCode: string, packageId: string) => {
  const res = await fetch(`${API_BASE}/validate-coupon`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      coupon_code: couponCode,
      package_id: packageId,
    }),
  });
  const data = await res.json();

  if (data.valid) {
    // Show: "Coupon applied! 20% off — You pay $136.00"
    return {
      discount_percent: data.discount_percent,
      original_price: data.price_preview.original_price,
      discounted_price: data.price_preview.final_price,
      influencer_name: data.influencer_name,
    };
  } else {
    // Show error: data.error
    return null;
  }
};
```

**Step 2: Display Discount Preview**

```tsx
{couponResult && (
  <div className="coupon-applied">
    <p>✅ Coupon applied: {couponResult.discount_percent}% off</p>
    <p>Original: ${couponResult.original_price} → Now: ${couponResult.discounted_price}</p>
    {couponResult.influencer_name && <p>via {couponResult.influencer_name}</p>}
  </div>
)}
```

---

### Full Coupon Discount Checkout Flow (Step-by-Step)

This section details the complete end-to-end flow for an **external user** purchasing a subscription with a coupon discount via Stripe.

> **Important:** Coupons are applied at **checkout time**, not at registration. The coupon code provided during registration is **only for attribution** (permanently linking the user to an influencer). The actual discount is calculated and applied when the user buys a subscription package.

#### Flow Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Register │────▶│  2. Login    │────▶│ 3. Browse    │────▶│ 4. Apply     │────▶│ 5. Checkout  │
│  (no payment)│     │  (get token) │     │  Packages    │     │  Coupon      │     │  via Stripe  │
│              │     │  + session   │     │              │     │  (optional)  │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                                           │
                                                                                           ▼
                                                               ┌──────────────┐     ┌──────────────┐
                                                               │ 7. Confirm   │◀────│ 6. Stripe    │
                                                               │  Subscription│     │  Payment Page│
                                                               └──────────────┘     └──────────────┘
```

#### Step 1: Register (No Payment, No Coupon Required)

```typescript
const response = await fetch(`${API_BASE}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123',
    full_name: 'John Doe',
    // coupon_code is OPTIONAL here — only for attribution, NOT discount
  }),
});
// Response: { success: true, user: { id: "uuid", email: "user@example.com" } }
```

> The user now has an account with an empty credit wallet. No subscription, no payment.

#### Step 2: Login to Get Access Token

```typescript
const loginRes = await fetch(`${API_BASE}/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123',
  }),
});
const { access_token } = await loginRes.json();
// Store access_token for all subsequent authenticated requests
// Server also creates an active session record
```

#### Step 3: Browse Available Packages

```typescript
const pkgRes = await fetch(`${API_BASE}/packages`);
const { packages } = await pkgRes.json();

// Filter subscription packages and group by interval
const monthly = packages.filter(p => p.billing_type === 'subscription' && p.billing_interval === 'monthly');
const yearly  = packages.filter(p => p.billing_type === 'subscription' && p.billing_interval === 'yearly');

// Display plans with toggle — user selects a plan (store package_id)
```

#### Step 4: Apply Coupon Code (Optional — Before Checkout)

The user enters an influencer coupon code to preview the discount:

```typescript
const validateRes = await fetch(`${API_BASE}/validate-coupon`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`,
  },
  body: JSON.stringify({
    coupon_code: 'SAVE20',
    package_id: selectedPlanId,
  }),
});
const couponResult = await validateRes.json();

// If valid:
// {
//   "valid": true,
//   "discount_percent": 20,
//   "influencer_name": "Jane Influencer",
//   "price_preview": {
//     "original_price": 170.00,
//     "discount_amount": 34.00,
//     "final_price": 136.00,
//     "package_name": "Professional"
//   }
// }

// If invalid:
// { "valid": false, "error": "Coupon expired or inactive" }
```

**Show the user:**
```
✅ Coupon applied: 20% off
Original: $170.00 → Now: $136.00
via Jane Influencer
```

#### Step 5: Create Stripe Checkout with Coupon Discount

When the user clicks "Pay" or "Continue", create a Stripe Checkout session. The **discount is calculated server-side** — the Stripe payment page will show the **final discounted price**.

```typescript
const checkoutRes = await fetch(`${API_BASE}/create-checkout`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`,
  },
  body: JSON.stringify({
    package_id: selectedPlanId,
    billing_type: 'subscription',
    coupon_code: 'SAVE20',
    success_url: 'https://yourapp.com/payment-success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://yourapp.com/pricing',
  }),
});
const checkoutData = await checkoutRes.json();

// Response:
// {
//   "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_...",
//   "session_id": "cs_live_abc123",
//   "original_price": 170.00,
//   "discount_percent": 20,
//   "discount_amount": 34.00,
//   "final_price": 136.00
// }

// Redirect user to Stripe
window.location.href = checkoutData.checkout_url;
```

**What happens server-side:**

| Step | Action |
|------|--------|
| 1 | Validates `package_id` (UUID format + active in DB) |
| 2 | Sanitizes `coupon_code` (strips HTML, dangerous chars) |
| 3 | Checks if user already has an attribution (from registration) — uses that coupon automatically |
| 4 | If no attribution, validates the provided `coupon_code` (active, not expired, within usage limit) |
| 5 | Calculates discount: `$170 × 20% = $34 discount → $136 final price` |
| 6 | Creates Stripe Checkout Session with `unit_amount: 13600` (cents) |
| 7 | Attaches metadata: `user_id`, `package_id`, `coupon_id`, `influencer_id`, `manager_id`, pricing details |
| 8 | Creates a `payment_transactions` record with status `pending` |

**Important:** If the user registered with a coupon code (attribution), the discount is applied **automatically** even if they don't enter a coupon code at checkout. The system checks attribution first.

#### Step 6: User Pays on Stripe

The user sees the **discounted price** on Stripe's hosted checkout page:

```
┌─────────────────────────────────┐
│  Professional Plan              │
│  Original: $170.00              │
│  Discount: 20% (-$34.00)       │
│                                 │
│  Total: $136.00                 │
│                                 │
│  [Enter card details]           │
│  [Pay $136.00]                  │
└─────────────────────────────────┘
```

After successful payment, Stripe redirects to your `success_url` with `session_id` in the query string.

#### Step 7: Verify Payment & Activate Subscription

On your `/payment-success` page, verify the payment and activate everything:

```typescript
const sessionId = new URLSearchParams(window.location.search).get('session_id');

const verifyRes = await fetch(`${API_BASE}/verify-payment`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`,
  },
  body: JSON.stringify({ session_id: sessionId }),
});
const result = await verifyRes.json();

// Response:
// {
//   "status": "succeeded",
//   "credits_added": 3500,
//   "package_name": "Professional",
//   "final_price": 136.00,
//   "original_price": 170.00,
//   "discount_amount": 34.00
// }
```

**What happens server-side on verify:**

| Action | Details |
|--------|---------|
| ✅ User ownership verified | `txn.user_id` must match authenticated user |
| ✅ Subscription created/renewed | Sets expiry based on billing interval (30 or 365 days) |
| ✅ Segmented credits allocated | Adds invoice, estimate, AI estimate credits to wallet buckets |
| ✅ Legacy credits updated | Adds total credits to legacy pool |
| ✅ Coupon usage incremented | `usage_count + 1` on the coupon |
| ✅ User attribution created | Links user → influencer (if not already attributed) |
| ✅ Sale record created | Records total, discount, and final amounts |
| ✅ Credit transaction logged | Full audit trail entry |
| ✅ Commission created (locked) | Influencer + manager commissions based on **final paid amount** |

#### Coupon Priority Logic

The system resolves discounts in this priority order:

```
1. Check user_attributions table → if user was attributed during registration
   → Use that coupon's discount automatically (no coupon_code needed at checkout)

2. If no attribution exists AND coupon_code is provided at checkout
   → Validate the coupon (active, not expired, within usage limit)
   → Apply discount if valid

3. If neither → no discount applied (full price)
```

#### Commission Calculation Example

For a $170 Professional Plan with 20% coupon discount:

```
Original Price:     $170.00
Discount (20%):    -$34.00
Final Paid:         $136.00

Influencer Commission (10% of final): $13.60 → locked for 30 days
Manager Commission (10% of final):    $13.60 → locked for 30 days
```

> Commission percentages and lock period are configured in `global_settings` by the Super Admin.

---

### Checkout & Payment Flow

**Step 1: Create Stripe Checkout Session**

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
  if (data.checkout_url) {
    window.location.href = data.checkout_url; // Redirect to Stripe
  } else {
    alert(data.error || 'Failed to start checkout');
  }
};
```

**Step 2: Verify Payment on Success Page**

```typescript
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
        if (data.status === 'succeeded') {
          // Show success: credits_added, package_name, final_price
          // Redirect to dashboard
        }
      });
  }
}, []);
```

**Step 3: Confirm Subscription is Active**

```typescript
// After payment, verify subscription status:
const res = await fetch(`${API_BASE}/subscription`, {
  headers: { 'Authorization': `Bearer ${accessToken}` },
});
const { subscription } = await res.json();

if (subscription?.is_active) {
  // Highlight user's current plan
  // Show expiry date: subscription.expiry_date
  // Show tier: subscription.template_tier
}
```

---

## Integration Flows

### 🆓 Free Trial with Stripe Checkout (Card Upfront, No Charge)

```
1. GET  /user-api/packages                    → Fetch all packages
   └─ Filter: trial_enabled === true

2. User clicks "Start Free Trial"             → Store package_id

3. POST /user-api/start-trial                 → Get Stripe Checkout URL
   Body: { "package_id": "uuid" }
   ↳ Validates UUID format
   ↳ Checks user hasn't already used trial for this package
   ↳ Creates Stripe subscription with trial_period_days
   ↳ Checkout collects card details (NO charge)

4. User enters card details on Stripe         → Redirected to success_url
   └─ success_url includes: ?session_id={CHECKOUT_SESSION_ID}&flow=trial

5. POST /user-api/verify-trial                → Activate trial subscription
   Body: { "session_id": "cs_live_..." }
   ↳ Verifies session belongs to authenticated user
   ↳ Deactivates any existing subscription
   ↳ Creates trial subscription (status: 'trial', is_trial: true)
   ↳ Grants restricted trial credits (NOT full package credits)
   ↳ Stores stripe_subscription_id for webhook matching

6. GET  /user-api/subscription                → Confirm trial is active
   ↳ Shows trial_days_remaining, trial_end_at, is_trial: true

7. [AUTOMATIC] Trial period ends              → Stripe auto-charges card
   ↳ stripe-webhook receives invoice.paid event
   ↳ Converts trial → active paid subscription
   ↳ Grants full package credits
   ↳ Records payment transaction + commissions

8. [IF CARD DECLINED] Stripe retries          → Past due state
   ↳ stripe-webhook receives invoice.payment_failed
   ↳ Subscription status set to 'past_due'
   ↳ Stripe retries for ~3-4 days automatically

9. [IF ALL RETRIES FAIL] Stripe cancels       → Subscription cancelled
   ↳ stripe-webhook receives customer.subscription.deleted
   ↳ Subscription deactivated (is_active: false, status: 'cancelled')
```

**Trial Flow Code Example (Frontend):**

```typescript
// Step 1: Start trial → redirect to Stripe
const startTrial = async (packageId: string) => {
  const res = await fetch(`${API_BASE}/start-trial`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ package_id: packageId }),
  });
  const data = await res.json();
  if (data.checkout_url) {
    window.location.href = data.checkout_url; // Redirect to Stripe
  }
};

// Step 2: On /payment-success?session_id=...&flow=trial
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
  // data = { status: "trial_activated", trial_end: "...", trial_days: 14, package_name: "Basic" }
};
```

### 🛒 Full Subscription Purchase Flow (Stripe)

```
1. GET  /user-api/packages                    → Fetch all packages
   └─ Filter: billing_type === 'subscription'
   └─ Group: billing_interval === 'monthly' | 'yearly'

2. User toggles Monthly ⟷ Yearly             → Re-render plan cards

3. User selects a plan                        → Store package_id

4. (Optional) POST /user-api/validate-coupon  → Preview discount
   Body: { "coupon_code": "SAVE20", "package_id": "uuid" }

5. POST /user-api/create-checkout             → Get Stripe checkout URL
   Body: { "package_id": "uuid", "billing_type": "subscription", "coupon_code": "SAVE20" }
   ↳ Validates all inputs (UUID, sanitized coupon)

6. User completes payment on Stripe           → Redirected to success_url

7. POST /user-api/verify-payment              → Verify & activate
   Body: { "session_id": "cs_live_..." }
   ↳ Verifies user ownership of transaction
   ↳ Creates/renews subscription
   ↳ Allocates segmented credits to wallet
   ↳ Records sale + payment transaction
   ↳ Triggers commission engine (locked)

8. GET  /user-api/subscription                → Confirm active plan
9. GET  /user-api/wallet                      → Show updated credit balances
```


### 🪣 Credit Consumption Flow

```
1. GET  /user-api/credit-config     → Fetch dynamic costs (cache in-memory)
2. GET  /user-api/wallet            → Show bucket balances to user
3. POST /user-api/consume-credit    → Deduct from appropriate bucket
   Body: { "action_type": "invoice", "reference_id": "inv_123" }
   ↳ Validates action_type against whitelist
   ↳ Checks bucket first → falls back to legacy pool
   ↳ Returns remaining balance + can_generate flag
4. GET  /user-api/wallet            → Refresh wallet display
```

### 📧 Template Access Check

```
1. GET /user-api/template-access    → Returns tier + accessible template list
   ↳ basic        → ["basic"]
   ↳ professional → ["basic", "professional"]
   ↳ enterprise   → ["basic", "professional", "enterprise"]
```


---

## Error Handling

All errors follow a consistent format:

```json
{ "error": "Human-readable safe message" }
```

| HTTP Status | Meaning | Example Response |
|-------------|---------|------------------|
| 200 | Success | `{ "credits": 450 }` |
| 400 | Bad request / validation failure | `{ "error": "Invalid request" }` |
| 401 | Unauthorized / invalid token | `{ "error": "Unauthorized" }` |
| 402 | Insufficient credits | `{ "error": "Insufficient credits. Please top up." }` |
| 403 | Forbidden / action disabled | `{ "error": "Forbidden" }` |
| 404 | Not found | `{ "error": "Not found" }` |
| 429 | Rate limited | `{ "error": "Too many requests. Please try again later." }` |
| 500 | Internal server error | `{ "error": "Something went wrong" }` |

**Security Rules for Error Responses:**
- ❌ Never expose stack traces
- ❌ Never expose SQL errors or database details
- ❌ Never expose internal system details or file paths
- ✅ Always return generic, safe messages
- ✅ Log detailed errors server-side only (`console.error`)

---

## Security Notes

| Rule | Details |
|------|---------|
| **Input sanitization** | All inputs are sanitized server-side (HTML stripped, dangerous chars removed, length enforced) |
| **UUID validation** | All IDs are validated against UUID v4 format before database queries |
| **Rate limiting** | All endpoints are rate-limited per user/IP with automatic cleanup |
| **Session management** | Active sessions tracked server-side; invalidated on logout |
| **Token validation** | JWT validated via `auth.getClaims()` on every authenticated request |
| **User ownership** | All data access is user-scoped; verify-payment and verify-trial check `user_id` match |
| **Credit costs** | Never hardcoded — always fetched via `GET /credit-config` |
| **Commissions** | Trigger ONLY on payment success, never on credit consumption |
| **Payment activation** | Cannot activate subscription without going through Stripe checkout |
| **Duplicate prevention** | Only `pending` transactions can be confirmed (one-way state) |
| **Access control** | Only Super Admins can modify `credit_action_config`, `global_settings`, `credit_packages` |
| **Template enforcement** | Backend enforces template tier access — not just frontend |
| **Webhook security** | Supports `STRIPE_WEBHOOK_SECRET` for signature verification |
| **Error masking** | Internal errors never exposed to clients |
| **No frontend trust** | Roles, permissions, and admin checks are always server-side |

---

## Admin Dashboard Endpoints

These are managed through the Admin Dashboard UI (not REST API):

| Action | Dashboard Route |
|--------|-----------------|
| Manage credit packages (monthly & yearly with segmented buckets) | `/dashboard/packages` |
| Update credit action costs | `/dashboard/credit-config` |
| Enable/disable actions | `/dashboard/credit-config` |
| View subscriptions | `/dashboard/subscriptions` |
| View payment transaction logs | `/dashboard/payment-logs` |
| Manage coupons | `/dashboard/coupons` |
| Process payouts | `/dashboard/payouts` |
| Commission & payment mode settings | `/dashboard/settings` |
| Analytics & revenue overview | `/dashboard` |
| Manage support queries (view, update status) | `/dashboard/support-queries` |

### Admin Package Setup for Monthly/Yearly Toggle

For the monthly/yearly toggle to work on the user panel, admins must create **paired packages**:

1. Go to **Dashboard → Packages → Add Package**
2. Set **Billing Type** to `Subscription`
3. Create a **monthly** package (e.g., "Basic" at $90/mo with monthly credits)
4. Create a **yearly** package with the same name (e.g., "Basic" at $864/yr with yearly credits — 20% savings)
5. Set the appropriate **template_tier** for each
6. The API groups them by `name` — the monthly/yearly toggle switches between packages with the same name

---

## API Optimization (Frontend Best Practices)

### React Query Caching

The admin dashboard uses **React Query** for all API calls with built-in:

| Feature | Implementation |
|---------|----------------|
| **Caching** | `staleTime: 15s–60s` — prevents redundant fetches |
| **Deduplication** | Multiple components sharing the same `queryKey` make only one request |
| **Controlled refetch** | `refetchOnWindowFocus: false` — no auto-refetch on tab switch |
| **Parallel fetching** | `Promise.all()` for independent queries within a single hook |

### Hook Usage

```typescript
import { useAdminStats, useManagerStats, useWalletData, useCoupons } from '@/hooks/use-query-helpers';

// Admin dashboard — single hook, all stats
const { data, isLoading } = useAdminStats();

// Manager dashboard — user-scoped
const { data } = useManagerStats(userId);

// Wallet page — role-aware
const { data } = useWalletData(userId, role);

// Coupons — role-filtered
const { data: coupons } = useCoupons(role, userId);
```

### Rules

1. **No `useEffect` for data fetching** — use React Query hooks.
2. **No polling** unless realtime is explicitly required.
3. **No duplicate API calls** — React Query deduplicates by `queryKey`.
4. **Controlled triggers** — data fetched on mount, refreshed on user action (not every render).
5. **Request locking** — React Query prevents concurrent duplicate requests automatically.

---

## Business Management Resources (Direct Supabase REST)

The legacy Django models (`Client`, `Product`, `Invoice`, `Estimate`, `Tax`, `Discount`, `CompanyProfile`, `AIInvoice`, `AIEstimate`, etc.) are now backed by Supabase tables with **Row-Level Security (RLS)**. The frontend talks **directly to Supabase REST/Storage** using the user's access token — no custom edge function needed for CRUD.

> **Why direct REST?** RLS automatically scopes every row to `auth.uid()`. The user can only ever see/modify their own data. This is faster, cheaper, and removes a network hop versus going through `user-api`.

### Auth & Headers

Every request below requires:

```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <user_access_token>
Content-Type: application/json
```

Get the access token from `POST /user-api/login` response (`session.access_token`) or from `supabase.auth.getSession()` if using the JS SDK.

**Recommended:** use `@supabase/supabase-js`. All examples below show both the raw REST call and the SDK equivalent.

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://avppbvsxayehguepyjkb.supabase.co',
  '<SUPABASE_ANON_KEY>',
  { auth: { persistSession: true, autoRefreshToken: true } }
);
```

---

### Company Profile

Stores the user's company branding (legal name, contact, logo URL).

**Table:** `company_profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner (auto-filled from `auth.uid()`; required on insert) |
| `company_legal_name` | text | Required |
| `company_email` | text | Required |
| `company_phone` | text | Optional |
| `website` | text | Optional |
| `industry` | text | Optional |
| `address` | text | Optional |
| `logo_url` | text | Public URL from `company-logos` bucket |
| `created_at`, `updated_at` | timestamptz | Auto |

**RLS:** Users see and manage only rows where `user_id = auth.uid()`.

**Get my company profile:**
```http
GET /rest/v1/company_profiles?select=*&user_id=eq.<auth_uid>&limit=1
```

```ts
const { data } = await supabase.from('company_profiles').select('*').maybeSingle();
```

**Create:**
```ts
const { data, error } = await supabase.from('company_profiles').insert({
  user_id: user.id,
  company_legal_name: 'Acme Inc.',
  company_email: 'hello@acme.com',
  company_phone: '+1-555-0100',
  website: 'https://acme.com',
  industry: 'SaaS',
  address: '123 Main St',
  logo_url: '<public_url_from_storage_upload>',
}).select().single();
```

**Update:**
```ts
await supabase.from('company_profiles').update({ industry: 'FinTech' }).eq('id', profileId);
```

---

### Company Legal Info

One-to-one extension of `company_profiles` for tax/legal data.

**Table:** `company_legal_info`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `company_profile_id` | uuid | FK → `company_profiles.id` (unique) |
| `legal_business_name` | text | Required |
| `tax_id_number` | text | Optional (EIN, VAT, GSTIN, etc.) |
| `legal_address` | text | Optional |
| `business_type` | smallint | See [Enums](#enums-reference) → `BusinessType` |
| `created_at`, `updated_at` | timestamptz | Auto |

```ts
await supabase.from('company_legal_info').insert({
  company_profile_id: profile.id,
  legal_business_name: 'Acme Incorporated',
  tax_id_number: '12-3456789',
  legal_address: '123 Main St, NY 10001',
  business_type: 1, // NOT_SURE
});
```

---

### Clients

The user's customers (used as the "bill-to" on invoices/estimates).

> **No subscription gating.** Any authenticated user can create unlimited clients regardless of plan or trial status. Clients and products are **not tied to the segmented credit wallet** (which only tracks `invoice`, `estimate`, and `ai_estimate` buckets). Limits are enforced at the document level (invoices/estimates), not on the catalog.

**Table:** `clients`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `name` | text | Required |
| `email` | text | |
| `phone` | text | |
| `company` | text | |
| `address` | text | |
| `notes` | text | |

**List my clients:**
```ts
const { data } = await supabase
  .from('clients')
  .select('*')
  .order('created_at', { ascending: false });
```

**Create / Update / Delete:** standard `.insert()`, `.update().eq('id', id)`, `.delete().eq('id', id)`.

---

### Products

Reusable line-items priced per unit. `ref` is **auto-generated** by a database trigger as `PRD-XXXXXXXX`.

> **No subscription gating.** Products are unlimited for all authenticated users (paid, trial, or no subscription). Credit consumption only happens when an invoice/estimate/AI document is created — not when a product is added to the catalog.

**Table:** `products`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `ref` | text | **Auto-set** (do NOT send on insert) |
| `name` | text | Required |
| `description` | text | |
| `extra_info` | text | Free-form notes |
| `unit_price` | numeric | |
| `unit` | text | e.g. `each`, `hour`, `kg` |

```ts
const { data } = await supabase.from('products').insert({
  user_id: user.id,
  name: 'Consulting hour',
  unit_price: 120,
  unit: 'hour',
}).select().single();
// data.ref === 'PRD-A1B2C3D4'
```

---

### Taxes

Per-user reusable tax catalog (e.g. "VAT 20%", "GST 18%"). Attached to invoice/estimate line items via the join tables below.

**Table:** `taxes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `name` | text | e.g. "VAT" |
| `rate` | numeric | Percent, e.g. `20` |

```ts
await supabase.from('taxes').insert({ user_id: user.id, name: 'VAT', rate: 20 });
```

---

### Discounts

Per-user reusable discount catalog. Same shape as `taxes`.

**Table:** `discounts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `name` | text | e.g. "Loyalty 10%" |
| `rate` | numeric | Percent |

---

### Invoices

**Table:** `invoices`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `client_id` | uuid | FK → `clients.id` |
| `project_id` | uuid | Optional FK → `projects.id` |
| `invoice_number` | text | Frontend-generated (e.g. `INV-2026-0001`) |
| `invoice_date` | date | |
| `due_date` | timestamptz | |
| `payment_terms` | smallint | See [Enums](#enums-reference) → `PaymentTerms` |
| `template_number` | smallint | 1–8, see [Enums](#enums-reference) → `TemplateChoices` |
| `logo_url` | text | From `document-logos` bucket |
| `signature_url` | text | From `signatures` bucket |
| `notes` | text | |
| `subtotal`, `tax_amount`, `tax_percent`, `total` | numeric | Compute on the client; persist |
| `status` | text | `draft` \| `sent` \| `paid` \| `overdue` \| `void` |
| `sent_at` | timestamptz | Set when emailing |

**Create invoice + items in one flow:**
```ts
// 1. Create invoice
const { data: inv } = await supabase.from('invoices').insert({
  user_id: user.id,
  client_id: client.id,
  invoice_number: 'INV-2026-0001',
  invoice_date: '2026-04-17',
  due_date: '2026-05-17',
  payment_terms: 3, // THIRTYDAYS
  template_number: 1,
  notes: 'Thank you!',
  subtotal: 1200, tax_amount: 240, tax_percent: 20, total: 1440,
  status: 'draft',
}).select().single();

// 2. Insert items
const { data: items } = await supabase.from('invoice_items').insert([
  {
    invoice_id: inv.id,
    product_id: product.id,
    description: 'Consulting',
    quantity: 10,
    unit_price: 120,
    total: 1200,
    tax_key: true,
    discount_key: false,
  },
]).select();

// 3. Attach taxes/discounts to a line
await supabase.from('invoice_item_taxes').insert({
  invoice_item_id: items[0].id,
  tax_id: vatTax.id,
});
```

**List invoices for a client (with items):**
```ts
const { data } = await supabase
  .from('invoices')
  .select('*, invoice_items(*, invoice_item_taxes(tax_id), invoice_item_discounts(discount_id))')
  .eq('client_id', clientId)
  .order('created_at', { ascending: false });
```

#### Update an existing invoice (PATCH)

> ⚠️ To **edit** an invoice you must use `UPDATE` (HTTP `PATCH`) against the existing `invoices` row — **do NOT call `insert` again**, that will create a duplicate invoice. Always filter by `id` (and `user_id` for safety). RLS guarantees a user can only update their own invoices.

**REST (raw HTTP):**
```http
PATCH https://avppbvsxayehguepyjkb.supabase.co/rest/v1/invoices?id=eq.<INVOICE_UUID>
apikey: <anon_key>
Authorization: Bearer <user_access_token>
Content-Type: application/json
Prefer: return=representation

{
  "invoice_number": "INV-2026-0001",
  "invoice_date": "2026-04-20",
  "due_date": "2026-05-20",
  "payment_terms": 3,
  "template_number": 2,
  "notes": "Updated notes",
  "subtotal": 1500,
  "tax_amount": 300,
  "tax_percent": 20,
  "total": 1800,
  "status": "sent"
}
```

**Supabase JS SDK:**
```ts
const { data, error } = await supabase
  .from('invoices')
  .update({
    invoice_number: 'INV-2026-0001',
    invoice_date: '2026-04-20',
    due_date: '2026-05-20',
    payment_terms: 3,
    template_number: 2,
    notes: 'Updated notes',
    subtotal: 1500,
    tax_amount: 300,
    tax_percent: 20,
    total: 1800,
    status: 'sent',
  })
  .eq('id', invoiceId)        // REQUIRED — the invoice you are editing
  .eq('user_id', user.id)     // recommended belt-and-braces filter
  .select()
  .single();
```

**Updating invoice line items (edit / add / remove):**

Line items live in the separate `invoice_items` table. To fully sync them on an edit:

```ts
// a) Update an existing line
await supabase.from('invoice_items')
  .update({ description: 'Consulting (Apr)', quantity: 12, unit_price: 120, total: 1440 })
  .eq('id', existingItemId)
  .eq('invoice_id', invoiceId);

// b) Add a new line to the same invoice
await supabase.from('invoice_items').insert({
  invoice_id: invoiceId,
  product_id: product.id,
  description: 'Extra hours',
  quantity: 2, unit_price: 150, total: 300,
});

// c) Remove a line the user deleted in the UI
await supabase.from('invoice_items')
  .delete()
  .eq('id', removedItemId)
  .eq('invoice_id', invoiceId);

// d) After all line changes, re-update the invoice totals
await supabase.from('invoices')
  .update({ subtotal, tax_amount, total })
  .eq('id', invoiceId);
```

> 💡 **Rule of thumb:** `POST /invoices` = create new. `PATCH /invoices?id=eq.<id>` = edit existing. The `id` field never changes — re-use it on every save after the first create.

#### Delete an invoice
```ts
await supabase.from('invoices')
  .delete()
  .eq('id', invoiceId)
  .eq('user_id', user.id);
// invoice_items, invoice_pdfs, invoice_mails, invoice_template_locks
// are removed automatically via cascade.
```

---

### Invoice Items

**Table:** `invoice_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `invoice_id` | uuid | FK → `invoices.id` (cascade delete) |
| `product_id` | uuid | Optional FK → `products.id` |
| `description` | text | |
| `quantity` | numeric | |
| `unit_price` | numeric | |
| `price` | numeric | Snapshot price at invoice time (legacy) |
| `total` | numeric | quantity × unit_price |
| `tax_key` | boolean | `true` = apply taxes from join table |
| `discount_key` | boolean | `true` = apply discounts from join table |

---

### Invoice Item Taxes / Discounts

Many-to-many join tables.

**`invoice_item_taxes`** → links `invoice_items.id` ↔ `taxes.id`
**`invoice_item_discounts`** → links `invoice_items.id` ↔ `discounts.id`

```ts
// Apply two taxes to one line
await supabase.from('invoice_item_taxes').insert([
  { invoice_item_id: itemId, tax_id: vat.id },
  { invoice_item_id: itemId, tax_id: cityTax.id },
]);
```

---

### Invoice PDFs

Stores generated PDF URLs per invoice (history of versions).

**Table:** `invoice_pdfs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `invoice_id` | uuid | FK → `invoices.id` |
| `pdf_url` | text | URL inside `generated-pdfs` bucket |
| `generated_at` | timestamptz | |

> **PDF generation:** Render PDF on the **frontend** (e.g. with `@react-pdf/renderer` or `pdfmake`), upload the blob to `generated-pdfs/<user_id>/...`, then insert the row.

---

### Invoice Mails

Email send history.

**Table:** `invoice_mails`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `invoice_id` | uuid | Optional FK |
| `client_ids` | uuid[] | Recipients in your client book |
| `recipient_emails` | text[] | Raw email addresses |
| `file_url` | text | The PDF that was attached |
| `send_copy` | boolean | BCC sender |
| `status` | text | `sent` \| `failed` \| `queued` |

> **Sending:** Call your own SendGrid edge function (or build one) — this table is just an audit trail. Insert a row after the email is dispatched.

---

### Invoice Template Locks

Locks the chosen template number after first use so the invoice can't be re-themed.

**Table:** `invoice_template_locks` (unique per invoice)

```ts
await supabase.from('invoice_template_locks').insert({
  user_id: user.id,
  invoice_id: inv.id,
  template_number: 3,
});
```

---

### Estimates

Same structure and flow as invoices. Tables: `estimates`, `estimate_items`, `estimate_item_taxes`, `estimate_item_discounts`, `estimate_pdfs`, `estimate_mails`, `estimate_template_locks`.

**Table:** `estimates`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `client_id` | uuid | FK → `clients.id` |
| `project_id` | uuid | Optional FK → `projects.id` |
| `estimate_number` | text | Frontend-generated (e.g., `EST-2026-0001`) |
| `estimate_date` | date | |
| `valid_until` | timestamptz | Expiry date for the estimate |
| `payment_terms` | smallint | See [Enums](#enums-reference) → `PaymentTerms` |
| `template_number` | smallint | 1–8, see [Enums](#enums-reference) → `TemplateChoices` |
| `estimate_type` | text | `manual` \| `ai` |
| `logo_url` | text | From `document-logos` bucket |
| `signature_url` | text | From `signatures` bucket |
| `notes` | text | |
| `subtotal`, `tax_amount`, `tax_percent`, `total` | numeric | Compute on the client; persist |
| `status` | text | `draft` \| `sent` \| `accepted` \| `rejected` \| `expired` |
| `sent_at` | timestamptz | Set when emailing |

**Key differences vs invoices:**
- `estimate_number`, `estimate_date`, `valid_until` (instead of `invoice_number` / `invoice_date` / `due_date`).
- `status` options include `accepted`, `rejected`, `expired` (vs invoice's `paid`, `overdue`, `void`).

**Create estimate + items in one flow:**
```ts
// 1. Create estimate
const { data: est } = await supabase.from('estimates').insert({
  user_id: user.id,
  client_id: client.id,
  estimate_number: 'EST-2026-0001',
  estimate_date: '2026-04-17',
  valid_until: '2026-05-17',
  payment_terms: 2, // FIFTEENDAYS
  template_number: 2,
  notes: 'Valid for 30 days',
  subtotal: 800, tax_amount: 160, tax_percent: 20, total: 960,
  status: 'draft',
}).select().single();

// 2. Insert items
const { data: items } = await supabase.from('estimate_items').insert([
  {
    estimate_id: est.id,
    product_id: product.id,
    description: 'Consulting Services',
    quantity: 8,
    unit_price: 100,
    total: 800,
    tax_key: true,
    discount_key: false,
  },
]).select();

// 3. Attach taxes/discounts to a line
await supabase.from('estimate_item_taxes').insert({
  estimate_item_id: items[0].id,
  tax_id: vatTax.id,
});
```

**List estimates for a client (with items):**
```ts
const { data } = await supabase
  .from('estimates')
  .select('*, estimate_items(*, estimate_item_taxes(tax_id), estimate_item_discounts(discount_id))')
  .eq('client_id', clientId)
  .order('created_at', { ascending: false });
```

#### Update an existing estimate (PATCH)

> ⚠️ To **edit** an estimate you must use `UPDATE` (HTTP `PATCH`) against the existing `estimates` row — **do NOT call `insert` again**, that will create a duplicate estimate. Always filter by `id` (and `user_id` for safety). RLS guarantees a user can only update their own estimates.

**REST (raw HTTP):**
```http
PATCH https://avppbvsxayehguepyjkb.supabase.co/rest/v1/estimates?id=eq.<ESTIMATE_UUID>
apikey: <anon_key>
Authorization: Bearer <user_access_token>
Content-Type: application/json
Prefer: return=representation

{
  "estimate_number": "EST-2026-0001",
  "estimate_date": "2026-04-20",
  "valid_until": "2026-05-20",
  "payment_terms": 3,
  "template_number": 4,
  "notes": "Updated scope and pricing",
  "subtotal": 1200,
  "tax_amount": 240,
  "tax_percent": 20,
  "total": 1440,
  "status": "sent"
}
```

**Supabase JS SDK:**
```ts
const { data, error } = await supabase
  .from('estimates')
  .update({
    estimate_number: 'EST-2026-0001',
    estimate_date: '2026-04-20',
    valid_until: '2026-05-20',
    payment_terms: 3,
    template_number: 4,
    notes: 'Updated scope and pricing',
    subtotal: 1200,
    tax_amount: 240,
    tax_percent: 20,
    total: 1440,
    status: 'sent',
  })
  .eq('id', estimateId)       // REQUIRED — the estimate you are editing
  .eq('user_id', user.id)     // recommended belt-and-braces filter
  .select()
  .single();
```

**Updating estimate line items (edit / add / remove):**

Line items live in the separate `estimate_items` table. To fully sync them on an edit:

```ts
// a) Update an existing line
await supabase.from('estimate_items')
  .update({ description: 'Consulting (Apr)', quantity: 10, unit_price: 120, total: 1200 })
  .eq('id', existingItemId)
  .eq('estimate_id', estimateId);

// b) Add a new line to the same estimate
await supabase.from('estimate_items').insert({
  estimate_id: estimateId,
  product_id: product.id,
  description: 'Additional work',
  quantity: 2, unit_price: 150, total: 300,
});

// c) Remove a line the user deleted in the UI
await supabase.from('estimate_items')
  .delete()
  .eq('id', removedItemId)
  .eq('estimate_id', estimateId);

// d) After all line changes, re-update the estimate totals
await supabase.from('estimates')
  .update({ subtotal, tax_amount, total })
  .eq('id', estimateId);
```

> 💡 **Rule of thumb:** `POST /estimates` (insert) = create new. `PATCH /estimates?id=eq.<id>` (update) = edit existing. The `id` field never changes — re-use it on every save after the first create.

#### Delete an estimate
```ts
await supabase.from('estimates')
  .delete()
  .eq('id', estimateId)
  .eq('user_id', user.id);
// estimate_items, estimate_pdfs, estimate_mails, estimate_template_locks
// are removed automatically via cascade.
```

---

### Estimate Items

**Table:** `estimate_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `estimate_id` | uuid | FK → `estimates.id` (cascade delete) |
| `product_id` | uuid | Optional FK → `products.id` |
| `description` | text | |
| `quantity` | numeric | |
| `unit_price` | numeric | |
| `price` | numeric | Snapshot price at estimate time (legacy) |
| `total` | numeric | quantity × unit_price |
| `tax_key` | boolean | `true` = apply taxes from join table |
| `discount_key` | boolean | `true` = apply discounts from join table |

---

### Estimate Item Taxes / Discounts

Many-to-many join tables.

**`estimate_item_taxes`** → links `estimate_items.id` ↔ `taxes.id`
**`estimate_item_discounts`** → links `estimate_items.id` ↔ `discounts.id`

```ts
// Apply two taxes to one line
await supabase.from('estimate_item_taxes').insert([
  { estimate_item_id: itemId, tax_id: vat.id },
  { estimate_item_id: itemId, tax_id: cityTax.id },
]);
```

---

### Estimate PDFs

Stores generated PDF URLs per estimate (history of versions).

**Table:** `estimate_pdfs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `estimate_id` | uuid | FK → `estimates.id` |
| `pdf_url` | text | URL inside `generated-pdfs` bucket |
| `generated_at` | timestamptz | |

> **PDF generation:** Render PDF on the **frontend** (e.g. with `@react-pdf/renderer` or `pdfmake`), upload the blob to `generated-pdfs/<user_id>/...`, then insert the row.

---

### Estimate Mails

Email send history.

**Table:** `estimate_mails`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `estimate_id` | uuid | Optional FK |
| `client_ids` | uuid[] | Recipients in your client book |
| `recipient_emails` | text[] | Raw email addresses |
| `file_url` | text | The PDF that was attached |
| `send_copy` | boolean | BCC sender |
| `status` | text | `sent` \| `failed` \| `queued` |

> **Sending:** Call your own SendGrid edge function (or build one) — this table is just an audit trail. Insert a row after the email is dispatched.

---

### Estimate Template Locks

Locks the chosen template number after first use so the estimate can't be re-themed.

**Table:** `estimate_template_locks` (unique per estimate)

```ts
await supabase.from('estimate_template_locks').insert({
  user_id: user.id,
  estimate_id: est.id,
  template_number: 3,
});
```

---

### AI Invoices

For PDF-in / PDF-out invoice extraction.

**Table:** `ai_invoices`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `client_id` | uuid | Optional |
| `name` | text | Required label |
| `address` | text | |
| `description` | text | |
| `input_pdf_url` | text | Source PDF (in `ai-inputs` bucket) |
| `output_pdf_url` | text | Generated invoice PDF (in `ai-outputs` bucket) |
| `output_json` | jsonb | Structured extraction |
| `output_markdown` | text | Human-readable extraction |
| `status` | text | `pending` \| `processing` \| `completed` \| `failed` |

**Flow:**
1. Upload source PDF to `ai-inputs/<user_id>/<filename>.pdf`.
2. Insert `ai_invoices` row with `input_pdf_url` and `status='pending'`.
3. Trigger your AI processing edge function (to be built — see roadmap).
4. The edge function writes results back into the same row.

---

### AI Estimates & Results

`ai_estimates` is the parent record (one PDF input → many extracted pages).
`ai_estimate_results` holds per-page output.

**Table:** `ai_estimates`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Owner |
| `client_id` | uuid | Optional |
| `name` | text | |
| `address`, `description` | text | |
| `input_pdf_url` | text | In `ai-inputs` bucket |
| `status` | text | `pending` \| `processing` \| `completed` \| `failed` |

**Table:** `ai_estimate_results`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `ai_estimate_id` | uuid | FK → `ai_estimates.id` |
| `page_number` | integer | |
| `extracted_page_pdf_url` | text | Single-page PDF in `ai-outputs` |
| `output_pdf_url` | text | Generated estimate PDF |
| `output_json` | jsonb | |
| `output_markdown` | text | |

```ts
const { data: pages } = await supabase
  .from('ai_estimate_results')
  .select('*')
  .eq('ai_estimate_id', aiEstimateId)
  .order('page_number');
```

---

### Storage Buckets

All file uploads use Supabase Storage. **Always upload to a folder named after the user's UUID** — the RLS policies enforce this (`storage.foldername(name)[1] = auth.uid()::text`).

| Bucket | Public? | Use For | Path convention |
|--------|---------|---------|-----------------|
| `company-logos` | ✅ Public | Company branding | `<user_id>/logo.png` |
| `document-logos` | ✅ Public | Per-invoice/estimate logo | `<user_id>/<doc_id>.png` |
| `signatures` | 🔒 Private | Signature images | `<user_id>/sig.png` |
| `generated-pdfs` | 🔒 Private | Invoice/estimate PDFs | `<user_id>/<doc_id>.pdf` |
| `ai-inputs` | 🔒 Private | Source PDFs for AI | `<user_id>/<upload_id>.pdf` |
| `ai-outputs` | 🔒 Private | AI-generated artifacts | `<user_id>/<result_id>.pdf` |

**Upload (JS SDK):**
```ts
const file = e.target.files[0];
const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;

const { data, error } = await supabase.storage
  .from('company-logos')
  .upload(path, file, { contentType: file.type, upsert: true });

// Public URL (works for company-logos / document-logos)
const { data: pub } = supabase.storage.from('company-logos').getPublicUrl(path);
console.log(pub.publicUrl); // store this in company_profiles.logo_url

// Signed URL (for private buckets, expires in 1 hour)
const { data: signed } = await supabase.storage
  .from('generated-pdfs')
  .createSignedUrl(path, 3600);
```

**Raw REST upload:**
```http
POST /storage/v1/object/company-logos/<user_id>/logo.png
apikey: <anon_key>
Authorization: Bearer <user_access_token>
Content-Type: image/png

<binary body>
```

---

### Enums Reference

These integer enums come from the legacy Django `choices.py` and are stored as `smallint` in Postgres.

**`PaymentTerms`** (`invoices.payment_terms`, `estimates.payment_terms`):

| Value | Meaning |
|-------|---------|
| 0 | Due on receipt |
| 1 | Net 10 |
| 2 | Net 15 |
| 3 | Net 30 |
| 4 | Net 45 |
| 5 | Net 60 |
| 6 | Net 90 |

**`TemplateChoices`** (`*.template_number`, `*_template_locks.template_number`):

| Value | Template |
|-------|----------|
| 1–8 | Template ONE through EIGHT |

**`BusinessType`** (`company_legal_info.business_type`):

| Value | Meaning |
|-------|---------|
| 1 | Not sure |
| 2 | Other |
| 3 | None |

---

### What's NOT yet exposed via `user-api`

The new business-management tables (`company_profiles`, `taxes`, `discounts`, `invoices`, `estimates`, `ai_*`, etc.) currently have **no custom edge-function endpoints** — the frontend talks to Supabase REST directly using the patterns above.

If you need server-side logic for any of these (e.g. PDF generation, AI extraction, transactional invoice numbering, sending email via SendGrid), tell us and we'll add a dedicated edge function.

---

## Quick Start Checklist

- [ ] Set up Stripe account and get API keys
- [ ] Configure `STRIPE_SECRET_KEY` as backend secret
- [ ] Configure `STRIPE_WEBHOOK_SECRET` for webhook signature verification
- [ ] Create paired monthly/yearly packages in Admin Dashboard
- [ ] Configure trial settings per package (enable trial, set days, set trial credits)
- [ ] Build pricing page with monthly/yearly toggle using `GET /packages`
- [ ] Add "Start Free Trial" button for trial-enabled packages
- [ ] Implement coupon input with `POST /validate-coupon`
- [ ] Implement checkout with `POST /create-checkout` or `POST /start-trial`
- [ ] Build `/payment-success` page that handles both `flow=trial` and regular payment
- [ ] Implement secure logout (invalidate sessions + clear storage)
- [ ] Integrate `POST /consume-credit` for all credit-consuming actions
- [ ] Display wallet balances with `GET /wallet`
- [ ] Check template access with `GET /template-access`
- [ ] Set up Stripe webhook pointing to `/functions/v1/stripe-webhook`
- [ ] Add public support form using `POST /submit-support-query`
- [ ] Monitor support queries in Admin Dashboard → Support Queries
- [ ] Connect Supabase JS SDK with the anon key for direct REST access (clients/products/invoices/estimates)
- [ ] Create the user's `company_profiles` row on first login to the business portal
- [ ] Upload company logo to `company-logos/<user_id>/...` and store the public URL
- [ ] Build invoice/estimate editor reading taxes/discounts catalog
- [ ] Render PDF on client, upload to `generated-pdfs`, insert into `invoice_pdfs` / `estimate_pdfs`
- [ ] Insert into `invoice_template_locks` after first render to lock the chosen template
- [ ] For AI flows, upload source PDF to `ai-inputs/<user_id>/...` and create `ai_invoices` / `ai_estimates` row with status `pending`

---

## Asynchronous PDF Processing Pipeline (`pdf_jobs`)

New async polling architecture for any long-running PDF processing flow that previously timed out when waiting synchronously on FastAPI. Used by the external `app.constil.com` frontend.

### Architecture

```
 Browser → S3 (upload PDF, get pdf_key)
        → Supabase: INSERT into pdf_jobs (status='pending') → returns job id
        → FastAPI: fire-and-forget POST /process-pdf {job_id, pdf_key, selected_scopes}
        → Browser: poll Supabase pdf_jobs every 3–5s by job id
 FastAPI (background) → updates pdf_jobs.status to 'processing' → 'done'/'fail'
                       → writes final payload into pdf_jobs.detail (JSONB)
```

The frontend never waits on FastAPI. It only polls Supabase.

### `pdf_jobs` table

| Column       | Type                  | Notes |
|--------------|-----------------------|-------|
| `id`         | UUID, PK              | Auto-generated. This is the **Job ID**. |
| `userid`     | UUID                  | Must equal `auth.uid()` of the logged-in user. |
| `pdf_key`    | TEXT                  | S3 object key returned from the upload step. |
| `status`     | ENUM `pdf_job_status` | One of `pending`, `processing`, `done`, `fail`. Defaults to `pending`. |
| `detail`     | JSONB                 | Final processed payload — **same shape the old synchronous API returned**. |
| `message`    | TEXT                  | Error text or status notes (shown to the user when `status='fail'`). |
| `created_at` | TIMESTAMPTZ           | Defaults to `now()`. |

### Row Level Security

- A logged-in user can only `INSERT`, `SELECT`, and `UPDATE` rows where `userid = auth.uid()`.
- Admins (role `admin`) can manage every row.
- The FastAPI backend updates `status`, `detail`, and `message` using the **Supabase service role key** (bypasses RLS). The frontend must never use the service role key.

### Frontend Flow (React / Vite)

#### 1. Upload PDF to S3 and create the job

```ts
import { supabase } from "@/integrations/supabase/client";

// Step A — existing logic: upload PDF to S3, get back the key
const pdfKey = await uploadPdfToS3(file); // your existing function

// Step B — current user
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("Not authenticated");

// Step C — create the job row
const { data: job, error: jobErr } = await supabase
  .from("pdf_jobs")
  .insert({
    userid: user.id,
    pdf_key: pdfKey,
    status: "pending",
  })
  .select("id")
  .single();

if (jobErr) throw jobErr;
const jobId = job.id;

// Step D — fire-and-forget call to FastAPI (do NOT await long processing)
fetch(`${import.meta.env.VITE_FASTAPI_URL}/process-pdf`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    job_id: jobId,
    pdf_key: pdfKey,
    selected_scopes: selectedScopes, // e.g. ["Framing"]
  }),
}).catch((e) => console.warn("Trigger failed (job will stay pending):", e));

// Step E — start polling (see hook below) using jobId
```

#### 2. Polling hook

Polls `pdf_jobs` every 4 seconds until `status` is `done` or `fail`. The existing UI rendering logic stays untouched — feed `detail` into the same state setter the old synchronous flow used.

```ts
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePdfJobPolling(
  jobId: string | null,
  onDone: (detail: any) => void,
  onFail: (message: string) => void,
) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      const { data, error } = await supabase
        .from("pdf_jobs")
        .select("status, detail, message")
        .eq("id", jobId)
        .maybeSingle();

      if (error) {
        console.error("Poll error:", error);
        return; // keep polling on transient errors
      }
      if (!data) return;

      if (data.status === "done") {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        onDone(data.detail); // <-- pass JSON to existing UI state
      } else if (data.status === "fail") {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        onFail(data.message || "Processing failed.");
      }
      // pending / processing → keep polling
    };

    poll(); // immediate first call
    intervalRef.current = window.setInterval(poll, 4000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [jobId, onDone, onFail]);
}
```

Usage inside your existing component (UI unchanged):

```tsx
const [jobId, setJobId] = useState<string | null>(null);
const [pdfData, setPdfData] = useState<any>(null); // existing state, existing UI
const [error, setError] = useState<string | null>(null);

usePdfJobPolling(
  jobId,
  (detail) => setPdfData(detail),  // same setter as before
  (msg) => setError(msg),
);
```

#### 3. Optional: Realtime instead of polling

If you'd rather skip polling, subscribe to row updates:

```ts
supabase
  .channel(`pdf_job_${jobId}`)
  .on("postgres_changes", {
    event: "UPDATE",
    schema: "public",
    table: "pdf_jobs",
    filter: `id=eq.${jobId}`,
  }, (payload) => {
    const row = payload.new as any;
    if (row.status === "done") onDone(row.detail);
    if (row.status === "fail") onFail(row.message);
  })
  .subscribe();
```

(Realtime must be enabled for `pdf_jobs` — request it if you want this option.)

### FastAPI backend contract

The FastAPI endpoint that the frontend calls should:

1. Accept `{ job_id, pdf_key, selected_scopes }` and return immediately (e.g. `{"accepted": true}`).
2. Spawn a background task (BackgroundTasks / Celery / RQ).
3. In the background task, using the **Supabase service role key**:
   - `UPDATE pdf_jobs SET status='processing' WHERE id = job_id`
   - Run the heavy PDF/scope processing.
   - On success: `UPDATE pdf_jobs SET status='done', detail=<json payload> WHERE id = job_id`
   - On failure: `UPDATE pdf_jobs SET status='fail', message=<error string> WHERE id = job_id`

Example background update from Python:

```python
from supabase import create_client

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

sb.table("pdf_jobs").update({"status": "processing"}).eq("id", job_id).execute()

try:
    detail = process_pdf(pdf_key, selected_scopes)  # heavy work
    sb.table("pdf_jobs").update({
        "status": "done",
        "detail": detail,   # SAME shape the old sync API returned
    }).eq("id", job_id).execute()
except Exception as e:
    sb.table("pdf_jobs").update({
        "status": "fail",
        "message": str(e),
    }).eq("id", job_id).execute()
```

### Direct REST examples (no SDK)

Replace `<SUPABASE_URL>` and `<ANON_KEY>` with your project values, and `<JWT>` with the user's access token.

**Insert job:**
```bash
curl -X POST "<SUPABASE_URL>/rest/v1/pdf_jobs" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"userid":"<auth-uid>","pdf_key":"uploads/abc.pdf","status":"pending"}'
```

**Poll job:**
```bash
curl "<SUPABASE_URL>/rest/v1/pdf_jobs?id=eq.<JOB_ID>&select=status,detail,message" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT>"
```

### Notes & Best Practices

- **Polling interval:** 3–5 seconds is recommended. Don't go below 2s to avoid hammering the DB.
- **Cleanup:** Always clear the interval on unmount, on `done`, and on `fail`.
- **`detail` shape:** Whatever JSON the old synchronous API returned, store it verbatim under `detail`. The UI never has to change.
- **Stale jobs:** Optionally add a cron task (pg_cron) that flips jobs stuck in `processing` for >15 minutes to `fail` with `message='Timed out'`.
- **Security:** Service role key lives only on the FastAPI server. The browser uses the anon key + user JWT — RLS guarantees users only see their own jobs.
