import { cafeStatusLabels, type CafeInquiryFields } from './cafe-inquiry'
import { isActiveOrderStatus } from './order-status'

type TrackingOrder = CafeInquiryFields & {
  status: string
  taskerId?: string
  hasPaid?: boolean
  isDeclinedTask?: boolean
  cafeInquiry?: boolean
  cafeInquiryFeePaid?: boolean
  cafeInquiryDetailsSubmitted?: boolean
}

export function getTrackingStage(order: TrackingOrder) {
  // Terminal status takes precedence over retained assignment/payment/cafe history.
  if (order.status === 'cancelled') return { title: 'Order cancelled', label: 'Cancelled', detail: 'This order was cancelled.', progress: 0, taskerLabel: 'Cancelled' }
  if (order.status === 'completed') return { title: 'Order delivered', label: 'Delivered', detail: 'Your order has reached you.', progress: 100, taskerLabel: 'Delivered' }
  const title = 'Your order is being fulfilled'
  if (order.cafeInquiryStatus) return { title, label: order.hasPaid ? 'Food order underway' : 'Cafe check', detail: order.hasPaid ? 'Your Tasker is handling purchase and delivery.' : cafeStatusLabels[order.cafeInquiryStatus], progress: 0, taskerLabel: order.taskerId ? 'Assigned' : 'Searching' }
  if (order.hasPaid || order.status === 'paid') return { title, label: 'Tasker on the way', detail: 'Your tasker is moving with your order.', progress: 78, taskerLabel: 'En route' }
  if (order.taskerId || order.status === 'in_progress') return { title, label: 'Order accepted', detail: 'Your order is being prepared. Confirm payment so fulfilment can keep moving.', progress: 45, taskerLabel: 'Assigned' }
  return { title, label: 'Finding a tasker', detail: 'We are matching this order with an available tasker.', progress: 18, taskerLabel: 'Searching' }
}

export function needsOrderPayment(order: TrackingOrder | null) {
  if (!order || !isActiveOrderStatus(order.status)) return false
  const needsCafeDetails = order.cafeInquiry && order.cafeInquiryFeePaid && !order.cafeInquiryDetailsSubmitted
  return Boolean(order.taskerId && !order.hasPaid && !order.isDeclinedTask && !needsCafeDetails && (!order.cafeInquiryStatus || order.cafeInquiryStatus === 'ready_for_payment'))
}
