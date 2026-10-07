
# Campus delivery observations - stage 1

## Flow and changed files

- lib/delivery-policy.ts: the existing destination catalogue now marks Amnesty and Girls Hostel aliases with canonical IDs and requiresRoomNumber. Shared conservative room validation.
- app/dashboard/page.tsx: conditional room input, client validation, submission and summary.
- app/api/orders/route.ts: server room validation and persistence.
- app/api/orders/[id]/route.ts: room edit validation, active completion state validation and GPS validation.
- app/api/orders/[id]/retry/route.ts: room copy and validation when creating a fresh retry.
- models/order.ts: optional roomNumber, deliveryDestinationKey and private deliveryCoordinates; aggregation index.
- app/tasker-dashboard/[id]/page.tsx: one-shot GPS capture at delivery confirmation, loading lock, retry/fallback, and room display.
- components/tasker/TaskCards.tsx and TaskJourney.tsx: room type and display.
- app/api/errands/route.ts: include the room for tasker delivery.
- lib/delivery-coordinates.ts: browser capture and server validation.
- lib/delivery-coordinates.test.ts and delivery-coordinates.integration.test.ts: unit, API and isolated MongoDB tests.

## Room validation

Existing destinations are free text, with shared explicit aliases. The catalogue provides requiresRoomNumber and IDs amnesty / girls-hostel instead of new UI-only matching. Both hostel destinations require a nonblank string for new bookings and destination/room edits. Retry creates a new order, so historical hostel orders lacking rooms must be reposted with a room. Historical records themselves remain valid.

Whitespace is trimmed, repeated spaces collapsed and letters uppercased. A12 and a12 normalize together; A 12 remains A 12 to avoid guessing whether spaces are meaningful. Separators are preserved. Maximum length is 40 characters. Client-supplied destination keys are ignored. The schema derives a key from the existing location on creation/location changes.

## Capture and completion

After the existing delivery confirmation, getCurrentPosition runs once with enableHighAccuracy=true, maximumAge=0 and timeout=15000. No watchPosition or background tracking is used. A ref blocks repeated submissions and the button shows Confirming delivery location....

Coordinates accompany the existing PATCH /api/orders/:id request:
{ status: "completed", deliveryCoordinates: { latitude, longitude, accuracy, capturedAt } }

Existing ownership, payment, transfer-review and cafe checks remain. Completion now explicitly requires in_progress or paid for every task type. The backend requires finite numeric latitude [-90,90], longitude [-180,180], optional finite nonnegative accuracy, and a valid capture timestamp within the last ten minutes (one minute future clock tolerance). Values are never coerced from strings. Only the validated fields are stored in the existing completion write. Retries return the original completion rather than replacing observations.

GPS denial, unsupported browsers, timeout and unavailable positions show a clear dialog with Retry location, Finish without GPS, and Go back. Failure alone sends no completion request. Explicit fallback completes using existing rules without coordinates. Optional fields also preserve compatibility with older clients. This is intentionally best-effort collection, not proof of physical delivery.

## Example stored document

{
  "_id": "...",
  "location": "Amnesty Hostel",
  "deliveryDestinationKey": "amnesty",
  "roomNumber": "A12",
  "status": "completed",
  "deliveryCoordinates": {
    "latitude": 5.12345,
    "longitude": 5.54321,
    "accuracy": 12,
    "capturedAt": "2026-10-04T12:00:00.000Z"
  }
}

The capturedAt value is stored as a BSON Date. Example coordinates are illustrative only.

## Future aggregation

Group successful real deliveries by deliveryDestinationKey + roomNumber, retain every raw observation, and evaluate accuracy and outliers before estimating a coordinate. Exclude test orders, cafe inquiries (completed at the cafe), missing observations and disputed deliveries. One observation never becomes an authoritative room coordinate. No aggregation/model or permanent room-coordinate table is added yet.

## Privacy and limitations

deliveryCoordinates is select:false, so ordinary Mongoose document and lean queries omit it. Order JSON serialization strips it even when the field is explicitly loaded or freshly assigned. Existing socket payloads use an allowlist and do not include GPS. Authorized future analysis must explicitly select the field; direct database aggregation bypasses Mongoose selection and needs its own authorization/projection.

Existing order APIs/feed and socket broadcasts have broad order-data visibility. No GPS or room data was added to the global socket payload. This change does not redesign existing access controls. Room numbers are available in the existing tasker API flow.

Browser coordinates can be spoofed; validation verifies shape, range and freshness, not physical presence. HTTPS or localhost and device permission are required. Data retention/access policy for future GPS administration remains an operational decision. No live tasker GPS or production order data was collected during automated tests.

## Validation

npx.cmd tsx --test lib/delivery-coordinates.test.ts lib/delivery-policy.test.ts
npx.cmd tsx --test lib/delivery-coordinates.integration.test.ts lib/cafe-inquiry.test.ts lib/order-sync.test.ts lib/order-tracking.test.tsx

The API tests invoke the real handlers with mocked authentication/persistence dependencies; the separate MongoDB test verifies actual storage, query exclusion and JSON redaction. Browser geolocation uses deterministic success/error doubles, so physical-device permission prompts still require a manual device check.


## Campus mapping - stage 2

Authorized administrators and executive management can now create verified, manually captured campus points at `/admin/locations`. `CampusLocation` is a separate self-referencing collection: every parent landmark and child room/entrance is independently addressable, while duplicate normalized names are prevented only within the same parent. It stores coordinates, accuracy, capture time, active state, creation actor, source (`admin_manual`), observation count, and future confidence metadata.

This is deliberately separate from delivery observations. Mapping coordinates are validated for freshness only when an admin submits a new capture; their stored `capturedAt` timestamp is historical metadata and is not treated as an expiry on read. No automated delivery-coordinate averaging or matching is part of this stage.
