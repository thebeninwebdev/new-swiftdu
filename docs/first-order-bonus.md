# First-order platform-fee bonus

New live orders reserve one bonus on the existing customer account. Normal pricing
is calculated first. The order stores `firstOrderBonusApplied`,
`platformFeeBeforeFirstOrderBonus`, and `firstOrderBonusAmount`. Only SwiftDU's
platform share is removed; the item budget and normal tasker fee are retained.
Water and copy-notes use their dedicated pricing definitions rather than the
tiered service-fee split.

The existing sponsored service-fee discount runs first. A first-order bonus then
discounts only the remaining platform share, including the platform portion of
the retained cafe charge. It does not introduce new reimbursement instructions.
An order can therefore carry the bonus marker with zero additional savings.

## Persistence and deployment

For the local Windows MongoDB 8.3 service, run
`powershell -ExecutionPolicy Bypass -File scripts/enable-local-mongodb-transactions.ps1`
from an administrator terminal. It backs up `mongod.cfg`, enables the
`swiftdu-rs` single-node replica set using the existing data directory, restarts
the `MongoDB` service, and verifies a transactional read. The helper is specific
to the local service on port 27017; do not use it for a production database.
Restart the application after changing the database topology if its existing
connection still reports the old standalone configuration.

The error `Transaction numbers are only allowed on a replica set member or mongos`
means the server is still running as a standalone. Adding `replicaSet` to the
connection string alone does not enable replication on the server.

- **MongoDB must support transactions (replica set or sharded cluster).** There is
  deliberately no unsafe standalone fallback. Creation, customer reservation,
  completion and cancellation writes serialize through the same user document.
- Restart all application workers to load the new user/order schema fields.
- Deploy all order writers together. `saveNewOrderWithBonus` must receive normal,
  undiscounted pricing; repricing uses `priceWithOrderDiscounts` on newly calculated
  prices. Never apply it to an already discounted order snapshot.
- No entitlement backfill is required: eligibility queries legacy completed live
  orders as well as the persisted consumption marker. Existing paid/completed
  orders are not repriced or refunded. The added order index
  `{ userId: 1, isTestOrder: 1, status: 1 }` should be created through the deployment's
  normal index-management process if automatic index creation is disabled.
- User fields: `firstOrderBonusOrderId`, `firstOrderBonusConsumedAt`, and
  `firstOrderBonusVersion` (transaction serialization counter). The consumed marker
  is permanent, even if a completed order is later administratively cancelled.
- Unpaid cancellation, deletion-as-cancellation, and expiry release the exact
  reservation. Payment/transfer history prevents release after a payment dispute.
  Missing reserved orders and paid administrative cancellations require manual
  review under the existing refund policy; no expiry lease can silently grant a
  second bonus. Already quoted paid orders retain their price.
- Zero platform fee means `settlementStatus: not_due`, without a due date, payment
  timestamp, Paystack reference, or invented successful transaction. It is excluded
  from overdue and suspension queries. Receipt reports do not restore the fee.

## WhatsApp

This repository's WhatsApp webhook is disabled and points to the separate Sammy
service. No WhatsApp order creator remains here. Eligibility uses the existing
verified `WhatsAppRegistration` link to include that phone's legacy WhatsApp order
history with the linked website account. Unverified phone text is never used to
create a new entitlement.

The external service must use the linked account's `userId` and the same reservation,
pricing, and lifecycle helpers before offering this bonus. Its code and deployment
are outside this repository. A separate phone-based bonus must not be introduced.

## Validation

`npm run test:first-order` runs pricing/render tests and real MongoDB transaction
tests using an isolated temporary replica set from `mongodb-memory-server`. It
does not read or connect to the application's `MONGODB_URI`. The first run downloads
a MongoDB test binary; `MONGOMS_SYSTEM_BINARY` can point to an existing compatible
local binary. Tests cover concurrent claims, rollback, consumption, cancellation,
training history, linked WhatsApp history, settlement exclusion and receipt reports.

Booking availability is a preview, not a reservation. Creation returns the final
authoritative price, which checkout and tracking display before transfer.
