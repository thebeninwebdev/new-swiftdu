# SwiftDU Render Order API: Phase 1

Phase 1 runs the existing Telegram staff order endpoint in a dedicated Node.js
Web Service. It does not move website order creation: `POST /api/orders` stays
on Vercel. The Render process exposes only `/health` and
`POST /api/internal/sammy/staff/orders`.

## Create the service

Use the Render Blueprint because the repository includes `render.yaml`.

1. In Render, choose **New +** then **Blueprint**.
2. Select GitHub repository `thebeninwebdev/new-swiftdu` and the `main` branch
   containing the Phase 1 changes. For a pre-merge test, select the reviewed
   feature branch instead.
3. Keep the root directory as `.` (the repository root).
4. Review the Blueprint service named `swiftdu-orders` and create it. The
   Blueprint sets `autoDeploy: false`; deployments remain manual.

The exact settings are:

- Runtime: Node
- Root directory: `.`
- Build command: `npm ci --include=dev`
- Start command: `npm run start:order-api`
- Health-check path: `/health`
- Instances: one, to avoid running another copy of post-commit notification
  work while this phase is being evaluated

Do not create a second repository or a second MongoDB database.

## Environment variables

Set these in the Render service's **Environment** page. The Blueprint marks
secret values `sync: false`, so credentials are entered in Render and are not
stored in this repository.

Required:

- `NODE_ENV=production`
- `MONGODB_URI`: the existing SwiftDU database URI, with transaction support
  enabled. Do not paste it into source control or logs.
- `SAMMY_SWIFTDU_INTERNAL_SECRET`: the same high-entropy secret configured on
  Vercel and in Sammy. Keep it server-only and do not log it.
- `SWIFTDU_BASE_URL=https://swiftdu.org`: public website origin used to build
  tracking and notification links.
- `OPERATIONS_ENABLED=false` initially. Enable live ordering only after the
  controlled test and explicit operational approval.
- `PORT`: Render injects this automatically. Do not set or hard-code it.

Notification variables to copy from the existing SwiftDU deployment when the
corresponding delivery channel should be preserved:

- `ABLY_API_KEY` for realtime order broadcasts
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` for
  tasker push notifications
- `TELEGRAM_BOT_TOKEN` (or the existing `TELEGRAM_BOT_API_TOKEN` alias),
  `TELEGRAM_GIRLS_ORDERS_CHAT_ID`, `TELEGRAM_BOYS_ORDERS_CHAT_ID`, and
  `TELEGRAM_TRAINING_ORDERS_CHAT_ID` for staff/tasker Telegram alerts
- `TELEGRAM_ALERTS_ENABLED` if the existing deployment explicitly uses it

These notification values are optional to boot, but missing credentials can
make their channel skip or fail after an order commits. Do not run a duplicate
webhook consumer or scheduled worker on Render. The order API schedules only
the existing per-order post-commit notification jobs.

`.env.example` contains placeholders for local setup only. Never copy real
credentials into it.

## Verify MongoDB and health

The service connects through the existing Mongoose connection and refuses to
listen unless MongoDB reports a replica set with a primary or a sharded
topology. Standalone MongoDB is not accepted because first-order bonus and
order persistence rely on transactions; the service does not downgrade to
non-transactional writes.

After setting `MONGODB_URI` and `SAMMY_SWIFTDU_INTERNAL_SECRET`, deploy
manually. A successful startup logs that the service is listening. A topology
or connection problem causes startup to fail with a sanitized error. Render's
health check should then return HTTP 200 at:

```text
https://<render-service-host>/health
```

The response contains only `{ "status": "ok" }`; it does not expose database
details. HTTP 503 means the Mongoose connection is not ready.

## Controlled Telegram test

The default Blueprint sets `OPERATIONS_ENABLED=false` and Sammy continues to
call the existing Vercel endpoint until its own order-only setting is
explicitly changed. For a safe test:

1. Use an authorized Telegram staff account already linked and enabled in
   SwiftDU.
2. Select a designated EXCO test customer with SwiftDU test-order mode enabled.
   This keeps the order in training mode without enabling live operations.
3. Confirm the Render service has the isolated
   `TELEGRAM_TRAINING_ORDERS_CHAT_ID` and that the training tasker environment
   is configured. Use the smallest supported test order and do not use a real
   customer.
4. Verify Sammy returns the normal compact order response, including the
   tracking URL. Verify the order is visible in SwiftDU with `source` set to
   `telegram_staff`, the expected customer/staff snapshots, and training mode.
5. Confirm the training Telegram alert, tasker push (if configured), and
   realtime update occur once. Retry the same confirmation and verify the
   same order ID is returned rather than a second order.
6. Cancel the test order through the existing SwiftDU-supported workflow.

Do not use a production customer or a live-order account for the first test.
The service reuses current validation, pricing, discount, first-order bonus,
and transaction code; submitted totals and staff/customer identities are not
trusted.

## Sammy routing and rollback

The `sammy-by-swiftdu` checkout was not available alongside this repository,
so this repository cannot change its bot code or production variables. Before
activating Render, update that service so only its staff order-creation client
uses the optional `SWIFTDU_ORDER_API_URL` base URL:

- Unset `SWIFTDU_ORDER_API_URL` by default and retain the bot's current Vercel
  URL selection as the fallback.
- For an explicitly approved test, set it to the Render service origin, for
  example `https://swiftdu-orders.onrender.com`.
- Apply it only when calling
  `POST /api/internal/sammy/staff/orders`. Leave staff auth, customer lookup,
  search, catalog, locations, quote, order search, cancellation, and tracking
  on their existing SwiftDU/Vercel endpoints.
- Keep the same `SAMMY_SWIFTDU_INTERNAL_SECRET` and stable confirmation
  idempotency key. Do not automatically retry against the other backend after
  an ambiguous failure; that can duplicate post-commit notifications even
  though the unique index protects the order record.

To roll back, unset `SWIFTDU_ORDER_API_URL` (or restore the bot's previous
order-only URL setting) and redeploy/restart Sammy. No website setting changes:
website-created orders stay on Vercel throughout Phase 1. Do not remove the
Render service or its database access until any in-flight request/background
notifications have drained.

## Phase 2 boundary

Phase 2 may move website order creation only after Phase 1 transaction,
notification, latency, and rollback behavior have been observed. It requires a
separate reviewed change to the website's `POST /api/orders` routing and an
explicit production rollout. This Phase 1 service does not proxy or accept that
route, and deploying it does not activate that migration.

## Remaining rollout dependency

The Sammy repository must be available to implement and test the optional
`SWIFTDU_ORDER_API_URL` selection. Until that separate change is reviewed and
deployed, keep Sammy on its current Vercel endpoint.