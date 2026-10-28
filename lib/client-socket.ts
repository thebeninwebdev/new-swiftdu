'use client'

import Ably from 'ably'
import { fetchWithTimeout } from '@/lib/client-fetch'

type Handler = (...args: unknown[]) => void
export type SharedRealtimeClient = {
  readonly connected: boolean
  on<TArgs extends unknown[]>(event: string, handler: (...args: TArgs) => void): void
  off<TArgs extends unknown[]>(event: string, handler: (...args: TArgs) => void): void
  emit(event: string, payload?: unknown): void
  disconnect(): void
}

class BrowserRealtimeClient implements SharedRealtimeClient {
  private client: Ably.Realtime | null = null
  private handlers = new Map<string, Set<Handler>>()
  private ready = false
  get connected() { return this.ready }
  on<TArgs extends unknown[]>(event: string, handler: (...args: TArgs) => void) {
    const handlers = this.handlers.get(event) || new Set<Handler>()
    handlers.add(handler as Handler)
    this.handlers.set(event, handlers)
  }
  off<TArgs extends unknown[]>(event: string, handler: (...args: TArgs) => void) {
    this.handlers.get(event)?.delete(handler as Handler)
  }
  emit() { /* Browsers have subscribe-only Ably tokens. */ }
  private fire(event: string, ...args: unknown[]) { this.handlers.get(event)?.forEach((handler) => handler(...args)) }
  async connect() {
    try {
      const response = await fetchWithTimeout('/api/realtime/token', { cache: 'no-store' })
      if (!response.ok) throw new Error('Unable to authorize realtime')
      const { channels } = await response.json() as { channels: string[] }
      this.client = new Ably.Realtime({
        // Fetch a fresh, server-authorized token whenever Ably renews credentials.
        authCallback: async (_params, callback) => {
          try {
            const tokenResponse = await fetchWithTimeout('/api/realtime/token', { cache: 'no-store' })
            if (!tokenResponse.ok) throw new Error('Unable to refresh realtime authorization')
            const { tokenRequest } = await tokenResponse.json() as { tokenRequest: Ably.TokenRequest }
            callback(null, tokenRequest)
          } catch (error) { callback(error instanceof Error ? error.message : 'Unable to refresh realtime authorization', null) }
        },
      })
      this.client.connection.on('connected', () => { this.ready = true; this.fire('connect') })
      this.client.connection.on('disconnected', () => { this.ready = false; this.fire('disconnect') })
      this.client.connection.on('failed', () => { this.ready = false; this.fire('connect_error') })
      for (const name of channels) {
        const channel = this.client.channels.get(name)
        await channel.subscribe('order:updated', (message) => this.fire('order:updated', message.data))
        await channel.subscribe('tasks:updated', (message) => this.fire('tasks:updated', message.data))
      }
    } catch (error) { this.fire('connect_error', error) }
  }
  disconnect() { this.ready = false; this.client?.close(); this.client = null }
}

let sharedClient: BrowserRealtimeClient | null = null
let consumers = 0
let listeningForOnline = false
function reconnect() { if (sharedClient && consumers > 0 && !sharedClient.connected) void sharedClient.connect() }
export function acquireSharedSocket() {
  if (!sharedClient) { sharedClient = new BrowserRealtimeClient(); void sharedClient.connect() }
  consumers += 1
  if (!listeningForOnline) { window.addEventListener('online', reconnect); listeningForOnline = true }
  return sharedClient
}
export function releaseSharedSocket(client: SharedRealtimeClient | null | undefined) {
  if (!client || client !== sharedClient) return
  consumers = Math.max(0, consumers - 1)
  if (consumers) return
  if (listeningForOnline) { window.removeEventListener('online', reconnect); listeningForOnline = false }
  sharedClient.disconnect(); sharedClient = null
}
/** @deprecated API requests no longer interrupt realtime. */
export function pauseSharedSocketForApi() {}
export async function fetchWithSocketPause(input: RequestInfo | URL, init?: RequestInit, _pauseDuration?: number) { return fetchWithTimeout(input, init) }
