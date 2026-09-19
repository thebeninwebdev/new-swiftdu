import { canPayCafeInquiry, cafeStatusLabels, type CafeInquiryFields } from './cafe-inquiry'
import { isActiveOrderStatus } from './order-status'

export const TASKER_SEARCH_TIMEOUT_MS = 7 * 60 * 1000

type TrackingOrder = CafeInquiryFields & {
  status: string
  taskerId?: string
  hasPaid?: boolean
  isDeclinedTask?: boolean
  cafeInquiry?: boolean
  cafeInquiryFeePaid?: boolean
  cafeInquiryDetailsSubmitted?: boolean
}

export function isWaitingForTasker(order: TrackingOrder | null) {
  return Boolean(
    order &&
    order.status === 'pending' &&
    !order.taskerId &&
    (!order.cafeInquiryStatus || order.cafeInquiryStatus === 'waiting_for_tasker')
  )
}
export function isTaskerSearchExpired(
  order: (TrackingOrder & { createdAt: string | Date }) | null,
  nowMs: number,
) {
  if (!order || !isWaitingForTasker(order)) return false
  const startedAt = new Date(order.createdAt).getTime()
  return Number.isFinite(startedAt) && nowMs >= startedAt + TASKER_SEARCH_TIMEOUT_MS
}

export function getTrackingStage(order: TrackingOrder) {
  // Terminal status takes precedence over retained assignment/payment/cafe history.
  if (order.status === 'cancelled') return { title: 'Order cancelled', label: 'Cancelled', detail: 'This order was cancelled.', progress: 0, taskerLabel: 'Cancelled' }
  if (order.status === 'completed') return order.cafeInquiry ? { title: 'Cafe inquiry completed', label: 'Completed', detail: 'Your Tasker completed the cafe check.', progress: 100, taskerLabel: 'Completed' } : { title: 'Order delivered', label: 'Delivered', detail: 'Your order has reached you.', progress: 100, taskerLabel: 'Delivered' }
  const title = 'Your order is being fulfilled'
  if (order.cafeInquiryStatus) return { title: 'Cafe inquiry', label: 'Cafe inquiry', detail: cafeStatusLabels[order.cafeInquiryStatus], progress: 0, taskerLabel: order.taskerId ? 'Assigned' : 'Searching' }
  if (order.hasPaid || order.status === 'paid') return { title, label: 'Tasker on the way', detail: 'Your tasker is moving with your order.', progress: 78, taskerLabel: 'En route' }
  if (order.taskerId || order.status === 'in_progress') return { title, label: 'Order accepted', detail: 'Your order is being prepared. Confirm payment so fulfilment can keep moving.', progress: 45, taskerLabel: 'Assigned' }
  return { title, label: 'Finding a tasker', detail: 'We are matching this order with an available tasker.', progress: 18, taskerLabel: 'Searching' }
}

export function needsOrderPayment(order: TrackingOrder | null) {
  if (!order || !isActiveOrderStatus(order.status)) return false
  return Boolean(order.taskerId && !order.hasPaid && !order.isDeclinedTask && (!order.cafeInquiryStatus || canPayCafeInquiry(order.cafeInquiryStatus)))
}
