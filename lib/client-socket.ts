'use client'

import { io, type Socket } from 'socket.io-client'

let sharedSocket: Socket | null = null
let sharedSocketConsumers = 0
let sharedSocketResumeTimeout: number | null = null

const DEFAULT_API_SOCKET_PAUSE_MS = 1200

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

  if (sharedSocketResumeTimeout) {
    window.clearTimeout(sharedSocketResumeTimeout)
    sharedSocketResumeTimeout = null
  }

  socket.disconnect()
  sharedSocket = null
}

export function pauseSharedSocketForApi(duration = DEFAULT_API_SOCKET_PAUSE_MS) {
  if (!sharedSocket || sharedSocketConsumers === 0) {
    return
  }

  if (sharedSocketResumeTimeout) {
    window.clearTimeout(sharedSocketResumeTimeout)
  }

  if (sharedSocket.connected) {
    sharedSocket.disconnect()
  }

  sharedSocketResumeTimeout = window.setTimeout(() => {
    sharedSocketResumeTimeout = null

    if (sharedSocket && sharedSocketConsumers > 0 && !sharedSocket.connected) {
      sharedSocket.connect()
    }
  }, duration)
}

export async function fetchWithSocketPause(
  input: RequestInfo | URL,
  init?: RequestInit,
  pauseDuration = DEFAULT_API_SOCKET_PAUSE_MS
) {
  pauseSharedSocketForApi(pauseDuration)

  try {
    return await fetch(input, init)
  } finally {
    pauseSharedSocketForApi(pauseDuration)
  }
}
