import type { Server as SocketIOServer } from 'socket.io'
import { requiresPremiumTasker as requiresPremiumTaskerByAmount } from '@/lib/tasker-access'

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
  requiresPremiumTasker?: boolean
  location?: string
  store?: string
  packaging?: string
  acceptedAt?: string
  createdAt?: string
  paymentStatus?: string
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
  requiresPremiumTasker?: boolean
  location?: string
  store?: string
  packaging?: string
  acceptedAt?: Date | string
  createdAt?: Date | string
  paymentStatus?: string
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
    requiresPremiumTasker:
      order.requiresPremiumTasker ?? requiresPremiumTaskerByAmount(order.amount),
    location: order.location,
    store: order.store,
    packaging: order.packaging,
    acceptedAt: serializeDate(order.acceptedAt),
    createdAt: serializeDate(order.createdAt),
    paymentStatus: order.paymentStatus,
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

  io.to('taskers').emit('tasks:updated', payload)
  io.to(`user:${payload.userId}`).emit('order:updated', payload)
  io.to(`order:${payload._id}`).emit('order:updated', payload)

  if (payload.taskerId) {
    io.to(`tasker:${payload.taskerId}`).emit('order:updated', payload)
  }
}
