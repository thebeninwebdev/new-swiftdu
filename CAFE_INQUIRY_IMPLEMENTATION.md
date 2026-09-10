Implemented the two-phase cafe workflow using the existing Order, pricing, manual-transfer, Tasker, Socket.IO, notification and Swifty systems.

1. **Files changed.**

   New files: `components/cafe-inquiry.tsx`, `lib/cafe-inquiry.ts`, `lib/cafe-inquiry-server.ts`, `lib/cafe-inquiry.test.ts`, and the three `app/api/orders/[id]/cafe-inquiry/{checking,options,selection}/route.ts` endpoints.

   Updated: `models/order.ts`, `lib/pricing.ts`, `lib/socket.ts`, `app/api/orders/route.ts`, `app/api/orders/[id]/route.ts`, its `confirm-transfer/route.ts` and `retry/route.ts`, `app/api/errands/route.ts`, `app/api/admin/orders/[id]/route.ts`, `app/dashboard/page.tsx`, both `TasksClient.tsx` and `TaskListClient.tsx` under `app/dashboard/tasks`, `app/tasker-dashboard/page.tsx`, `app/tasker-dashboard/[id]/page.tsx`, `app/admin/orders/page.tsx`, `app/available-tasks/page.tsx`, and `components/TaskCard.tsx`. This report is also new.

2. **Existing code reused.** `cafeInquiry`, the description fallback, budget-validation exemption, `calculateOrderPricing`, cafe-fee constants, restaurant people/takeaway normalization, `splitServiceFee`, discount reservations, `emitOrderUpdated`, push notifications, training filters and `OrderMascot`/Swifty. Existing cafe choices are shared rather than duplicated.

3. **Schema additions.** Optional `cafeInquiryStatus`; default-empty `cafeAvailableItems` and `cafeSelectedItems`; `cafeOptionsVersion` defaulting to zero; optional `cafeOptionsSentAt` and `cafeSelectionSubmittedAt`. Selected names/prices preserve the final accounting snapshot. Existing major statuses remain intact.

4. **Transitions.** `waiting_for_tasker → tasker_assigned → checking_cafe → awaiting_customer_choice → ready_for_payment → completed`. Checking/options may move to `unavailable`, which remains open and allows another check. Options can be corrected before selection. Version checks and atomic compare-and-set updates reject stale choices, concurrent corrections and invalid transitions. No new expiration policy was added.

5. **Tasker workflow.** Accept through the existing endpoint; open the cafe-check panel; mark arrival; add, edit or remove named items with required prices; send options or report nothing suitable. The server verifies the authenticated Tasker profile, assignment, verification, training/live mode and active order state. Selection/payment must precede completion. The existing admin mutation endpoint also received its missing server-side admin authorization check to prevent bypassing these guards.

6. **Customer workflow.** Choose the canonical normal-order/cafe-check selector, cafe and delivery; review the service commitment; wait for availability; choose item quantities; choose meal count and takeaway/cellophane allocation; confirm the final amount. Prices are read from saved options, never from customer input. Cafe-check labels appear in customer, Tasker and admin views. New inquiry details cannot be changed through arbitrary order PATCH; changing the cafe/location requires cancellation and reposting.

7. **Pricing.** The repository actually used ₦450 base + ₦100 check, contrary to the requested ₦600 + ₦50. The centralized base was corrected to ₦600 and the check constant to ₦50. Existing multi-meal service prices remain ₦700 for two and ₦1,050 for three, plus the ₦50 inquiry fee. Normal service discounts remain supported; the check fee stays payable. Other service pricing branches are unchanged.

8. **No duplicate ₦50.** One pricing calculation adds the check fee to the existing restaurant service fee. Selection replaces the order's amount/total instead of incrementing them. New inquiries cannot use the old preliminary-transfer branch. Retry resets food, packaging, options and payment state to a fresh request.

9. **Payment choice: B.** New inquiries use one existing direct transfer to the assigned Tasker after food selection and packaging. Review explicitly describes the initial service commitment and its inclusion in the eventual transfer. This avoids treating the old customer's self-reported preliminary transfer as a separate verified capture. Existing inquiries without the new sub-status retain their legacy transfer/details behavior.

10. **Realtime and notifications.** Existing `order:updated` payloads now carry inquiry status, options, version, selection and service fee. Existing customer/Tasker subscriptions refresh the panels. Options produce a tagged customer push using the existing notification system; test orders retain notification suppression. No new polling loop or socket namespace was introduced.

11. **Swifty.** Existing thinking/searching/matched/success/moving/warning/error poses and reduced-motion handling are reused for creation, assignment, checking, availability, selection, fulfilment and failures. Inquiry tracking does not announce food preparation before selection.

12. **Compatibility.** No destructive migration; existing orders do not acquire an inquiry state. Legacy cafe payments remain readable and usable. Existing major status, authentication, settlement, cancellation, Exco training and non-restaurant paths are retained. Packaging preserves the current zero fixed surcharge: Taskers list chargeable packs among the priced options, and customers choose packaging after food selection.

13. **Verification.** Ten focused tests pass, covering initial/final totals, forged prices, discounts, mixed packaging, invalid selections/quantities/prices, other service pricing, schema compatibility and realtime fields. TypeScript passes. Changed files pass lint, with only two existing unused-import warnings in `TaskListClient.tsx`. Repository-wide lint reports 22 errors in unchanged files. Production build was attempted and retried with network access; webpack is blocked by missing `sharp` for existing homepage image imports (`earn.jpeg`, `learn.jpeg`, `tasker-signup.jpg`). No authenticated browser/MongoDB end-to-end session or real payment was performed.

14. **Unresolved business policy.** Confirm whether the ₦50 may ever be discounted, and how the service/check commitment should be collected or refunded after a cafe visit when the customer cancels or nothing suitable is available. Current implementation retains the fee outside discounts and preserves existing cancellation/payment rules without inventing refund or automatic collection behavior.

Run the focused checks with `npx tsx --test lib/cafe-inquiry.test.ts` and `npx tsc --noEmit`. Before release, exercise the complete flow with separate customer/Tasker accounts in existing Test Order Mode, including correction-versus-selection and cancellation races.
