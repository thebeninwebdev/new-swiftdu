# Capacity

## Current architecture

SwiftDU is a Next.js application using MongoDB/Mongoose, Socket.IO rooms for targeted order updates, and Serwist with network-only handling for APIs and transactional navigation.

## Database connections and indexes

Mongoose reuses one connection promise per warm instance. Defaults are conservative for multi-instance Fluid Compute: `maxPoolSize=10`, `minPoolSize=0`, `maxIdleTimeMS=30000`, and `serverSelectionTimeoutMS=10000`; all are environment-configurable. The native MongoDB client remains because Better Auth and the password-status route use it.

Order hot-path indexes include status/created time, user/test/status, tasker/status/created time, task type/status/created time, test/status/created time, destination/room/status, and sparse unique `userId + idempotencyKey` for safe client retries.

## Realtime and correctness

Socket.IO remains primary. Healthy dashboards reconcile every 60 seconds; disconnected dashboards poll every 10 seconds and reconcile immediately when reconnecting. Socket event bursts are debounced while applying event payloads locally.

Order submissions use a client-generated `Idempotency-Key`, scoped to the authenticated user. First-order bonus reservation is serialized in a MongoDB transaction on the customer document. Settlement webhook handling validates Paystack signatures and safely acknowledges already-paid settlements. Existing conditional `findOneAndUpdate` acceptance remains the single-winner guard.

## Load testing

See `tests/load/README.md`. Use staging only. Watch request rate, p50/p95/p99 latency, HTTP 5xx/429, Atlas connection count/CPU/query latency, Vercel function duration, and Socket.IO connections.

Capacity is not claimed until measured under representative staging load. Interpret results alongside the selected MongoDB Atlas tier.

## Future operational capacity control

Future admission control should use checked-in taskers, active/pending orders, and average completion time to pause new orders or clearly communicate a queue when capacity is exhausted. This is not implemented here.