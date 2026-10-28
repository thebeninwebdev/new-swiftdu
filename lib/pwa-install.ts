export const CUSTOMER_INSTALL_SUGGESTION_KEY = 'swiftdu-customer-install-suggestion-shown-at'
export const CUSTOMER_INSTALL_SUGGESTION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export function shouldShowCustomerInstallSuggestion(
  storedValue: string | null,
  now = Date.now(),
) {
  if (!storedValue) return true

  const lastShownAt = Number(storedValue)
  if (!Number.isFinite(lastShownAt) || lastShownAt <= 0) return true

  return now - lastShownAt >= CUSTOMER_INSTALL_SUGGESTION_INTERVAL_MS
}
