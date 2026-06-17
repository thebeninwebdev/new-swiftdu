export const DEFAULT_COMPLETION_WINDOW_MINUTES = 20
export const HOSTEL_COMPLETION_WINDOW_MINUTES = 25
export const STAFF_QUARTERS_COMPLETION_WINDOW_MINUTES = 30
export const INDOMIE_COMPLETION_WINDOW_MINUTES = 60

type CompletionTimerOrder = {
  status?: string
  taskType?: string | null
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

export function getCompletionWindowMinutes(location?: string | null, taskType?: string | null) {
  if (taskType === 'indomie') {
    return INDOMIE_COMPLETION_WINDOW_MINUTES
  }

  const normalizedLocation = String(location || '').toLowerCase()

  if (normalizedLocation.includes('staff quarters')) {
    return STAFF_QUARTERS_COMPLETION_WINDOW_MINUTES
  }

  if (
    normalizedLocation.includes('amnesty') ||
    normalizedLocation.includes('girls hostel')
  ) {
    return HOSTEL_COMPLETION_WINDOW_MINUTES
  }

  return DEFAULT_COMPLETION_WINDOW_MINUTES
}

export function ensureCompletionTimer(order: CompletionTimerOrder) {
  const isPaid = Boolean(order.hasPaid) || order.paymentStatus === 'paid'

  if (
    !isPaid ||
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
  const locationWindowMinutes = getCompletionWindowMinutes(order.location, order.taskType)
  const existingWindowMinutes = Number(order.completionWindowMinutes || 0)
  const extensionMinutes = Number(order.completionExtensionMinutes || 0)

  if (order.completionDueAt) {
    if (existingWindowMinutes <= 0 || existingWindowMinutes < locationWindowMinutes) {
      const nextDueAt = new Date(
        startedAt.getTime() + (locationWindowMinutes + extensionMinutes) * 60000
      )
      order.completionWindowMinutes = locationWindowMinutes
      order.completionDueAt = new Date(
        Math.max(order.completionDueAt.getTime(), nextDueAt.getTime())
      )
      return true
    }

    return false
  }

  const windowMinutes =
    existingWindowMinutes > 0
      ? Math.max(existingWindowMinutes, locationWindowMinutes)
      : locationWindowMinutes

  order.paidAt = order.paidAt || startedAt
  order.completionTimerStartedAt = startedAt
  order.completionWindowMinutes = windowMinutes
  order.completionExtensionMinutes = extensionMinutes
  order.completionDueAt = new Date(startedAt.getTime() + windowMinutes * 60000)
  order.completedBeforeTimer = false
  order.platformFeeWaivedForFastCompletion = false
  order.customerReceiptConfirmed = undefined
  order.customerReceiptRespondedAt = undefined
  order.prematureCompletionReported = false
  order.prematureCompletionReportedAt = undefined

  return true
}
