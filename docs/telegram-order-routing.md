# Telegram destination routing

Order creation and retry save the order first, then call notifyAdminsOfOrderEvent in lib/order-alerts.ts. Telegram errors remain caught; each chat delivery settles independently and has a 10-second timeout. No extra order is created for a broadcast.

## Destination policy

lib/delivery-policy.ts is the shared destination catalogue. The current booking UI and stored orders use free-text locations, not delivery-zone IDs. Matching uses explicit normalized, whole-word aliases and allows room/block details. Customer gender is never consulted.

- Girls Hostel / Female Hostel: female.
- Amnesty / Amnesty Hostel / Boys Hostel / Male Hostel: male.
- Library, PLT, NDDC Auditorium, Staff Quarters, Lecturers Block, Bursary: any.
- Unknown or conflicting destinations: unclassified; no Telegram broadcast or acceptance. Creation/location edits reject unrecognized destinations.
- Law Hall was removed from profile and tasker signup location options, as requested. Existing Law Hall destinations are unclassified.

models/order.ts derives taskerGenderRestriction on validation of new orders and location changes, covering creation and retry. Legacy orders use the same catalogue at read/accept time, so a bulk database migration is not required for recognized destinations. Imported records with a structured restriction can use it when a destination cannot be classified.

## Telegram configuration

Server-only settings (added to .env and .env.example):

TELEGRAM_GIRLS_ORDERS_CHAT_ID=-1004410762658
TELEGRAM_BOYS_ORDERS_CHAT_ID=-1004415332662

Continue using TELEGRAM_BOT_TOKEN (or existing TELEGRAM_BOT_API_TOKEN alias). TELEGRAM_ALERTS_ENABLED=false still disables alerts. Test orders still suppress notifications.

A read-only getChat check confirmed -1004415332662 is SwiftDU Orders Boys. Both positive supplied IDs failed. The negative girls ID also returned chat not found: it is provisional until the bot is added to that chat and its ID verified. No live notification was sent during verification.

getTelegramOrderChatIds in lib/telegram.ts selects only the appropriate chat or both for any. Missing/identical chat configuration fails closed and never falls back to the general channel.

Order alerts now reuse the existing direct sender rather than Sammy: the relay's remote routing is not available in this repository to enforce this policy. The copy-notes channel override also no longer applies to order alerts; its message layout remains unchanged. Configure the bot token in SwiftDU itself.

## Acceptance and visibility

POST /api/errands loads the authenticated tasker's linked User.gender from the database and checks canTaskerDeliver before assignment. Missing/other/undisclosed gender cannot accept a restricted order. Request-supplied gender/restriction fields are ignored. Atomic assignment matches the inspected location and updatedAt to reject a concurrent location edit.

Both available-order endpoints filter with the same policy; existing assigned work remains visible to its tasker in the errands feed. New/retried order web-push notifications also filter approved taskers by linked user gender. Existing mode, verification, settlement and check-in rules still apply.

Pending-order edits recalculate eligibility but do not retract previously delivered Telegram messages. The backend always checks the current order. External producers that write directly to MongoDB must provide correct destination data; unresolved destinations will remain unavailable.

## Verification

Run: npx.cmd tsx --test lib/delivery-policy.test.ts

Tests cover persisted classification, legacy location fallback, all three routing cases, copy notes, relay bypass, missing configuration, partial Telegram failure, and actual acceptance endpoint calls with both mismatches, missing gender and matching/unrestricted success.


## Files changed

- .env, .env.example
- lib/delivery-policy.ts, lib/delivery-policy.test.ts
- models/order.ts
- lib/telegram.ts, lib/order-alerts.ts, lib/push-notifications.ts
- app/api/orders/route.ts, app/api/orders/[id]/route.ts, app/api/orders/[id]/retry/route.ts
- app/api/orders/available/route.ts, app/api/errands/route.ts
- lib/profile-completion.ts, app/tasker-signup/signup/page.tsx
- docs/telegram-order-routing.md

Targeted routing tests and core-file lint pass. Repository TypeScript validation reports an existing unrelated waterBags type error in lib/first-order-pricing.test.tsx:41.
