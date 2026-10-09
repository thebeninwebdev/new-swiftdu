# WDU Business Directory

`/businesses` is public, including while `OPERATIONS_ENABLED=false`. It uses the existing public shell, Manrope theme, navigation and footer. `/admin/businesses` uses the existing admin shell and Better Auth admin/exco authorization.

## Setup

Set `GEMINI_API_KEY` on the server. `GEMINI_BUSINESS_REVIEW_MODEL` defaults to `gemini-3.1-flash-lite`; override it with a multimodal, structured-output Flash model available in your Google project. Enable billing/quota as appropriate for that project. No Gemini credentials belong in `NEXT_PUBLIC_*`.

Reuse `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, or set `CLOUDINARY_CLOUD_NAME`. Add server-only `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` from the same Cloudinary account. Uploads use server-only HTTP Basic Authentication over HTTPS, avoiding timestamp signature failures when the host clock drifts. No new unsigned preset is needed, and the existing profile preset is unchanged. Optionally create a **signed** image upload preset and set `CLOUDINARY_BUSINESS_UPLOAD_PRESET`; it must permit WebP and preserve the supplied `swiftdu-businesses/…` public ID. With this variable blank, authenticated upload parameters work without a dashboard preset.

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
- `lib/business-image-validation.ts`
- `lib/business-image-storage.ts`
- `lib/business-admin.ts`
- `lib/business-directory.test.ts`
- `lib/business-api.test.ts`
- `docs/business-directory.md`

Modified: `components/Navbar.tsx`, `components/Footer.tsx`, `components/admin-sidebar.tsx`, `proxy.ts`, `.env.example`, `package.json`, `package-lock.json`, `yarn.lock`.

The Business schema includes business/owner details, description/products/category, original and normalized contacts, Cloudinary image references, status/visibility, slug, concise moderation fields, rejection reason and timestamps. Private review image fields and contact reservation keys are excluded from ordinary selection.

Validation on implementation: 13 tests passed; relevant-file ESLint passed; production build passed; HTTP rendering of `/businesses` returned the expected metadata, hero and footer. Standalone `tsc --noEmit` reports the existing unrelated TS2322 in `lib/first-order-pricing.test.tsx:41`, with no directory errors. Browser automation could not start, so visual browser QA was not completed. Live Gemini/Cloudinary calls were not made; configure the server credentials before a live submission smoke test.

## Natural-language discovery

The initial `/businesses` screen offers Search for a product or service and List your business. Search opens a labelled field and runs only on Enter or Search, never on keystrokes. Existing submission and `/businesses?listing=<slug>` lookup remain supported. `BusinessFilters` now contains only this search form.

`GET /api/businesses/search?q=...` accepts trimmed queries of 2–200 characters and returns up to 12 public business DTOs. The server uses the installed `@google/genai` 2.26.0 `models.embedContent` API with `GEMINI_API_KEY`, `GEMINI_BUSINESS_EMBEDDING_MODEL` (default `gemini-embedding-2`), and 768 dimensions. No images or contact/moderation fields are embedded. The deterministic document includes business name, category, description, products/services and optional location.

Embedding 2 uses `task: search result | query: ...` for queries and `title: none | text: ...` for documents; it does not accept the older taskType option. The helper also supports `gemini-embedding-001` with retrieval task types if explicitly configured. Changing models requires re-running the backfill; embeddings from different models must not be compared. No generative reranking or additional provider is used.

MongoDB `$vectorSearch` is the first aggregation stage, with 240 candidates for at most 12 results. It filters status, visibility and embedding model. Exact business names rank first, direct product/service phrase matches next, followed by semantic results and other lexical matches, deduplicated by ID. A provisional Atlas cosine score floor of 0.65 excludes weak semantic matches; this is an internal tuning value, not displayed confidence. Validate/tune it against real campus listings after setup. Deterministic fake-vector tests verify retrieval plumbing, not actual model relevance.

Both lexical and vector results are checked against current approved + visible database records immediately before serialization, protecting against stale visibility in the asynchronously updated Atlas index. Embedding fields use `select: false`; aggregation only returns IDs/internal scores, and final responses pass through the existing public DTO allowlist.

If embedding generation times out/fails, or the vector index is unavailable/missing, escaped phrase matching and useful query-word matching across businessName, category, description and productsServices remain available. Common request words are removed and every remaining word must match, so "someone to build me a website" can find descriptions mentioning "websites" without requiring the whole sentence. This is still lexical matching: synonyms with no shared words require semantic search. Database outages return a generic retryable error. Provider response bodies, queries and private submission data are not logged. Every submitted semantic search uses one embedding request; there is no automatic polling or reranking.

### Atlas setup (manual)

Use the existing database from `MONGODB_URI` and Mongoose's existing **businesses** collection. In Atlas, open the cluster's Search & Vector Search area, create a **Vector Search** index using the JSON editor, select that database/collection, and name it **business_semantic_search**. This is a `vectorSearch` search index, not a standard MongoDB index. Paste this definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "searchEmbedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "status" },
    { "type": "filter", "path": "isVisible" },
    { "type": "filter", "path": "searchEmbeddingModel" }
  ]
}
```

The model filter is required in addition to visibility/status. Wait until the index is ready/queryable before testing semantic results. Atlas must support the `$vectorSearch` aggregation stage (ANN: MongoDB 6.0.11 / 7.0.2 or later); the application's Mongoose 9 / MongoDB driver 7 passes this pipeline through. The index is intentionally not created by builds or application startup.

### Embedding lifecycle and backfill

Automatic approval, manual approval of legacy review records, and restoring an approved listing prepare embeddings before saving publication changes. A temporary embedding failure allows the already-moderated listing to publish with lexical discovery and no valid vector; it never changes the moderation decision. Text/model/vector validation avoids re-embedding unchanged records. An invalid/stale vector is cleared on a failed refresh so it cannot misrepresent changed content.

There is currently no business-content edit route. Future code changing businessName, category, description, productsServices or location must select `BUSINESS_SEARCH_SELECTION`, apply the content changes, and merge `await prepareBusinessEmbedding(business)` into the same save. External database edits require a backfill before semantic discovery reflects them.

With the server environment configured, run manually from the repository root:

```sh
npm run businesses:backfill-embeddings
```

On PowerShell systems blocking npm.ps1, use `npm.cmd run businesses:backfill-embeddings`. The script loads Next.js environment files, uses the existing connection helper, streams approved/visible records in batches of 10 and performs sequential requests with a one-second pause. It skips current text/model/valid 768-dimensional embeddings, repairs missing/stale embeddings, and uses an updatedAt guard to avoid overwriting concurrent edits. Individual failures retain completed progress and produce a nonzero exit code; re-run to retry. Hidden/review/rejected listings are untouched. The backfill is not part of production builds.

After the index and backfill are ready, try `someone to build me a flyer`, `I need someone to make my hair`, and `where can I print my assignment` against relevant real listings. Live model quality and Atlas index readiness require this manual smoke test.

Implementation references: [Google embedding retrieval formats](https://ai.google.dev/gemini-api/docs/embeddings), [Atlas vector index definition](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/), [Atlas vector search query syntax](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/).

### Semantic-search implementation inventory

Created: `lib/business-search.ts`, `lib/business-search.test.ts`, `app/api/businesses/search/route.ts`, `scripts/backfill-business-embeddings.ts`.

Modified: `app/businesses/page.tsx`, `components/business-directory/BusinessDirectory.tsx`, `components/business-directory/BusinessFilters.tsx`, `app/api/businesses/route.ts`, `app/api/admin/businesses/[id]/route.ts`, `models/business.ts`, `lib/business-api.test.ts`, `.env.example`, `package.json`, and this guide. Existing BusinessCard and BusinessSubmissionForm are reused without changes. No dependencies were added or upgraded.

Validation: all 20 business tests pass, standalone TypeScript passes, and changed-file ESLint passes. An HTTP check of `/businesses` returned 200 with the new heading and two initial actions, without the search input initially rendered. Browser automation could not start, so visual/mobile interaction QA remains outstanding. Gemini calls are mocked in tests; the three acceptance examples use deterministic fake vectors, and real relevance must be checked after Atlas setup/backfill.

Production validation: npm run build passed, including TypeScript, static generation and the new /api/businesses/search route.

Local development: a plain MongoDB server without Atlas Search support uses the lexical fallback even with valid Gemini credentials and stored embeddings. Backfilling embeddings alone does not enable vector search; use an Atlas/Search-enabled deployment and the index above for semantic retrieval.
