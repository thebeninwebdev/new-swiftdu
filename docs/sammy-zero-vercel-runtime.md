# Sammy: zero Vercel runtime dependencies

This migration is stricter than the original order-only and 15-route staff API
migrations. The aim is that **a normal Telegram or WhatsApp interaction works
while all Vercel functions are inaccessible**, provided the two Render services,
MongoDB Atlas and the third-party communication services remain available.

The public SwiftDU website still runs on Vercel. Optional website links, user
dashboards, payment pages and in-browser order tracking are NOT being migrated
as part of this work. They will not load during a Vercel outage; they are not
required for Sammy's Telegram or staff-assisted WhatsApp order creation.
If you require those webpages to work without Vercel, migrate the SwiftDU
website separately.

## Bot-side network dependency graph

```
Telegram -> sammy-by-swiftdu (Render)
  -> swiftdu-orders (Render) /api/internal/sammy/staff/*
  -> swiftdu-orders (Render) /api/internal/sammy/telegram/link/*
  -> MongoDB Atlas + Telegram API / Resend (where needed)

New staff Telegram linking:
  Telegram bot (Render) issues one-time challenge -> Render /telegram/connect
  -> verified account email OTP via Resend
  -> existing consumeTelegramLink transaction on MongoDB
  -> return to Telegram bot

WhatsApp (when auto-reply enabled) -> sammy-by-swiftdu (Render)
  -> direct MongoDB / Meta Graph API
  -> swiftdu-orders (Render) /api/internal/sammy/orders/current
  -> swiftdu-orders (Render) /api/internal/sammy/orders/current/cancel

Existing WhatsApp customer linking:
  WhatsApp registration challenge -> Render /whatsapp/connect
  -> verified account email OTP via Resend -> MongoDB record marked linked
```

**No bot HTTP request should use `SAMMY_SWIFTDU_URL` or fetch a Vercel
endpoint.** The optional `SITE_URL` and `SAMMY_SWIFTDU_URL` website values
remain only for explicitly user-facing website, tracking or payment links.

## Render backend configuration (new-swiftdu / swiftdu-orders)

Set these on the existing Render backend service **before** deploying the new
bot branch. Use the actual project credentials in Render, not Git:

```dotenv
MONGODB_URI=<same MongoDB Atlas cluster as SwiftDU>
SAMMY_SWIFTDU_INTERNAL_SECRET=<same secret as Sammy webhook service>
SWIFTDU_BASE_URL=https://swiftdu.org
SAMMY_LINK_OTP_SECRET=<independent random string of at least 32 characters>
RESEND_API_KEY=<valid Resend API key>
EMAIL_FROM_ADDRESS=<address on a verified sending domain>
EMAIL_FROM_NAME=SwiftDU Support
```

Retain existing operations, Ably, VAPID and Telegram notification configuration
for orders. Verify `OPERATIONS_ENABLED` deliberately and preserve training-mode
isolation. Do not change it as part of the routing refactor.

The backend still uses `npm run start:order-api`. It now also exposes:

- GET `/telegram/connect?token=...`
- POST `/telegram/connect/request-code`
- POST `/telegram/connect/confirm`
- GET `/whatsapp/connect?token=...`
- POST `/whatsapp/connect/request-code`
- POST `/whatsapp/connect/confirm`
- POST `/api/internal/sammy/orders/current` (bearer-authenticated)
- POST `/api/internal/sammy/orders/current/cancel` (bearer-authenticated)

The existing 15 staff/Telegram-link API routes remain on Render. This is an
allowlist, NOT a reverse proxy to the Vercel website.

### Connection security

- One-time high-entropy per-Telegram or per-WhatsApp challenge token.
- Verified email ownership: 8-digit Resend code expires after 10 minutes;
  five incorrect attempts invalidate it.
- Server-side HMAC of verification code. The raw code is never stored.
- Rate limits on token requests and per existing account.
- Accounts must have `emailVerified: true`; Telegram accounts must retain
  the existing admin/EXCO eligibility checks, suspension controls, revocation,
  unique Telegram ID and MongoDB transaction rules.
- WhatsApp linking preserves the user's opt-out of proactive messages; no
  unsolicited notification consent is inferred from connecting the account.
- Bot endpoints require the existing bearer secret, and email portal forms
  require the high-entropy challenge token and same-origin submission.
- No unverified or unknown email receives a code; the response is generic to
  prevent account enumeration.

## Render Sammy bot configuration

```dotenv
SWIFTDU_STAFF_API_URL=https://swiftdu-orders.onrender.com
SAMMY_SWIFTDU_INTERNAL_SECRET=<identical Render API secret>
SAMMY_TELEGRAM_BOT_TOKEN=<existing bot token>
SAMMY_TELEGRAM_WEBHOOK_SECRET=<existing secret>
MONGODB_URI=<same MongoDB>
SAMMY_SWIFTDU_URL=https://www.swiftdu.org
SITE_URL=https://www.swiftdu.org
```

`SWIFTDU_STAFF_API_URL` is used for Telegram staff, Telegram challenges,
Render verification links, WhatsApp registration links, and WhatsApp tracking/
cancellation. **Never** configure it to the SwiftDU website or Vercel.

The bot retains its existing Telegram and WhatsApp webhook URLs. There is no
change in bot tokens or sender phone numbers.

## Safe deployment sequence

1. Review the PRs and run all checks before changing production:
   `npm run test:render-order-api && npx tsc --noEmit` (SwiftDU) and
   `npm test && npm run typecheck` (Sammy).
2. Configure `SAMMY_LINK_OTP_SECRET` and Resend email on the
   `swiftdu-orders` service. The email sender domain must be verified.
3. Deploy the **SwiftDU Render backend first**. Its Blueprint currently uses
   `autoDeploy: false`. Verify GET `/health` and the new portal 410
   response with an invalid token.
4. Leave Vercel running, but verify (with staging mocks/logs) that bot
   network calls only target Render, Telegram API, Meta API, Resend and MongoDB.
5. Merge/deploy the Sammy bot changes only after the backend is healthy
   (`sammy-by-swiftdu` is set to `autoDeploy: true`).
6. Smoke-test an existing linked staff account, a NEW unlinked staff account
   with a verified email, staff authorization revocation, valid/expired
   and wrong email codes, customer lookup and quotation, training-mode
   order confirmation and cancellation.
7. Smoke-test new and existing WhatsApp customers, registration via email
   code, order lookup and cancellation; verify a customer without an account
   can still be assisted and registered by Telegram staff.
8. Confirm there are **zero Sammy-caused Vercel function invocations** in
   Vercel observability while operating the Telegram and WhatsApp bots.
9. Only then enable live traffic if it was disabled, retaining rollback-ready
   previous Render deployments.

## Rollback

Keep old deployments and do not delete any MongoDB data. Revert **Sammy bot
first** and only then revert SwiftDU Render backend, after in-flight requests
complete. The old bot points Telegram linking to the website, so it
reintroduces a Vercel dependency and should be a temporary emergency fallback.

## Free hosting caveat

Sammy and SwiftDU Render API are separate long-running services and share
Render free instance-hour quotas if on the same workspace. Keeping two
free services awake 24/7 typically exceeds the free monthly hour allowance.
Plan for sleeping/free tier or a single consolidated service after the bot
migration is verified.

## Existing frontend scope

Vercel remains the origin for customer/tasker dashboards and optional
tracking/payment URLs. If `swiftdu.org` is unavailable, a customer cannot use
those webpages, but the staff-assisted Telegram order creation and direct
WhatsApp interactions should remain possible without calling Vercel.
