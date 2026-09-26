import { canPayCafeInquiry, cafeStatusLabels, getCafeLabel, type CafeInquiryFields } from './cafe-inquiry'
import { isActiveOrderStatus, isCustomerPaymentConfirmed } from './order-status'

export const TASKER_SEARCH_TIMEOUT_MS = 7 * 60 * 1000

export type TrackingOrder = CafeInquiryFields & {
  status: string
  taskerId?: string
  hasPaid?: boolean
  isDeclinedTask?: boolean
  cafeInquiry?: boolean
  cafeInquiryFeePaid?: boolean
  cafeInquiryDetailsSubmitted?: boolean
  paymentStatus?: string
  taskType?: string
  store?: string
  completionDueAt?: string | Date
}

export function getTrackingStore(order: Pick<TrackingOrder, 'taskType' | 'store'>) {
  if (!order.store) return null
  if (order.store === 'tasker_choose') return 'Buy from anywhere'
  return order.taskType === 'restaurant' ? getCafeLabel(order.store) : order.store
}

export type TrackingStage = {
  key: 'searching' | 'accepted' | 'working' | 'review' | 'completed' | 'cancelled'
  title: string
  label: string
  detail: string
  activeIndex: number
  steps: string[]
  mood: 'searching' | 'matched' | 'thinking' | 'success' | 'warning'
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

export function getTrackingStage(order: TrackingOrder): TrackingStage {
  const inquiry = Boolean(order.cafeInquiry || order.cafeInquiryStatus)
  const shopping = order.taskType === 'restaurant' || order.taskType === 'shopping' || order.taskType === 'indomie' || order.taskType === 'water'
  const workingLabel = inquiry ? 'Checking the cafe' : shopping ? 'Getting your order' : 'Working on your task'
  const steps = ['Finding a tasker', 'Order accepted', workingLabel, inquiry ? 'Inquiry completed' : 'Delivered']
  // Terminal status takes precedence over retained assignment/payment/cafe history.
  if (order.status === 'cancelled') return { key: 'cancelled', title: 'Order cancelled', label: 'Cancelled', detail: 'This order was cancelled.', activeIndex: 0, steps: ['Order cancelled'], mood: 'warning' }
  if (order.status === 'completed') return { key: 'completed', title: inquiry ? 'Your cafe check is complete!' : 'Your order has arrived!', label: inquiry ? 'Completed' : 'Delivered', detail: inquiry ? 'Your tasker has finished checking the cafe.' : 'Your tasker marked your order as delivered. Thank you for using SwiftDU.', activeIndex: 3, steps, mood: 'success' }
  if (order.isDeclinedTask) return { key: 'review', title: 'We’re checking your payment', label: 'Payment under review', detail: 'SwiftDU is reviewing the transfer. Contact support if you need help.', activeIndex: 2, steps: [...steps.slice(0, 2), 'Checking payment', steps[3]], mood: 'warning' }
  if (order.cafeInquiryStatus && !['waiting_for_tasker', 'tasker_assigned'].includes(order.cafeInquiryStatus)) return { key: 'working', title: 'Your tasker is checking the cafe', label: 'Cafe check in progress', detail: cafeStatusLabels[order.cafeInquiryStatus], activeIndex: 2, steps, mood: 'thinking' }
  // Payment enables fulfilment; it does not prove pickup or departure. There is
  // no separate heading-to-customer event in the current order model.
  if (!inquiry && (isCustomerPaymentConfirmed(order) || order.status === 'paid')) {
    const store = order.store && order.store !== 'tasker_choose' ? getTrackingStore(order) : null
    return { key: 'working', title: shopping ? 'Your tasker is getting your order!' : 'Your tasker is working on your request', label: 'In progress', detail: store ? `Your tasker is arranging your order from ${store}. Message them for an update on delivery.` : 'Your tasker is taking care of your request. Message them for an update on delivery.', activeIndex: 2, steps, mood: 'thinking' }
  }
  if (order.taskerId || order.status === 'in_progress' || order.cafeInquiryStatus === 'tasker_assigned') return { key: 'accepted', title: 'Your tasker has accepted your order!', label: 'Order accepted', detail: inquiry ? 'Your tasker will visit the cafe and share what is available on WhatsApp.' : 'Your tasker will arrange your order. Confirm your payment when prompted and stay reachable.', activeIndex: 1, steps, mood: 'matched' }
  return { key: 'searching', title: 'Finding a tasker for you', label: 'Finding a tasker', detail: 'We’re looking for an available tasker. This page updates automatically.', activeIndex: 0, steps, mood: 'searching' }
}

export function getTrackingEta(order: TrackingOrder, nowMs: number) {
  if (!isActiveOrderStatus(order.status) || order.cafeInquiry || order.cafeInquiryStatus || order.isDeclinedTask || !(isCustomerPaymentConfirmed(order) || order.status === 'paid')) return null
  // The persisted deadline already contains any extension. Never add it again
  // or manufacture an ETA from creation time or the delivery location.
  const dueMs = order.completionDueAt instanceof Date ? order.completionDueAt.getTime() : Date.parse(order.completionDueAt || '')
  if (!Number.isFinite(dueMs)) return null
  if (dueMs <= nowMs) return { label: 'Taking a little longer', time: null, detail: 'Message your tasker for an update. We’re here if you need help.' }
  return { label: 'Delivery target', time: new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(dueMs), detail: 'This is an estimate. We’ll keep you updated if anything changes.' }
}

export function needsOrderPayment(order: TrackingOrder | null) {
  if (!order || !isActiveOrderStatus(order.status)) return false
  return Boolean(order.taskerId && !order.hasPaid && !order.isDeclinedTask && (!order.cafeInquiryStatus || canPayCafeInquiry(order.cafeInquiryStatus)))
}
