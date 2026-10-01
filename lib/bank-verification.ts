export const ACCOUNT_VERIFICATION_ERROR = "We couldn't verify this account. Check your bank and account number."

// Cancellation also guards against responses from transports that ignore abort.
export function scheduleBankVerification(
  bankCode: string,
  accountNumber: string,
  onSuccess: (accountName: string) => void,
  onError: () => void,
) {
  if (!/^\d{3,12}$/.test(bankCode) || !/^\d{10}$/.test(accountNumber)) return () => {}
  const controller = new AbortController()
  const timer = setTimeout(async () => {
    try {
      const response = await fetch('/api/paystack/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode, accountNumber }),
        signal: controller.signal,
      })
      const payload: { success?: boolean; accountName?: string } = await response.json()
      if (!response.ok || !payload.success || !payload.accountName?.trim()) throw new Error('Verification failed')
      if (!controller.signal.aborted) onSuccess(payload.accountName.trim())
    } catch {
      if (!controller.signal.aborted) onError()
    }
  }, 400)
  return () => {
    clearTimeout(timer)
    controller.abort()
  }
}
