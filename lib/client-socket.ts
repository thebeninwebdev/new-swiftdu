'use client'

import { io, type Socket } from 'socket.io-client'

let sharedSocket: Socket | null = null
let sharedSocketConsumers = 0

function createSharedSocket() {
  return io({
    withCredentials: true,
    transports: ['websocket'],
  })
}

export function acquireSharedSocket() {
  if (!sharedSocket) {
    sharedSocket = createSharedSocket()
  }

  sharedSocketConsumers += 1

  return sharedSocket
}

export function releaseSharedSocket(socket: Socket | null | undefined) {
  if (!socket || socket !== sharedSocket) {
    return
  }

  sharedSocketConsumers = Math.max(0, sharedSocketConsumers - 1)

  if (sharedSocketConsumers > 0) {
    return
  }

  socket.disconnect()
  sharedSocket = null
}
