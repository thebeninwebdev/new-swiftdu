export const DEFAULT_COMPLETION_WINDOW_MINUTES = 20
export const STAFF_QUARTERS_COMPLETION_WINDOW_MINUTES = 30

type CompletionTimerOrder = {
  status?: string
  location?: string | null
  hasPaid?: boolean
  paymentStatus?: string
  paidAt?: Date
  paymentVerifiedAt?: Date
  customerTransferredAt?: Date
  completionTimerStartedAt?: Date
  completionDueAt?: Date
  completionWindowMinutes?: number
  completionExtensionMinutes?: number
  completedBeforeTimer?: boolean
  platformFeeWaivedForFastCompletion?: boolean
  customerReceiptConfirmed?: boolean
  customerReceiptRespondedAt?: Date
  prematureCompletionReported?: boolean
  prematureCompletionReportedAt?: Date
}

export function getCompletionWindowMinutes(location?: string | null) {
  const normalizedLocation = String(location || '').toLowerCase()

  if (normalizedLocation.includes('staff quarters')) {
    return STAFF_QUARTERS_COMPLETION_WINDOW_MINUTES
  }

  return DEFAULT_COMPLETION_WINDOW_MINUTES
}

export function ensureCompletionTimer(order: CompletionTimerOrder) {
  const isPaid = Boolean(order.hasPaid) || order.paymentStatus === 'paid'

  if (
    !isPaid ||
    order.completionDueAt ||
    order.status === 'completed' ||
    order.status === 'cancelled'
  ) {
    return false
  }

  const startedAt =
    order.completionTimerStartedAt ||
    order.paidAt ||
    order.paymentVerifiedAt ||
    order.customerTransferredAt ||
    new Date()
  const windowMinutes =
    Number(order.completionWindowMinutes || 0) > 0
      ? Number(order.completionWindowMinutes)
      : getCompletionWindowMinutes(order.location)

  order.paidAt = order.paidAt || startedAt
  order.completionTimerStartedAt = startedAt
  order.completionWindowMinutes = windowMinutes
  order.completionExtensionMinutes = order.completionExtensionMinutes || 0
  order.completionDueAt = new Date(startedAt.getTime() + windowMinutes * 60000)
  order.completedBeforeTimer = false
  order.platformFeeWaivedForFastCompletion = false
  order.customerReceiptConfirmed = undefined
  order.customerReceiptRespondedAt = undefined
  order.prematureCompletionReported = false
  order.prematureCompletionReportedAt = undefined

  return true
}
