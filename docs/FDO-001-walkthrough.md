# FDO-001 Cafe Journey Walkthrough

> Historical record: this walkthrough describes the earlier in-app food-option flow. The current cafe inquiry uses WhatsApp for food details and has a shorter lifecycle. The PASS results below are not verification of the redesigned flow.

## Test setup

- Customer account in Test Order Mode
- Tasker account in Training Mode
- Separate customer and tasker sessions
- Cafe inquiry path used

## Recording

[Walkthrough recordings](https://drive.google.com/drive/folders/1eADfbBMnOap7t39T4su513nDApQIF4u4?usp=sharing)

The recordings cover:

1. Full cafe journey / happy path
2. Customer choosing while tasker corrects options
3. Customer cancelling while cafe is being checked
4. Tasker reporting nothing suitable

The Google Drive folder link still needs to be inserted. This branch does not contain the video files.

## Walk results

These are the reported FDO-001 manual walk outcomes. The recordings must be linked before they provide independent evidence.

### Happy path

- Customer creates a test cafe inquiry.
- Training Mode tasker sees it, clearly labelled **Cafe Inquiry**.
- Tasker accepts and marks **I'm at the cafe**.
- Tasker sends options; customer selects them.
- Customer proceeds through the test payment/transfer flow.
- Tasker can continue fulfilment.

Result: PASS

### Option correction while customer is choosing

- Tasker sends initial options and customer begins choosing.
- Tasker corrects an option before customer confirms.
- Updated options reach the customer, resetting the stale selection.
- Customer receives an explanation that the options changed.

Result: PASS

### Customer cancellation while cafe is being checked

- Tasker accepts the inquiry and marks **I'm at the cafe**.
- Customer cancels before options are completed and returns to the cancelled/orders state.
- Tasker sees the cafe request was cancelled; active cafe controls do not continue.

Result: PASS

### Nothing suitable

- Tasker reports nothing suitable.
- Customer and tasker each see role-appropriate unavailable messaging.
- Customer can cancel, and cancellation reaches both sides.

Result: PASS

## Breaks found and fixed

- Late HTTP snapshots and socket updates could replace newer cafe or cancellation state; order updates now use persisted timestamps and cafe option versions.
- Cancelled orders could still show stale tasker, payment, fulfilment, or active cafe UI; cancelled state now takes precedence and closes active dialogs and controls.
- The cafe panel could contradict itself after cancellation; both roles now see the cancelled request state.
- Cafe option pricing and takeaway pack instructions were unclear; the UI now shows pricing units and explicit pack pricing.

## Verification

Run `npm run test:cafe` for the cafe inquiry, order synchronization, and order tracking tests. Run `npx tsc --noEmit` for the TypeScript typecheck. These automated checks supplement the manual walks.

## Release checklist

- [x] Test customer can create cafe inquiry
- [x] Training tasker can see test inquiry
- [x] Cafe Inquiry is clearly identified
- [x] Tasker can accept inquiry
- [x] Tasker can mark arrival at cafe
- [x] Customer sees updated cafe state
- [x] Tasker can send options
- [x] Customer can select options
- [x] Corrected options invalidate stale selection safely
- [x] Customer understands why corrected options reset selection
- [x] Nothing-suitable state is understandable for customer
- [x] Nothing-suitable state is understandable for tasker
- [x] Customer can cancel while cafe is being checked
- [x] Cancellation reaches both customer and tasker
- [x] Cancelled order no longer appears actively fulfilled
- [ ] Full walkthrough recording link added to this document