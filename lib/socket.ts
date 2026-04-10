import type { Server as SocketIOServer } from 'socket.io'

declare global {
  var __swiftDuIo: SocketIOServer | undefined
}

type OrderSocketPayload = {
  _id: string
  userId: string
  taskerId?: string
  taskerName?: string
  status: string
  hasPaid?: boolean
}

export function setSocketServer(io: SocketIOServer) {
  globalThis.__swiftDuIo = io
}

export function getSocketServer() {
  return globalThis.__swiftDuIo
}

export function emitOrderUpdated(order: OrderSocketPayload) {
  const io = getSocketServer()

  if (!io) {
    return
  }

  io.to(`user:${order.userId}`).emit('order:updated', order)
  io.to(`order:${order._id}`).emit('order:updated', order)

  if (order.taskerId) {
    io.to(`tasker:${order.taskerId}`).emit('order:updated', order)
  }
}
