# WDU Business Directory

`/businesses` is public, including while `OPERATIONS_ENABLED=false`. It uses the existing public shell, Manrope theme, navigation and footer. `/admin/businesses` uses the existing admin shell and Better Auth admin/exco authorization.

## Setup

Set `GEMINI_API_KEY` on the server. `GEMINI_BUSINESS_REVIEW_MODEL` defaults to `gemini-3.8-flash`; override it with a multimodal, structured-output Flash model available in your Google project. Enable billing/quota as appropriate for that project. No Gemini credentials belong in `NEXT_PUBLIC_*`.

Reuse `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, or set `CLOUDINARY_CLOUD_NAME`. Add server-only `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` from the same Cloudinary account. Uploads are signed on the server. No new unsigned preset is needed, and the existing profile preset is unchanged. Optionally create a **signed** image upload preset and set `CLOUDINARY_BUSINESS_UPLOAD_PRESET`; it must permit WebP and preserve the supplied `swiftdu-businesses/…` public ID. With this variable blank, signed upload parameters work without a dashboard preset.

The existing `MONGODB_URI` is reused. The new `Business` collection creates name, contact, Instagram, slug, category, status and date indexes. MongoDB must permit index creation. Unique name/Instagram indexes and a unique multikey contact index back up human-friendly duplicate queries and prevent concurrent exact-contact races, including swapped phone/WhatsApp numbers.

## Submission and review

`POST /api/businesses` accepts bounded multipart input and one JPEG/PNG/WebP up to 2 MB. It validates fields and a honeypot, normalizes Nigerian contacts and Instagram handles, decodes the image, strips metadata and resizes it. Exact duplicate checks run before Gemini. A streamed name comparison selects at most five ambiguous candidates using Dice similarity; very close names return 409 immediately.

Gemini receives bounded business data, the image inline and those candidates. A centralized policy and system instruction treat all submitted text and image contents as untrusted classification data. JSON-schema output is validated again in application code; unknown candidate IDs are ignored. Only confident, safe, relevant, plausible, flag-free results with no duplicate concern can publish. Model errors and malformed results return a retryable 503 and never publish.

Approved submissions reserve their unique keys privately, upload to Cloudinary, then become visible. New submissions use automatic approval: deterministic field, contact, duplicate and image validation runs before Gemini screens text and logos for fraud, sexual content and the directory policy. Uncertain results return 422 with a correction message and create no record; unavailable or malformed Gemini responses return retryable 503 and create no record. No normal submission is queued for manual approval. Legacy review records remain available to admins. Admins can inspect that image through an authenticated, no-store endpoint and approve or reject. Approval uploads it and removes the private copy; rejection removes the private copy. A request interrupted after reservation leaves a reviewable record. Upload failures attempt reservation/image cleanup. Cleanup failures are logged for operator follow-up.

Rejected automated submissions create no record or permanent image. Admin-rejected records retain their name/contact reservations to prevent anonymous resubmission from bypassing review. Admins can hide/restore approved listings. Moderation means a business appears to represent a genuine offering; it is not identity or legal verification.

## APIs

- `GET /api/businesses`: approved and visible DTOs only; `q`, `category`, `page`, `limit` (maximum 24), and `listing` (slug).
- `POST /api/businesses`: anonymous submission; 201 automatically approved, 409 duplicate, 422 policy rejection or inconclusive checks, 400/413 invalid input, 503 retryable moderation/upload error.
- `GET /api/admin/businesses`: authorized paginated status lists (`approved`, `review`, `rejected`, `hidden`).
- `GET /api/admin/businesses/:id`: authorized private review image.
- `PATCH /api/admin/businesses/:id`: authorized `approve`, `reject`, `hide`, `restore`; optimistic concurrency prevents stale admin decisions.

Public duplicate responses identify an existing listing only if it is approved and visible. Public DTOs never contain moderation, normalized identifiers or pending images. Contact URLs are constructed from validated values.

## Checks

Run `npm run test:businesses`, `npx tsc --noEmit`, relevant-file ESLint and `npm run build`. Tests include pure validation/policy checks, suspended-operations proxy behavior, and an isolated MongoDB integration test with mocked Gemini/Cloudinary HTTP responses. They do not call real Gemini or Cloudinary, and never use the configured application database. The MongoDB memory-server test may download a MongoDB binary on its first run.

Source references: [Google structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini models](https://ai.google.dev/gemini-api/docs/models).

## Implementation inventory

Created:
- `app/businesses/page.tsx`
- `components/business-directory/BusinessDirectory.tsx`
- `components/business-directory/BusinessCard.tsx`
- `components/business-directory/BusinessFilters.tsx`
- `components/business-directory/BusinessSubmissionForm.tsx`
- `app/api/businesses/route.ts`
- `app/admin/businesses/page.tsx`
- `app/api/admin/businesses/route.ts`
- `app/api/admin/businesses/[id]/route.ts`
- `models/business.ts`
- `lib/business-directory.ts`
- `lib/business-directory-policy.ts`
- `lib/business-ai-review.ts`
- `lib/business-submission.ts`
- `lib/business-image.ts`
- `lib/business-admin.ts`
- `lib/business-directory.test.ts`
- `lib/business-api.test.ts`
- `docs/business-directory.md`

Modified: `components/Navbar.tsx`, `components/Footer.tsx`, `components/admin-sidebar.tsx`, `proxy.ts`, `.env.example`, `package.json`, `package-lock.json`, `yarn.lock`.

The Business schema includes business/owner details, description/products/category, original and normalized contacts, Cloudinary image references, status/visibility, slug, concise moderation fields, rejection reason and timestamps. Private review image fields and contact reservation keys are excluded from ordinary selection.

Validation on implementation: 13 tests passed; relevant-file ESLint passed; production build passed; HTTP rendering of `/businesses` returned the expected metadata, hero and footer. Standalone `tsc --noEmit` reports the existing unrelated TS2322 in `lib/first-order-pricing.test.tsx:41`, with no directory errors. Browser automation could not start, so visual browser QA was not completed. Live Gemini/Cloudinary calls were not made; configure the server credentials before a live submission smoke test.
