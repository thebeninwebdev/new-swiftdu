# SwiftDU PWA migration

## Audit before implementation

Inspected package.json and both lockfiles; next.config.ts; tsconfig.json;
.gitignore; pwa/runtime-caching.js and next-pwa/cache.js; public/sw.js,
sw-push.js and service-worker.js; PushSubscriptionManager; manifest and root
layout; offline page/actions; public navigation shell; proxy.ts and operations
helpers/tests; Better Auth server/client and session route; push routes and
subscription persistence; order creation, status, acceptance, retry and payment
routes; tasker availability/onboarding/access; Paystack integration; Socket.IO
server, shared client and order broadcasts. Repository-wide PWA reference search
also found analytics exclusions for /sw.js and /workbox-.

### Existing /sw.js dependencies

- next-pwa injects automatic root-scope registration and generates /sw.js.
- PushSubscriptionManager expects that exact URL, waits for readiness, compares
  VAPID applicationServerKey, reuses compatible subscriptions, and POSTs to the
  authenticated approved-tasker subscription endpoint.
- /sw.js imports /sw-push.js for push, notification clicks and the
  SWIFTDU_SHOW_TEST_NOTIFICATION message. public/service-worker.js also imports
  that script, but no current application code registers that legacy URL.
- Installed PWAs and subscriptions depend on keeping the same origin and scope.
- /offline is the document fallback; the manifest starts at / without start-URL
  caching. Existing proxy unexpectedly authenticates /offline.
- Navigation is NetworkOnly, but retained next-pwa defaults also cache Next data,
  JSON/XML/CSV and arbitrary cross-origin requests. These are unsafe defaults for
  this application and will not be carried forward.
- Operations are server environment driven (OPERATIONS_ENABLED), not a database
  admin toggle. Proxy redirects ordering pages; APIs enforce business rules and
  training-order exceptions independently. Auth, onboarding and internal roles
  must continue to reach these existing checks.
- Socket.IO uses /socket.io polling and WebSocket upgrades with cookie sessions.
  Neither transport should be cached. Payments and mutations must never queue.

Existing uncommitted application edits were present before migration, including
public/sw.js. They must be preserved; generated-worker backup is kept locally
before building, and generated output should cease being tracked.

## References

- https://serwist.pages.dev/docs/next/getting-started (Webpack/App Router/TypeScript)
- https://serwist.pages.dev/docs/serwist/core/serwist
- https://serwist.pages.dev/docs/serwist/runtime-caching

Published @serwist/next 9.5.13 supports Next >=14, React >=18, TypeScript >=5
and Node >=18; SwiftDU uses Next 16.1.6 and retains next build --webpack.
