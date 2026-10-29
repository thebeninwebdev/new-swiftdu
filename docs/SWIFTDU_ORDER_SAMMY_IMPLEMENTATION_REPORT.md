# SwiftDU order, current-session, and Sammy implementation report

## 1. Audit identity and source discovery

- Audited commit: `fccd9594a22430632fb1b0a102f2e0bd621c6f25` (`Improve SwiftDU reliability and dashboard workflows`).
- Audit date: 2026-10-29.
- The active checkout and `C:\Users\user2\Documents\new-swiftdu` were searched. Both have the same disabled route pointing to `https://sammy.swiftdu.org/whatsapp/webhook`.
- The actual external Sammy service source was **not found**. It was not represented as updated.
- Historical behavior was reviewed from `dc144aad95599527f2dad79813e2d21012212c49` and the webhook history.
- The pre-implementation architecture and query-scope matrix are in `docs/SWIFTDU_ORDER_SAMMY_AUDIT.md`.

## 2. Architecture chosen

Sammy is co-located in SwiftDU. `/api/whatsapp/webhook` is the only handler. A custom domain or reverse proxy may point `sammy.swiftdu.org/whatsapp/webhook` at this route, but no second handler was added and no DNS/Meta setting was changed.

Both adapters call `createCustomerOrder()` from `lib/orders/customer-order-service.ts`:

```text
Website POST adapter ─┐
                      ├─ createCustomerOrder() ─ authoritative validation/pricing/persistence ─ post-commit jobs
Sammy state machine ──┘
```

The service registers the existing characterized implementation in-process. It makes no HTTP request to SwiftDU and exposes no create-for-arbitrary-user endpoint. The website adapter passes authenticated website actor metadata; Sammy passes the verified linked account. The underlying implementation remains the one current path for validation, vendor/location rules, operations, pricing, promotions, first-order transaction, Indomie capacity, persistence, and notifications.

## 3. Historical drift removed

The restored flow does not hardcode old restaurants or destinations, instantiate/save `Order` itself, split fees itself, or emit a WhatsApp-specific notification fan-out. It does not use phone/source as ownership. It does not restore Socket.IO behavior. It now uses current Vendor/DeliveryRule/CampusLocation data, canonical linked `userId`, active-session ownership, delivery policy, the shared creation path, Ably/post-commit jobs, shared promotions, and current Indomie behavior.

## 4. Sammy behavior

Main menu:

1. Place an order
2. Track my order
3. Cancel my order
4. Speak to support
5. Open SwiftDU

The bot is deterministic and Mongo-backed (`flowVersion: 2`). `MENU`, `BACK`, `CANCEL`, and `START OVER` are global commands. An incompatible legacy in-progress draft resets to the v2 menu. Messages are short, text/list/button based, media-free, and list options page at eight business rows plus Previous/Next.

### Restaurant

- Supports “I know what I want” and the existing cafe inquiry path.
- Loads active restaurants dynamically.
- “Choose from anywhere” stores no `vendorId`; its Akpan coverage ID is retained only as `deliveryPricingVendorId`.
- Collects description, inclusive food/packaging estimate, `RESTAURANT_MAX_PEOPLE`, takeaway/cellophane/mixed packaging, destination, exact child, and room/detail.
- Cafe inquiry uses the same `cafeInquiry` create semantics and shared `CAFE_INQUIRY_EXTRA_FEE` pricing.

### Shopping

Loads active shopping vendors and their enabled destinations, then collects items, budget, mapped delivery details, review, and confirmation. The authoritative POST repeats description/budget/vendor validation.

### Printing

Loads active print vendors and collects printing/photocopying, pages, editing flag, and mapped delivery details. It uses shared printing pricing, never bot constants.

### Water

Collects bag count and active mapped destination details. Shared water pricing remains authoritative.

### Indomie

Indomie remains visible because it is reachable in the current customer dashboard. Sammy checks the current normal/batching/closed mode and stores the expected mode. Final creation rechecks mode, run bookability, slot/capacity reservation, and current batch fields through the shared service. There is no second batching algorithm or generic bot save.

## 5. Dynamic vendors, locations, and gender routing

`lib/whatsapp/order-options.ts` uses fixed-count Mongo queries to load active vendor pickup coverage, enabled delivery rules, referenced active parent locations, and exact children. Vendor-backed location choices are restricted to that vendor's enabled rules. Exact children are checked against the selected parent. Configured room requirements are enforced.

Sammy stores durable IDs/selections, not authoritative fees. The shared order implementation resolves the current parent delivery policy and persists `taskerGenderRestriction`; existing push/Telegram/realtime routing remains responsible for eligibility.

## 6. Quotes, promotions, and final creation

Review quotes use the same vendor/configured fee resolvers, `calculateOrderPricing`, `firstOrderBonusAvailable`, sponsored-discount reservation check, and `priceWithOrderDiscounts`. A SHA-256 fingerprint covers the draft and calculated result. Confirmation recalculates the quote; a changed fingerprint produces a new review rather than silently creating at a changed total.

Creation then recalculates and revalidates everything again. It persists through `saveNewOrderWithBonus`, so website and WhatsApp share the same account/session claim, transaction serialization, session assignment, platform-only waiver, and sponsored service-fee reservation. WhatsApp orders set canonical `userId`, `source: 'whatsapp'`, linked phone/name, `sessionId`, and `sessionName`.

## 7. Account linking, tracking, and cancellation

- Linking remains explicit: phone → registration token → authenticated SwiftDU account. It does not auto-link by matching a user phone.
- Suspended linked users receive a blocked-account message. Incomplete profiles receive `/complete-profile` and cannot bypass website requirements.
- Tracking queries by canonical linked `userId`, active session, and shared active statuses. It finds website or WhatsApp orders, projects a small field set, and sends an authenticated dashboard URL rather than treating a Mongo ID as public authorization.
- Cancellation finds the current-session active order, verifies ownership and `canCustomerCancelOrder`, persists through `saveOrderLifecycle`, preserves paid/protected-order rules and first-order release behavior, and publishes the update. It never deletes an order.
- Support uses `WHATSAPP_SUPPORT_URL` when configured, otherwise the current site `/contact-us` URL.

## 8. Webhook security, deduplication, and failure boundaries

POST handling reads the raw body, validates `X-Hub-Signature-256` with HMAC-SHA256 and `timingSafeEqual`, and only then parses JSON. Missing/invalid signatures return 401. GET verification uses `WHATSAPP_VERIFY_TOKEN`.

`WhatsAppProcessedMessage` now records `processing/completed/failed`, attempts, lease expiry, processed time, and a non-sensitive error code. A unique message ID prevents concurrent duplicate work; expired processing leases and failed work can be reacquired. Confirmation independently uses `whatsapp:{messageId}` against the existing unique `{ userId, idempotencyKey }` order index. A retry recovers the existing order.

After signature verification, parsing, DB connection, and atomic lease acquisition, Vercel `waitUntil()` performs eligible processing. Persistence remains ahead of order notifications. A WhatsApp/Telegram/push/Ably failure after commit does not turn the order into a failed order.

The Meta Graph version is configurable with `WHATSAPP_GRAPH_API_VERSION`; the verified existing `v20.0` remains the fallback.

## 9. Current-session and pagination changes

The shared helper returns the active session or throws an operational 409. Its filter matches either:

- the current `sessionId`; or
- a missing/null legacy `sessionId` whose `createdAt` lies in the session window.

It composes with `$and`, so caller `$or` filters are preserved.

Changed operational reads:

- `GET /api/orders`: current session is now the default for current order, status lists, review reminders, and task-type usage. Explicit `paginated=true` returns page metadata and the session. Page/limit are normalized to 1..50. Search is server-side and escaped.
- My Tasks: fetches only the selected tab (`pending,in_progress,paid`, `completed`, or `cancelled`), 20 rows at a time, with Load more. It no longer requests all five statuses on initial load.
- Dashboard menu/notifications: active and review reads inherit session scope and retain a 12-row cap.
- Admin Orders: preserves the 20-row active-session workspace and now uses the shared migration-safe scope.
- Admin recent order/decline activity and its order counts: default to the active session. Explicit finance period/all-time calculations remain unchanged.
- Tasker available/current errands: current-session scoped in addition to existing timeout, mode, ownership, gender, and capacity behavior.
- Tasker history: current-session scoped, bounded to 50, projected/lean, and returns session metadata. Its displayed completed/earning stats use the same current-session history scope.

Intentionally historical/exact reads retained:

- authorized order-by-ID lifecycle/detail routes;
- Paystack/payment/refund/dispute investigation;
- settlement/debt/unpaid obligations;
- explicit admin/EXCO finance period and all-time reporting;
- first-order claim consumption/release owner logic;
- migrations and audit paths.

These were not blindly session-filtered, so older unpaid obligations do not disappear.

## 10. Projections, query efficiency, and indexes

Reusable customer-card, tasker-card, and Sammy-tracking projections avoid full documents. List paths use database status/search filters, `select`, `lean`, limits, `countDocuments`, or aggregation rather than fetching lifetime data and filtering in clients.

Added indexes, each matching an implemented hot query:

- `{ userId: 1, sessionId: 1, status: 1, createdAt: -1 }` — customer current-session tab/tracking lists.
- `{ taskerId: 1, sessionId: 1, status: 1, acceptedAt: -1 }` — tasker current-session history.
- `{ sessionId: 1, isTestOrder: 1, status: 1, createdAt: -1 }` — current-session operational/admin lists.

No existing index was removed.

## 11. Backfill

`npm run backfill:order-sessions -- --dry-run` is dry-run by default. It streams missing/null-session orders, matches by `createdAt`, assigns only when exactly one academic session contains the date, skips ambiguous/unmatched/already-assigned records, batches writes, and prints counts only.

Apply explicitly with:

```text
npm run backfill:order-sessions -- --apply
```

Optional batch size: `--batch-size=500` (bounded to 1..2000). Deployment does not depend on running it because runtime compatibility remains active.

## 12. Performance observations

Before, My Tasks requested all five statuses and `/api/orders` could return the customer's lifetime collection. After, initial My Tasks requests one current-session tab with a 20-document maximum and a narrow projection; later pages are explicit. Active/review side reads remain capped at 12. Available-task reads cap at 50.

Development/test paginated customer reads log only document count, total count, query duration, and serialized payload bytes—no customer content. No production customer data logging was added. A live Mongo dataset was not available in this workspace, so no fabricated millisecond or byte benchmark is reported; the new instrumentation is the deployment-safe way to capture the real before/after figures.

## 13. Files created

- `docs/SWIFTDU_ORDER_SAMMY_AUDIT.md`
- `docs/SWIFTDU_ORDER_SAMMY_IMPLEMENTATION_REPORT.md`
- `lib/orders/customer-order-cancellation.ts`
- `lib/orders/customer-order-service.ts`
- `lib/orders/order-list-fields.ts`
- `lib/orders/order-session-filter.ts`
- `lib/orders/order-session-scope.ts`
- `lib/orders/order-session-scope.test.ts`
- `lib/whatsapp/architecture.test.cjs`
- `lib/whatsapp/flow.ts`
- `lib/whatsapp/message-lease.ts`
- `lib/whatsapp/order-options.ts`
- `lib/whatsapp/signature.ts`
- `lib/whatsapp/signature.test.ts`
- `lib/whatsapp/webhook-parser.ts`
- `lib/whatsapp/webhook-parser.test.ts`
- `scripts/backfill-order-sessions.ts`

## 14. Files changed

- Order APIs: `app/api/orders/route.ts`, `app/api/orders/available/route.ts`, `app/api/errands/route.ts`, `app/api/taskers/history/route.ts`, `app/api/admin/orders/route.ts`, `app/api/admin/dashboard/route.ts`.
- WhatsApp: `app/api/whatsapp/webhook/route.ts`, `lib/whatsapp/registration.ts`, `lib/whatsapp/send-message.ts`, `models/whatsapp-session.ts`, `models/whatsapp-processed-message.ts`.
- UI reads: `app/dashboard/tasks/TaskListClient.tsx`, `app/dashboard/notifications/page.tsx`, `components/dashboard-menu.tsx`.
- Model/scripts/tests: `models/order.ts`, `package.json`, `lib/order-loading-scope.test.cjs`, `lib/order-creation-background.test.cjs`.

## 15. Verification results

- `npm exec -- tsc --noEmit`: **pass**.
- Focused lifecycle/architecture suite: **17 passed, 0 failed**.
- New session filter, signature, and parser suite: **5 passed, 0 failed**.
- Broader pricing/tracking subset: **34 passed, 3 failed**. One failure was the original test runner's inability to resolve Next's virtual `server-only` marker and was addressed by testing the pure filter module separately. The remaining two are pre-existing `lib/restaurant-estimate.test.ts` expectations: tests expect default fees `600/650`, while current code resolves `0/50`. The implementation did not change those fee values.
- Changed-file ESLint: **0 errors**; its three warnings were fixed.
- `npm run build`: **pass**; optimized compile, TypeScript, page data, and all 130 static pages completed. Webpack emitted a non-fatal cache snapshot warning.
- `git diff --check`: **pass** (only Git's existing LF→CRLF working-copy notices).

## 16. Required environment and deployment steps

Required for the webhook/send path:

- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

Optional:

- `WHATSAPP_GRAPH_API_VERSION` (fallback remains `v20.0`)
- `WHATSAPP_SUPPORT_URL` (fallback is the configured SwiftDU `/contact-us`)
- the repository's existing database, site URL, Ably, push, and Telegram variables.

Safe rollout:

1. Deploy this commit without changing Meta's callback.
2. Set the four required WhatsApp secrets in the target environment; verify Graph `v20.0` is still enabled for the Meta app or set the verified supported version explicitly.
3. Create/confirm Mongo indexes and run the backfill dry run. Review only counts; apply separately if desired.
4. Exercise GET verification and signed POST fixtures in preview/staging, then complete linked-account restaurant/shopping/printing/water/Indomie flows and duplicate-confirmation retries.
5. Point Meta directly to `https://swiftdu.org/api/whatsapp/webhook`, **or** configure `sammy.swiftdu.org/whatsapp/webhook` as a reverse proxy/rewrite to that exact route. Do not run both consumers.
6. Update the Meta callback URL and verify token, subscribe to message events, send a canary order, and confirm Admin Orders, tasker routing, Ably, push, and Telegram.

No DNS or Meta configuration was modified by this change.

## 17. Rollback

1. Restore Meta's callback to the prior external Sammy URL (or disable the new custom-domain rewrite).
2. Revert the application commit. New session/index fields are additive; no destructive schema migration is required.
3. If the optional backfill was applied, it can safely remain because it only fills correct unambiguous session metadata. Do not delete historical orders or claims.
4. Existing orders remain recoverable by the unique user/idempotency key even if an outbound WhatsApp response failed during cutover.

## 18. Business-rule confirmation

No service fee, vendor delivery price, platform/tasker split, first-order semantics, sponsored-discount semantics, water/printing/restaurant/cafe pricing, gender policy, operations hours, Indomie capacity/run algorithm, tasker timeout/check-in/capacity/verification/settlement behavior, payment/Paystack behavior, resolution logic, test-order behavior, Telegram routing, Ably architecture, PWA behavior, or historical finance capability was intentionally changed. This implementation changes shared orchestration, WhatsApp adaptation, and operational read scope/paging—not the underlying pricing/payment/settlement/tasker rules.
