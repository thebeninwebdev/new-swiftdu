import type { CafeInquiryFields } from '@/lib/cafe-inquiry'
import Ably from 'ably'

export type OrderSocketPayload = CafeInquiryFields & {
  _id: string
  userId: string
  taskerId?: string
  taskerName?: string
  status: string
  cancellationReason?: string
  hasPaid?: boolean
  isDeclinedTask?: boolean
  declinedMessage?: string
  paymentDisputeResolution?: string
  paymentDisputeResolvedAt?: string
  paymentEventuallyReceivedAt?: string
  cafeInquiry?: boolean
  cafeInquiryDetailsSubmitted?: boolean
  serviceFee?: number
  taskType?: string
  description?: string
  amount?: number
  commission?: number
  firstOrderBonusApplied?: boolean
  firstOrderBonusAmount?: number
  platformFeeBeforeFirstOrderBonus?: number
  pricingModel?: string
  platformFee?: number
  taskerFee?: number
  totalAmount?: number
  dueDate?: string
  deadline?: string
  deadlineDate?: string
  noteSize?: string
  numberOfPages?: number
  drawingPages?: number
  location?: string
  store?: string
  packaging?: string
  restaurantPeopleCount?: number
  restaurantTakeawayCount?: number
  restaurantPackagingFee?: number
  indomiePacks?: number
  eggCount?: number
  batchId?: string
  scheduledFor?: Date | string
  acceptedAt?: string
  createdAt?: string
  updatedAt?: string
  paymentStatus?: string
  completionTimerStartedAt?: string
  completionDueAt?: string
  completionWindowMinutes?: number
  completionExtensionMinutes?: number
  completedBeforeTimer?: boolean
  platformFeeWaivedForFastCompletion?: boolean
  customerReceiptConfirmed?: boolean
  customerReceiptRespondedAt?: string
  prematureCompletionReported?: boolean
  prematureCompletionReportedAt?: string
  isTestOrder?: boolean
  createdInMode?: string
}

type SocketOrderLike = CafeInquiryFields & {
  _id: { toString(): string } | string
  userId: string
  taskerId?: { toString(): string } | string | null
  taskerName?: string
  status: string
  cancellationReason?: string
  hasPaid?: boolean
  isDeclinedTask?: boolean
  declinedMessage?: string
  paymentDisputeResolution?: string
  paymentDisputeResolvedAt?: Date | string
  paymentEventuallyReceivedAt?: Date | string
  cafeInquiry?: boolean
  cafeInquiryDetailsSubmitted?: boolean
  serviceFee?: number
  taskType?: string
  description?: string
  amount?: number
  commission?: number
  firstOrderBonusApplied?: boolean
  firstOrderBonusAmount?: number
  platformFeeBeforeFirstOrderBonus?: number
  pricingModel?: string
  platformFee?: number
  taskerFee?: number
  totalAmount?: number
  dueDate?: Date | string
  deadline?: Date | string
  deadlineDate?: Date | string
  noteSize?: string
  numberOfPages?: number
  drawingPages?: number
  location?: string
  store?: string
  packaging?: string
  restaurantPeopleCount?: number
  restaurantTakeawayCount?: number
  restaurantPackagingFee?: number
  indomiePacks?: number
  eggCount?: number
  batchId?: string
  scheduledFor?: Date | string
  acceptedAt?: Date | string
  createdAt?: Date | string
  updatedAt?: Date | string
  paymentStatus?: string
  completionTimerStartedAt?: Date | string
  completionDueAt?: Date | string
  completionWindowMinutes?: number
  completionExtensionMinutes?: number
  completedBeforeTimer?: boolean
  platformFeeWaivedForFastCompletion?: boolean
  customerReceiptConfirmed?: boolean
  customerReceiptRespondedAt?: Date | string
  prematureCompletionReported?: boolean
  prematureCompletionReportedAt?: Date | string
  isTestOrder?: boolean
  createdInMode?: string
}

function serializeId(value?: { toString(): string } | string | null) {
  if (!value) {
    return undefined
  }

  return typeof value === 'string' ? value : value.toString()
}

function serializeDate(value?: Date | string) {
  if (!value) {
    return undefined
  }

  return value instanceof Date ? value.toISOString() : value
}

export function toOrderSocketPayload(order: SocketOrderLike): OrderSocketPayload {
  return {
    _id: serializeId(order._id) || '',
    userId: String(order.userId),
    taskerId: serializeId(order.taskerId),
    taskerName: order.taskerName,
    status: String(order.status),
    cancellationReason: order.cancellationReason,
    hasPaid: order.hasPaid,
    isDeclinedTask: order.isDeclinedTask,
    declinedMessage: order.declinedMessage,
    paymentDisputeResolution: order.paymentDisputeResolution,
    paymentDisputeResolvedAt: serializeDate(order.paymentDisputeResolvedAt),
    paymentEventuallyReceivedAt: serializeDate(order.paymentEventuallyReceivedAt),
    cafeInquiry: order.cafeInquiry,
    cafeInquiryStatus: order.cafeInquiryStatus,
    cafeAvailableItems: order.cafeAvailableItems,
    cafeSelectedItems: order.cafeSelectedItems,
    cafeOptionsVersion: order.cafeOptionsVersion,
    cafeInquiryDetailsSubmitted: order.cafeInquiryDetailsSubmitted,
    serviceFee: order.serviceFee,
    taskType: order.taskType,
    description: order.description,
    amount: order.amount,
    commission: order.commission,
    firstOrderBonusApplied: order.firstOrderBonusApplied,
    firstOrderBonusAmount: order.firstOrderBonusAmount,
    platformFeeBeforeFirstOrderBonus: order.platformFeeBeforeFirstOrderBonus,
    pricingModel: order.pricingModel,
    platformFee: order.platformFee,
    taskerFee: order.taskerFee,
    totalAmount: order.totalAmount,
    dueDate: serializeDate(order.dueDate),
    deadline: serializeDate(order.deadline),
    deadlineDate: serializeDate(order.deadlineDate),
    noteSize: order.noteSize,
    numberOfPages: order.numberOfPages,
    drawingPages: order.drawingPages,
    location: order.location,
    store: order.store,
    packaging: order.packaging,
    restaurantPeopleCount: order.restaurantPeopleCount,
    restaurantTakeawayCount: order.restaurantTakeawayCount,
    restaurantPackagingFee: order.restaurantPackagingFee,
    indomiePacks: order.indomiePacks,
    eggCount: order.eggCount,
    batchId: order.batchId,
    scheduledFor: serializeDate(order.scheduledFor),
    acceptedAt: serializeDate(order.acceptedAt),
    createdAt: serializeDate(order.createdAt),
    updatedAt: serializeDate(order.updatedAt),
    paymentStatus: order.paymentStatus,
    completionTimerStartedAt: serializeDate(order.completionTimerStartedAt),
    completionDueAt: serializeDate(order.completionDueAt),
    completionWindowMinutes: order.completionWindowMinutes,
    completionExtensionMinutes: order.completionExtensionMinutes,
    completedBeforeTimer: order.completedBeforeTimer,
    platformFeeWaivedForFastCompletion: order.platformFeeWaivedForFastCompletion,
    customerReceiptConfirmed: order.customerReceiptConfirmed,
    customerReceiptRespondedAt: serializeDate(order.customerReceiptRespondedAt),
    prematureCompletionReported: order.prematureCompletionReported,
    prematureCompletionReportedAt: serializeDate(order.prematureCompletionReportedAt),
    isTestOrder: order.isTestOrder,
    createdInMode: order.createdInMode,
  }
}

export function emitOrderUpdated(order: SocketOrderLike) {
  // Existing mutation routes remain fire-and-forget. Order creation uses the
  // exported promise below so Vercel can keep the publish alive with waitUntil.
  void publishOrderUpdated(order).catch((error) => {
    const orderId = serializeId(order._id)
    console.error('[realtime] failed to publish order update', { orderId, error })
  })
}

export async function publishOrderUpdated(order: SocketOrderLike) {
  const payload = toOrderSocketPayload(order)

  if (!payload._id || !payload.userId) {
    return
  }

  await publishOrderUpdatedPayload(payload)
}

async function publishOrderUpdatedPayload(payload: OrderSocketPayload) {
  const key = process.env.ABLY_API_KEY
  if (!key) {
    console.warn('[realtime] ABLY_API_KEY is not configured; update was not published', { orderId: payload._id })
    return
  }

  const client = new Ably.Rest(key)
  const publications = getOrderRealtimePublications(payload).map(({ channel, event }) =>
    client.channels.get(channel).publish(event, event === 'tasks:updated' ? toTaskDiscoveryPayload(payload) : payload),
  )
  await Promise.all(publications)
}

export function getOrderRealtimePublications(payload: Pick<OrderSocketPayload, 'userId' | 'taskerId' | 'isTestOrder'>) {
  return [
    { channel: `user:${payload.userId}`, event: 'order:updated' as const },
    ...(payload.taskerId ? [{ channel: `tasker:${payload.taskerId}`, event: 'order:updated' as const }] : []),
    { channel: payload.isTestOrder ? 'tasks:training' : 'tasks:live', event: 'tasks:updated' as const },
  ]
}

function toTaskDiscoveryPayload(payload: OrderSocketPayload) {
  // Pending tasks are intentionally discoverable. Once assigned, only publish enough
  // information for other taskers to remove/reconcile their local discovery cards.
  if (payload.status === 'pending' && !payload.taskerId) return payload
  return { _id: payload._id, status: payload.status, taskerId: payload.taskerId, isTestOrder: payload.isTestOrder }
}
