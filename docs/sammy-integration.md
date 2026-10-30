# Sammy ↔ SwiftDU internal integration

SwiftDU is the business-system source of truth. Sammy remains a separate Render service and owns the Meta inbound webhook, signature verification, conversational state, and WhatsApp message rendering. Meta must continue sending inbound traffic to `https://sammy.swiftdu.org/whatsapp/webhook`; SwiftDU's legacy webhook route remains disabled.

## Authentication

Every request below is `POST`, uses `Content-Type: application/json`, and must include:

```http
Authorization: Bearer <SAMMY_SWIFTDU_INTERNAL_SECRET>
```

Configure the same high-entropy `SAMMY_SWIFTDU_INTERNAL_SECRET` as a server-only variable in Vercel and Render. It must never use a `NEXT_PUBLIC_` name, be sent to a browser, or appear in logs. CORS is not authentication.

Every operation accepts a normalized WhatsApp `phone`. SwiftDU resolves that phone through a `linked` `WhatsAppRegistration`, then loads the linked `user`. Sammy cannot select a `userId`. Missing links, deleted users, and suspended accounts are rejected.

## Endpoints

### `/api/internal/sammy/bootstrap`

Request: `{ "phone": "234..." }`

Returns linked identity, transactional/proactive consent, compact operations state, the four services currently displayed by the website (`restaurant`, `shopping`, `printing`, `water`), and the customer's latest active order. Indomie is intentionally not advertised as a standalone Sammy service.

### `/api/internal/sammy/catalog`

Request: `{ "phone": "234...", "taskType": "restaurant" }`

For restaurant, shopping, and printing, returns active `Vendor` records and customer-safe destinations backed by enabled `VendorDeliveryRule` records. Fees are deliberately omitted. Restaurant returns `supportsChooseFromAnywhere: true`; Sammy must retain the returned delivery-pricing vendor when the customer chooses that option. For water, `destinations` contains active parent campus locations.

### `/api/internal/sammy/locations`

Request: `{ "phone": "234...", "parentLocationId": "..." }`

Returns active exact child locations for the selected active parent. Coordinates are not exposed.

### `/api/internal/sammy/quote`

Request:

```json
{
  "phone": "234...",
  "order": {
    "taskType": "restaurant",
    "description": "Rice and chicken",
    "amount": 4000,
    "store": "Cafe name",
    "vendorId": "...",
    "parentLocationId": "...",
    "exactLocationId": "...",
    "location": "Hall name",
    "roomNumber": "A12",
    "restaurantPeopleCount": 1,
    "restaurantTakeawayCount": 0,
    "cafeInquiry": false
  }
}
```

Returns `amount`, authoritative `serviceFee`, `totalAmount`, first-order bonus preview, service-fee discount preview, and a presentation-safe breakdown. Cafe inquiry uses the website's `cafeInquiry` flag and fee. SwiftDU rejects `userId`, `serviceFee`, `platformFee`, `taskerFee`, or `totalAmount` supplied by Sammy.

### `/api/internal/sammy/orders`

Request: `{ "phone": "234...", "idempotencyKey": "stable-confirmation-id", "order": { ...same draft fields... } }`

The final draft is passed to the same creation service as browser `POST /api/orders`. SwiftDU re-runs profile, commerce, destination, room, vendor coverage, pricing, promotion, academic-session, operations, and test/live validation and schedules the same realtime/push/Telegram work. It writes `source: "whatsapp"` plus customer snapshots and a tracking token.

The response is limited to `_id`, `taskType`, `status`, `description`, `location`, `totalAmount`, `paymentStatus`, and `trackingUrl`.

Idempotency is scoped to the linked SwiftDU user by the unique `(userId, idempotencyKey)` order index. Sammy must generate one stable key when the customer reaches confirmation and reuse it for all retries. A duplicate returns the original order, including after an ambiguous timeout; it never creates another order.

### `/api/internal/sammy/orders/current`

Request: `{ "phone": "234..." }`

Returns `{ "order": <compact order or null> }`. The lookup is by linked SwiftDU user and current academic session, not by `source`, so website-created orders are trackable through Sammy.

### `/api/internal/sammy/orders/current/cancel`

Request: `{ "phone": "234..." }`

Returns `cancelled`, a user-safe `reason`, `currentStatus`, and `trackingUrl`. It invokes the same `cancelCustomerOrder` service as the website; Sammy must not update an order document directly.

### `/api/internal/sammy/consent/opt-out`

Request: `{ "phone": "234..." }`

Sets `whatsappNotificationsEnabled` to false and records `whatsappConsentRevokedAt` without deleting historical consent metadata. This suppresses proactive SwiftDU notifications, but does not prevent direct responses after the customer messages Sammy. An explicit website relink re-enables notifications.

## Error contract

Errors are JSON: `{ "error": "user-safe message", "code": "MACHINE_CODE" }` with an appropriate HTTP status. Important codes include:

- `UNAUTHORIZED`, `INTERNAL_AUTH_NOT_CONFIGURED`
- `INVALID_PHONE`, `WHATSAPP_NOT_LINKED`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_SUSPENDED`
- `PROFILE_INCOMPLETE`, `SERVER_OWNED_FIELD`, `INVALID_IDEMPOTENCY_KEY`
- `INVALID_TASK_TYPE`, `INVALID_DESTINATION`, `INVALID_EXACT_LOCATION`, `EXACT_LOCATION_REQUIRED`, `ROOM_NUMBER_REQUIRED`
- `VENDOR_NOT_FOUND`, `VENDOR_DELIVERY_UNAVAILABLE`
- `RESTRICTED_ITEM`, `INVALID_AMOUNT`
- `OPERATIONS_SUSPENDED`, `OUTSIDE_OPERATING_HOURS`, `NO_ACTIVE_SESSION`

## Ownership and data access

SwiftDU owns users, WhatsApp link/consent records, vendors, vendor delivery rules, campus locations, pricing rules, academic sessions, orders, promotions, validation, cancellation, and downstream order notifications. Sammy owns its conversation state and the Meta webhook.

The pre-integration deployments may point at the same MongoDB and therefore see `whatsappregistrations` and `whatsappsessions` as well as business collections. After migration, Sammy should not read or write `orders`, `vendors`, `vendordeliveryrules`, `campuslocations`, pricing/promotion/session collections, or `user` for ordering. It should use these endpoints. Conversation-session storage may remain on Render; link/consent truth is returned by SwiftDU.

## Render migration checklist

1. Add the SwiftDU base URL and server-only shared secret.
2. At conversation start, call `bootstrap`; guide unlinked users to the existing SwiftDU link UI.
3. Build choices from `catalog` and `locations`; remove hardcoded restaurants and locations.
4. Keep only customer selections in conversational state. Never calculate or submit fees/totals.
5. Call `quote` for review, then `orders` with one stable idempotency key on confirmation.
6. Use `orders/current` for tracking regardless of source and the cancellation endpoint for cancellation.
7. Map “show me what's available” to `cafeInquiry: true`; do not add a parallel schema/state in SwiftDU.
8. On STOP/UNSUBSCRIBE, call `consent/opt-out`. Continue answering customer-initiated messages.
9. Remove direct Order creation and all duplicated pricing, coverage, promotion, operations, session, and validation logic.
