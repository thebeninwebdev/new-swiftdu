import type { Server as SocketIOServer } from 'socket.io'

declare global {
  var __swiftDuIo: SocketIOServer | undefined
}

export type OrderSocketPayload = {
  _id: string
  userId: string
  taskerId?: string
  taskerName?: string
  status: string
  hasPaid?: boolean
  isDeclinedTask?: boolean
  declinedMessage?: string
  taskType?: string
  description?: string
  amount?: number
  commission?: number
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
  acceptedAt?: string
  createdAt?: string
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

type SocketOrderLike = {
  _id: { toString(): string } | string
  userId: string
  taskerId?: { toString(): string } | string | null
  taskerName?: string
  status: string
  hasPaid?: boolean
  isDeclinedTask?: boolean
  declinedMessage?: string
  taskType?: string
  description?: string
  amount?: number
  commission?: number
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
  acceptedAt?: Date | string
  createdAt?: Date | string
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

export function setSocketServer(io: SocketIOServer) {
  globalThis.__swiftDuIo = io
}

export function getSocketServer() {
  return globalThis.__swiftDuIo
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
    hasPaid: order.hasPaid,
    isDeclinedTask: order.isDeclinedTask,
    declinedMessage: order.declinedMessage,
    taskType: order.taskType,
    description: order.description,
    amount: order.amount,
    commission: order.commission,
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
    acceptedAt: serializeDate(order.acceptedAt),
    createdAt: serializeDate(order.createdAt),
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
  const io = getSocketServer()

  if (!io) {
    return
  }

  const payload = toOrderSocketPayload(order)

  if (!payload._id || !payload.userId) {
    return
  }

  io.to(payload.isTestOrder ? 'taskers:training' : 'taskers:live').emit('tasks:updated', payload)
  if (!payload.isTestOrder) {
    io.to('taskers').emit('tasks:updated', payload)
  }
  io.to(`user:${payload.userId}`).emit('order:updated', payload)
  io.to(`order:${payload._id}`).emit('order:updated', payload)

  if (payload.taskerId) {
    io.to(`tasker:${payload.taskerId}`).emit('order:updated', payload)
  }
}
