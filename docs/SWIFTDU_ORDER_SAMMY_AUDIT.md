# SwiftDU order, session, and Sammy architecture audit

Audited commit: `fccd9594a22430632fb1b0a102f2e0bd621c6f25` (`fccd959 Improve SwiftDU reliability and dashboard workflows`).

Audit date: 2026-10-29.

## Source discovery

The active checkout and the sibling `C:\Users\user2\Documents\new-swiftdu` checkout were searched for `sammy.swiftdu.org`, WhatsApp webhook handlers, sessions, and processed-message code. Both contain the same disabled Next.js webhook that points at `https://sammy.swiftdu.org/whatsapp/webhook`. No source tree for the external Sammy deployment is present in the accessible workspace. Git history does contain the former co-located state machine, including commit `dc144aad95599527f2dad79813e2d21012212c49`.

Decision: re-home one authoritative conversation adapter in this repository. `/api/whatsapp/webhook` will be the single implementation and may be reached through a reverse proxy/custom-domain rewrite. There will not be a second local handler or an unauthenticated create-for-user API.

## Current customer product flow

`app/dashboard/page.tsx` is the current product source of truth. Its normal service selector exposes restaurant, shopping, printing, water, and Indomie. Deprecated schema values such as `copy_notes`, `dry_cleaning`, and `others` are not offered. Indomie is reachable and uses dedicated current run/mode/capacity helpers.

Vendor-backed services fetch `/api/vendors?serviceType=...`. Active vendors must have an active mapped pickup and an enabled `VendorDeliveryRule`. Drop-offs are parent `CampusLocation` records with optional/required exact children. Restaurant “Choose from anywhere” deliberately has no selected `vendorId`; an Akpan delivery-pricing vendor may be supplied separately as `deliveryPricingVendorId`.

The dashboard obtains server quotes, but `POST /api/orders` recalculates everything. It validates mapped parent/exact locations, room requirements, task-specific input, vendor coverage, service fees, operations state, Indomie mode, discount reservations, first-order eligibility, and test-order authorization.

## Current write domain

The 880-line `app/api/orders/route.ts` combines HTTP authentication and response mapping with the authoritative create domain. It:

- checks request idempotency with the unique `{ userId, idempotencyKey }` index;
- enforces profile completeness;
- validates customer-visible task types and task-specific values;
- resolves `VendorDeliveryRule` pricing and pickup/drop-off snapshots;
- derives delivery policy and `taskerGenderRestriction` from the parent location;
- uses shared pricing/configuration helpers;
- applies the shared sponsored service-fee reservation rule;
- rechecks operations hours and Indomie mode;
- persists through `saveNewOrderWithBonus`, which owns the active-session transaction and first-order claim;
- reserves current Indomie capacity when appropriate; and
- calls `persistThenScheduleOrderCreation`, publishing Ably realtime and scheduling gender-aware push and Telegram work only after persistence.

This must be extracted without changing its calculations or lifecycle sequencing. Website and WhatsApp actors will pass through the same function; source/name/phone/idempotency are actor metadata, not alternate business logic.

## Historical Sammy architecture and drift

The historical route is a monolithic deterministic Mongo-backed state machine. It linked phones explicitly through `WhatsAppRegistration`, but otherwise hardcoded restaurant and destination choices, built `Order` directly, calculated and split fees independently, saved directly, and emitted its own notifications. Tracking was based on WhatsApp phone/source rather than canonical linked `userId`. It had no current vendor rules, mapped exact locations, room policy, first-order transaction, sponsored discount reservation, active-session assignment, current Indomie logic, Ably/post-commit architecture, or robust signature/lease handling.

The current local route is disabled and only returns the external URL. The retained `WhatsAppSession` remains restaurant-only and `WhatsAppProcessedMessage` only records a unique ID after processing; neither is adequate for the modern flow.

## Read architecture and scope matrix

| Path/query family | Classification | Intended scope |
| --- | --- | --- |
| `GET /api/orders` operational lists, `current=true`, review reminders, usage counts | CURRENT_OPERATIONAL / CURRENT_SESSION_HISTORY | Active session, with legacy created-at compatibility; paginated list mode |
| Dashboard My Tasks tabs | CURRENT_SESSION_HISTORY | Active session; request only the selected statuses; limit 20 |
| Dashboard menu/notifications active and review reads | CURRENT_OPERATIONAL | Active session and existing small limits |
| `GET /api/admin/orders` | CURRENT_SESSION_HISTORY | Preserve active-session pagination; use shared helper |
| Admin dashboard recent order/decline activity and operational counts | CURRENT_OPERATIONAL | Active session |
| Tasker available/current work | CURRENT_OPERATIONAL | Active session in addition to existing timeout/mode restrictions |
| Tasker history | CURRENT_SESSION_HISTORY | Active session and validated pagination |
| Order routes addressed by an authorized `_id` | EXACT_RECORD | No automatic session filter |
| Payment, Paystack, refund/dispute investigation | EXACT_RECORD / FINANCIAL | No automatic session filter |
| Tasker debt/settlement and unpaid obligations | FINANCIAL/SETTLEMENT | Explicitly all relevant sessions |
| Admin transactions, explicit period/all-time finance, EXCO reporting | EXPLICIT_HISTORICAL / FINANCIAL | Keep explicit period semantics |
| First-order eligibility and claim consumption | FINANCIAL/SETTLEMENT invariant | Keep existing active-session transaction semantics in its owner |
| Session backfill | EXPLICIT_HISTORICAL | All missing-session orders, batch/cursor, dry-run by default |

The migration-safe session predicate must be composed with `$and`, matching either `sessionId` or a missing/null session ID whose `createdAt` lies inside the active session. An absent active session is an operational 409, never an all-time fallback.

## Existing strengths to preserve

- Admin Orders already uses authorization, active-session dates, 20-row paging, projections, `lean()`, and batched user/tasker enrichment.
- Order idempotency, first-order claim serialization, service-fee discount reservation, Indomie capacity, and post-commit background jobs already exist.
- Ably is the authoritative realtime system; process-local Socket.IO must not be revived.
- Current notification routing already carries tasker mode and gender restriction.
- Registration requires an explicit token-backed account link and blocks suspended users.
- Exact record/payment/settlement paths intentionally retain historical reach.

## Planned staged implementation

1. Add the reusable active-session scope/projection/pagination primitives and characterize them.
2. Migrate customer, tasker, admin operational reads and My Tasks tab loading; add a dry-run-first backfill script.
3. Extract the customer-order create/quote domain and keep the website route as an auth/HTTP adapter.
4. Add the co-located signed webhook, atomic processed-message leases, typed v2 session, deterministic low-bandwidth flow, canonical-user tracking/cancellation, and shared order creation.
5. Keep deployment disabled until tests pass; document the Meta/custom-domain switch and rollback.

## Index assessment before implementation

The current model already has `{ userId, sessionId, isTestOrder }`, `{ userId, isTestOrder, status }`, `{ taskerId, status, createdAt }`, and status/task-type indexes. Query changes will be implemented and inspected before adding any compound index. No speculative index is justified at audit time.
