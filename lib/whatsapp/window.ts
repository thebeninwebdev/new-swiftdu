export const WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

export function isWithinWhatsAppCustomerServiceWindow(lastCustomerMessageAt?: Date | string | null, now = Date.now()) {
  if (!lastCustomerMessageAt) return false
  const timestamp = new Date(lastCustomerMessageAt).getTime()
  return Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp < WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS
}
