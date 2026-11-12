# Sammy Telegram: remove runtime Vercel API dependency

This change migrates **all Telegram staff API operations** to the existing
`swiftdu-orders` Render service. The SwiftDU website, PWA, end-user authentication,
customer/tasker dashboards and payments continue to run on Vercel.

This is NOT a full SwiftDU backend migration. The website-based
`/telegram/connect` confirmation page still runs on SwiftDU's website, using
the **same MongoDB database** where Render issues linking challenges.

## Architecture

```
Telegram user -> Telegram webhook (sammy-by-swiftdu on Render)
  -> /api/internal/sammy/staff/*  (swiftdu-orders on Render)
  -> /api/internal/sammy/telegram/link/start|status (swiftdu-orders on Render)
  -> existing SwiftDU business services and MongoDB Atlas DIRECTLY

Initial account connection:
Telegram -> SwiftDU /telegram/connect website on Vercel
  -> website session + confirmation (same MongoDB Atlas records)
```

Do not change the public website's Better Auth session origin, account-linking
pages, or the user's public tracking and notification links.

## Supported Render API paths

All handlers execute **in the Render Node process** using the existing Next.js
route modules, not by fetching a `swiftdu.org` URL. All use existing
`SAMMY_SWIFTDU_INTERNAL_SECRET` bearer authentication. The staff-specific
handlers resolve a linked, enabled, non-suspended admin/EXCO account from MongoDB.

| Method | Path | Operation |
| --- | --- | --- |
| POST | /api/internal/sammy/staff/auth | Staff identity and permission check |
| POST | /api/internal/sammy/staff/customers/search | Customer search |
| POST | /api/internal/sammy/staff/customers/create | Register customer |
| POST | /api/internal/sammy/staff/customers/:id | Customer details |
| PATCH | /api/internal/sammy/staff/customers/:id | Update supported customer details |
| POST | /api/internal/sammy/staff/customers/:id/phones | Read/add contact numbers |
| POST | /api/internal/sammy/staff/customers/:id/phones/check | Phone checks |
| POST | /api/internal/sammy/staff/locations | Hostel/room locations |
| POST | /api/internal/sammy/staff/catalog | Services, vendors, destinations |
| POST | /api/internal/sammy/staff/quote | Server-owned pricing |
| POST | /api/internal/sammy/staff/orders | Existing idempotent order creation |
| POST | /api/internal/sammy/staff/orders/search | Order lookup |
| POST | /api/internal/sammy/staff/orders/:id/cancel | Order cancellation |
| POST | /api/internal/sammy/telegram/link/start | Issue Telegram linking challenge |
| POST | /api/internal/sammy/telegram/link/status | Check link status |

No other website, internal API, Next.js authentication or administrative route
is exposed by the Render server. It is NOT an open reverse proxy. Paths and
methods that are not explicitly allowlisted return 404.

## Render: SwiftDU staff API service

Use the EXISTING Render service created from the `new-swiftdu` repo. Do not
create another MongoDB database or replace the existing public website deployment.

- Service name in the existing Blueprint: `swiftdu-orders` (historical name).
- Start command: `npm run start:order-api`.
- Build command: `npm ci --include=dev`.
- Health endpoint: `GET /health`.
- Startup requires MongoDB with transaction support, as previously.
- Keep `SAMMY_SWIFTDU_INTERNAL_SECRET` identical on the API and bot services.
- Keep `MONGODB_URI` pointing to the same SwiftDU Atlas database as the website.
- Set `SWIFTDU_BASE_URL=https://swiftdu.org` to the public website origin.
- Review `OPERATIONS_ENABLED` carefully. The Blueprint defaults to `false`
  for safe training tests; enabling live order creation is a separate decision.
- Preserve `ABLY_API_KEY` for real-time order updates.
- Preserve VAPID and Telegram notification keys/chats as required to send tasker
  and staff notifications from the Render order-creation worker.
- Keep `autoDeploy: false` for deliberate rollout.

All of the above variables are server-side; do NOT copy live secrets into Git.

## Render: Sammy Telegram webhook service

The BOT service must have:

```text
SAMMY_TELEGRAM_BOT_TOKEN=<existing staff bot token>
SAMMY_TELEGRAM_WEBHOOK_SECRET=<existing webhook secret>
SAMMY_SWIFTDU_INTERNAL_SECRET=<identical to SwiftDU Render API>
MONGODB_URI=<existing SwiftDU MongoDB>
SWIFTDU_STAFF_API_URL=https://<YOUR-SWIFTDU-RENDER-API-HOST>
SAMMY_SWIFTDU_URL=https://www.swiftdu.org
SITE_URL=https://www.swiftdu.org
```

`SWIFTDU_STAFF_API_URL` is the **Render API origin**, no trailing API path.
It is mandatory with the new Sammy bot code. It MUST NOT point to a Vercel
deployment, `swiftdu.org`, or `www.swiftdu.org`.

`SAMMY_SWIFTDU_URL` is **not** used for bot API requests anymore. It remains
the public website URL for linking instructions and account sign-in.

The previous `SWIFTDU_ORDER_API_URL` order-only setting is now unused by
the Telegram staff API and may be removed AFTER verifying the new routing.
The new bot deliberately fails closed if the Render staff API URL is missing or
points at the public website. It never falls back to Vercel after a timeout.

Do not change `SAMMY_TELEGRAM_BOT_TOKEN`, webhook URLs, Telegram bot account
ownership, or customer-facing domains during this migration.

## Safe rollout: exact order

1. Merge and deploy **new-swiftdu** Render service changes FIRST. Do not
   change its website deployment or customer order creation.
2. Check `/health` and Render logs; confirm the service is healthy.
3. Run `npm run test:render-order-api` against the matching code; smoke test
   `/api/internal/sammy/staff/auth` with wrong credentials to confirm HTTP 401.
   Never use live credentials in publicly accessible terminals or logs.
4. Before deploying the new bot version, add `SWIFTDU_STAFF_API_URL` to the
   Sammy Render service, set to the verified `swiftdu-orders` Render origin.
5. Deploy **sammy-by-swiftdu** with the new routing implementation.
6. Test `/start`, linked EXCO/admin access, customer search, registration,
   catalogue, locations, existing-customer edits, price quote, order search
   and cancellation in a designated test environment.
7. For order creation, use a designated EXCO training account, confirm once,
   and retry the same idempotency key. Verify one order record, one notification
   per channel and correct pricing. Then enable live operation if approved.
8. Check Render logs for `[Sammy Render API request]` on each operation.
9. Check SwiftDU Vercel Functions/Observability during bot use: there should
   be NO `/api/internal/sammy/staff/*` or
   `/api/internal/sammy/telegram/link/*` invocations caused by the bot.
   Website `/telegram/connect`, /auth and tracking pages will still use
   Vercel, as intended.
10. Verify the bot responds with an error rather than silently switching to
    Vercel if the Render staff API is down.

## Rollback

- Keep Vercel's existing internal Sammy routes available until acceptance.
- To roll back, redeploy the PREVIOUS Sammy bot version that supported
  `SAMMY_SWIFTDU_URL` and `SWIFTDU_ORDER_API_URL`; restore their prior
  configuration. Simply deleting `SWIFTDU_STAFF_API_URL` while using the
  new bot version will intentionally break the bot rather than enable Vercel.
- Do not touch existing MongoDB records, revoke linking challenges, or clear
  order idempotency keys as part of a routing rollback.
- Deploy the Render API first; migrate bot traffic only after passing tests.

## Tests

```bash
# in new-swiftdu
npm run test:render-order-api
npm run test:sammy
npx tsc --noEmit

# in sammy-by-swiftdu
npm test
npm run typecheck
```

A Render-hosted bot and a Render-hosted backend are TWO Render services; they
may each consume instance-hours or incur charges depending on the actual plans.
This migration reduces Vercel function invocations but does not mean the
website's own dashboard activity will use no Vercel CPU.
