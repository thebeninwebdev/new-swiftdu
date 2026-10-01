# Tasker bank verification

The existing bank onboarding panel in `app/tasker-dashboard/page.tsx` and bank
editor in `app/tasker-dashboard/profile/page.tsx` now share
`components/tasker/BankDetailsForm.tsx`. No separate page was introduced.

## Flow

- `GET /api/paystack/banks` requires a signed-in session. It fetches all pages of
  Paystack's Nigerian NGN bank list and returns only bank names and codes. The
  server caches the list for one hour and combines simultaneous list requests.
- The bank field offers matching suggestions as users type; only a name matching
  a supported bank supplies the bank code required for verification.
- The form accepts up to ten account-number digits. A selected bank and exactly
  ten digits trigger `POST /api/paystack/resolve-account` after 400 ms.
- Names are display-only. Editing either field clears verification immediately,
  cancels the debounce, and aborts the previous request. The response handler also
  checks the abort signal, so an obsolete response cannot update the form.
- Save is disabled until the current bank and account have a resolved name.
- `PATCH /api/taskers/me/bank-details` checks session ownership and tasker role,
  validates the inputs, checks the bank against Paystack's list, and resolves the
  account again before saving. Client account names and bank names are ignored.
- Existing `Tasker.bankDetails` fields are preserved. Optional `bankCode` is
  added; existing records do not need migration. Existing saved accounts continue
  to bypass onboarding. Opening the editor requires fresh verification to save.

The existing server-only `PAYSTACK_SECRET_KEY` setting is used, with the existing
`PAYSTACK_SECRET` fallback retained. No new variable or dependency is required.
No secret, authorization header, or raw provider error is returned to the client.
The existing payment initialization and verification implementations are unchanged.

API references: [List Banks](https://paystack.com/docs/api/miscellaneous/#bank),
[Resolve Account](https://paystack.com/docs/api/verification/#resolve-account).

## Files

- `app/tasker-dashboard/page.tsx`
- `app/tasker-dashboard/profile/page.tsx`
- `components/tasker/BankDetailsForm.tsx`
- `app/api/paystack/banks/route.ts`
- `app/api/paystack/resolve-account/route.ts`
- `app/api/taskers/me/bank-details/route.ts`
- `lib/paystack.ts`
- `lib/bank-verification.ts`
- `models/tasker.ts`
- `lib/bank-verification.test.ts`
- `lib/paystack-bank.test.ts`
- `lib/bank-details-api.test.ts`
- This document.

## Verification

Run `npx tsx --test lib/bank-verification.test.ts lib/paystack-bank.test.ts lib/bank-details-api.test.ts`.
The nine tests use mocked Paystack responses, and the API test mocks authentication
and persistence. They cover pagination, validation, debounce, cancellation,
out-of-order responses, failures, client name tampering, session/role checks,
legacy model compatibility, and existing payment helpers.

All nine tests and lint on the changed source files passed. Repository-wide checks
remain blocked by pre-existing issues:

- TypeScript: `models/user.ts:178` and `lib/first-order-pricing.test.tsx:41`.
- Production build: bundle compilation succeeds, then fails on `models/user.ts:178`.
- Repository lint: 22 errors in unrelated files.

Manual checks with a signed-in tasker and a configured Paystack account:

1. Choose a bank (including OPay) and enter a real account. Confirm the returned
   name, save, reload, and confirm that MongoDB retained the verified details.
2. Try an invalid account and retry. Confirm the inline error and disabled save.
3. Enter fewer than ten digits; confirm no resolution request occurs.
4. Change a digit or bank after success; confirm the old name disappears at once.
5. Throttle the network and change accounts rapidly; confirm only the latest
   account appears and saving is disabled while waiting.
6. Confirm existing accounts still open the dashboard, and test editing and
   cancelling without changing their stored details.
7. Smoke-test an existing Paystack payment in the configured test environment.

Live Paystack, real MongoDB persistence, and authenticated browser interactions
were not exercised by the automated tests.
