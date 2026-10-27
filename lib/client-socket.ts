'use client'

import { io, type Socket } from 'socket.io-client'
import { fetchWithTimeout } from '@/lib/client-fetch'

let sharedSocket: Socket | null = null
let sharedSocketConsumers = 0
let listeningForOnline = false

function createSharedSocket() {
  return io({
    withCredentials: true,
  })
}

function reconnectSharedSocket() {
  if (sharedSocket && sharedSocketConsumers > 0 && !sharedSocket.connected) sharedSocket.connect()
}

function startNetworkListener() {
  if (listeningForOnline) return
  window.addEventListener('online', reconnectSharedSocket)
  listeningForOnline = true
}

function stopNetworkListener() {
  if (!listeningForOnline) return
  window.removeEventListener('online', reconnectSharedSocket)
  listeningForOnline = false
}

export function acquireSharedSocket() {
  if (!sharedSocket) {
    sharedSocket = createSharedSocket()
  }

  sharedSocketConsumers += 1
  startNetworkListener()

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

  stopNetworkListener()
  socket.disconnect()
  sharedSocket = null
}

/** @deprecated API requests no longer interrupt the shared realtime connection. */
export function pauseSharedSocketForApi() {
  // Compatibility no-op for older callers.
}

export async function fetchWithSocketPause(
  input: RequestInfo | URL,
  init?: RequestInit,
  _pauseDuration?: number
) {
  void _pauseDuration
  return fetchWithTimeout(input, init)
}
