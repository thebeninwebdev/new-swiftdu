'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { ACCOUNT_VERIFICATION_ERROR, scheduleBankVerification } from '@/lib/bank-verification'

interface Bank { name: string; code: string }
export interface VerifiedBankDetails {
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
}

const controlClass = 'mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-medium outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-violet-950'

export function BankDetailsForm({ initialDetails, onSaved, onCancel, submitLabel = 'Save and continue', endpoint = '/api/taskers/me/bank-details', extraPayload }: {
  initialDetails?: Partial<VerifiedBankDetails>
  onSaved: (details: VerifiedBankDetails) => void
  onCancel?: () => void
  submitLabel?: string
  endpoint?: string
  extraPayload?: Record<string, string>
}) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankCode, setBankCode] = useState(initialDetails?.bankCode || '')
  const [bankSearch, setBankSearch] = useState<string | null>(null)
  const bankSuggestionsId = useId()
  const [accountNumber, setAccountNumber] = useState(initialDetails?.accountNumber || '')
  const [loadingBanks, setLoadingBanks] = useState(true)
  const [bankError, setBankError] = useState(false)
  const [bankAttempt, setBankAttempt] = useState(0)
  const [verificationAttempt, setVerificationAttempt] = useState(0)
  const [verified, setVerified] = useState<{ bankCode: string; accountNumber: string; accountName: string } | null>(null)
  const [verificationError, setVerificationError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const cancelVerification = useRef<(() => void) | null>(null)
  const savingRef = useRef(false)
  const originalBank = useRef(initialDetails?.bankName)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch('/api/paystack/banks', { signal: controller.signal })
        const payload: { banks?: Bank[] } = await response.json()
        if (!response.ok || !payload.banks?.length) throw new Error('Banks unavailable')
        if (controller.signal.aborted) return
        setBanks(payload.banks)
        // Legacy records have a bank name but no code. Never overwrite saved data.
        const existingBank = payload.banks.find((bank) => bank.name.toLowerCase() === originalBank.current?.toLowerCase())
        if (existingBank) setBankCode((current) => current || existingBank.code)
      } catch {
        if (!controller.signal.aborted) setBankError(true)
      } finally {
        if (!controller.signal.aborted) setLoadingBanks(false)
      }
    })()
    return () => controller.abort()
  }, [bankAttempt])

  const ready = banks.some((bank) => bank.code === bankCode) && /^\d{10}$/.test(accountNumber)
  const bankInput = bankSearch ?? banks.find((bank) => bank.code === bankCode)?.name ?? initialDetails?.bankName ?? ''
  const matchingBanks = banks.filter((bank) => bank.name.toLowerCase().includes(bankInput.trim().toLowerCase()))
  const currentVerification = verified?.bankCode === bankCode && verified.accountNumber === accountNumber ? verified : null

  useEffect(() => {
    if (!ready) return
    const cancel = scheduleBankVerification(bankCode, accountNumber,
      (accountName) => setVerified({ bankCode, accountNumber, accountName }),
      () => setVerificationError(true))
    cancelVerification.current = cancel
    return cancel
  }, [bankCode, accountNumber, ready, verificationAttempt])

  function clearVerification() {
    cancelVerification.current?.()
    setVerified(null)
    setVerificationError(false)
    setSaveError(null)
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentVerification || !ready || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extraPayload ? { ...extraPayload, bankCode, accountNumber } : { bankCode, accountNumber }),
      })
      const payload: { bankDetails?: VerifiedBankDetails; error?: string } = await response.json()
      if (!response.ok || !payload.bankDetails) {
        setSaveError(payload.error || 'Could not save your bank details. Please try again.')
        return
      }
      onSaved(payload.bankDetails)
    } catch {
      setSaveError('Could not save your bank details. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return <form onSubmit={save} className="space-y-5">
    <fieldset disabled={saving} className="space-y-5">
      <label className="block text-sm font-bold">Your bank
        <input required type="text" autoComplete="off" list={bankSuggestionsId}
          value={bankInput} disabled={loadingBanks || bankError} className={controlClass}
          placeholder={loadingBanks ? 'Loading banks...' : 'Opay'}
          aria-describedby={`${bankSuggestionsId}-recommendation ${bankSuggestionsId}-hint`}
          onChange={(event) => {
            const value = event.target.value
            const selectedBank = banks.find((bank) => bank.name.toLowerCase() === value.trim().toLowerCase())
            setBankSearch(value)
            if ((selectedBank?.code || '') !== bankCode) clearVerification()
            setBankCode(selectedBank?.code || '')
          }} />
        <datalist id={bankSuggestionsId}>
          {matchingBanks.map((bank) => <option key={bank.code} value={bank.name} />)}
        </datalist>
        <span id={`${bankSuggestionsId}-recommendation`} className="mt-2 block text-xs font-semibold text-violet-700 dark:text-violet-300">
          For quicker transfers, we recommend OPay or PalmPay.
        </span>
        <span id={`${bankSuggestionsId}-hint`} className="block text-xs font-normal text-slate-500" aria-live="polite">
          {!loadingBanks && !bankError && bankInput.trim() && !matchingBanks.length
            ? <span className="mt-2 block">No matching banks. Try another bank name.</span>
            : null}
        </span>
      </label>
      {bankError && <div role="alert" className="text-sm text-rose-700 dark:text-rose-300">
        Could not load banks. <button type="button" className="font-semibold underline" onClick={() => {
          setLoadingBanks(true); setBankError(false); setBankAttempt((value) => value + 1)
        }}>Try again</button>
      </div>}
      <label className="block text-sm font-bold">Your 10-digit account number
        <input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} autoComplete="off"
          value={accountNumber} placeholder="0123456789" className={controlClass}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, '').slice(0, 10)
            if (value !== accountNumber) { clearVerification(); setAccountNumber(value) }
          }} />
      </label>
      <div aria-live="polite" aria-atomic="true" className="text-sm">
        <p className="font-bold">Account Name</p>
        {currentVerification ? <div className="mt-2 rounded-xl bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100">
          <p className="font-semibold">{currentVerification.accountName}</p>
          <p className="mt-1 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Account verified</p>
        </div> : verificationError ? <div className="mt-2 text-rose-700 dark:text-rose-300">
          <p>{ACCOUNT_VERIFICATION_ERROR}</p>
          <button type="button" className="mt-1 font-semibold underline" onClick={() => {
            clearVerification(); setVerificationAttempt((value) => value + 1)
          }}>Try again</button>
        </div> : ready ? <p className="mt-2 flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Verifying account...</p>
          : <p className="mt-2 text-slate-500">Select your bank and enter your account number to verify your name.</p>}
      </div>
      {saveError && <p role="alert" className="rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{saveError}</p>}
      <button type="submit" disabled={!currentVerification || !ready || saving}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700 disabled:opacity-60">
        {saving ? 'Saving your account...' : <>{submitLabel}<CheckCircle2 className="h-5 w-5" /></>}
      </button>
      {onCancel && <button type="button" onClick={onCancel} className="h-12 w-full rounded-xl border border-slate-300 font-semibold dark:border-slate-700">Cancel</button>}
    </fieldset>
  </form>
}
