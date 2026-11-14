'use client'

import {
  createClient,
  type InboundMessage,
  type ChannelStateChange,
  type PubSubClient,
  type RealtimeChannel,
  type TokenRequest,
} from '@ably/pubsub-device'
import { fetchWithTimeout } from '@/lib/client-fetch'

const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000

type Handler = (...args: unknown[]) => void
type TimerHandle = ReturnType<typeof setTimeout>
type RealtimeDiagnosticCode =
  | 'realtime_authorization_failed'
  | 'ably_connection_failed'
  | 'channel_subscription_failed'

export type RealtimeDiagnostic = {
  code: RealtimeDiagnosticCode
  phase?: 'initial' | 'renewal'
  status?: number
  channel?: string
  attempt?: number
  retryInMs?: number
  errorName?: string
  errorCode?: number
}

export type SharedRealtimeClient = {
  readonly connected: boolean
  on<TArgs extends unknown[]>(event: string, handler: (...args: TArgs) => void): void
  off<TArgs extends unknown[]>(event: string, handler: (...args: TArgs) => void): void
  emit(event: string, payload?: unknown): void
  connect(): Promise<void>
  disconnect(): void
}

type AuthorizationPayload = { tokenRequest: TokenRequest; channels: string[] }
export type ClientSocketDependencies = {
  fetchAuthorization: () => Promise<Response>
  createRealtimeClient: typeof createClient
  setTimer: (callback: () => void, delayMs: number) => TimerHandle
  clearTimer: (timer: TimerHandle) => void
  report: (diagnostic: RealtimeDiagnostic) => void
}

type ActiveSubscription = {
  channel: RealtimeChannel
  event: 'order:updated' | 'tasks:updated'
  listener: (message: InboundMessage) => void
}
type ChannelStateListener = { channel: RealtimeChannel; event: 'attached' | 'detached' | 'suspended' | 'failed'; listener: (change: ChannelStateChange) => void }

function errorMetadata(error: unknown) {
  if (!error || typeof error !== 'object') return {}
  const candidate = error as { name?: unknown; code?: unknown; statusCode?: unknown }
  const errorCode = Number(candidate.code ?? candidate.statusCode)
  return {
    ...(typeof candidate.name === 'string' ? { errorName: candidate.name } : {}),
    ...(Number.isFinite(errorCode) ? { errorCode } : {}),
  }
}

function defaultReporter(diagnostic: RealtimeDiagnostic) {
  // Diagnostics intentionally exclude token requests, credentials, and raw error messages.
  console.warn('[realtime-client]', diagnostic)
}

const defaultDependencies: ClientSocketDependencies = {
  fetchAuthorization: () => fetchWithTimeout('/api/realtime/token', { cache: 'no-store' }),
  createRealtimeClient: createClient,
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (timer) => clearTimeout(timer),
  report: defaultReporter,
}

export class BrowserRealtimeClient implements SharedRealtimeClient {
  private client: PubSubClient | null = null
  private handlers = new Map<string, Set<Handler>>()
  private subscriptions: ActiveSubscription[] = []
  private channelStateListeners: ChannelStateListener[] = []
  private retryTimer: TimerHandle | null = null
  private connectInFlight: Promise<void> | null = null
  private generation = 0
  private retryAttempt = 0
  private ready = false
  private stopped = false

  constructor(private readonly dependencies: ClientSocketDependencies = defaultDependencies) {}

  get connected() { return this.ready }

  on<TArgs extends unknown[]>(event: string, handler: (...args: TArgs) => void) {
    const handlers = this.handlers.get(event) || new Set<Handler>()
    handlers.add(handler as Handler)
    this.handlers.set(event, handlers)
  }

  off<TArgs extends unknown[]>(event: string, handler: (...args: TArgs) => void) {
    const handlers = this.handlers.get(event)
    handlers?.delete(handler as Handler)
    if (handlers?.size === 0) this.handlers.delete(event)
  }

  emit() { /* Browsers have subscribe-only Ably tokens. */ }

  private fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((handler) => handler(...args))
  }

  private report(diagnostic: RealtimeDiagnostic) {
    this.dependencies.report(diagnostic)
    this.fire('diagnostic', diagnostic)
  }

  private async authorize(phase: 'initial' | 'renewal'): Promise<AuthorizationPayload> {
    let response: Response
    try {
      response = await this.dependencies.fetchAuthorization()
    } catch (error) {
      this.report({ code: 'realtime_authorization_failed', phase, ...errorMetadata(error) })
      throw new Error('Realtime authorization failed.')
    }

    if (!response.ok) {
      this.report({ code: 'realtime_authorization_failed', phase, status: response.status })
      throw new Error('Realtime authorization failed.')
    }

    let payload: Partial<AuthorizationPayload>
    try {
      payload = await response.json() as Partial<AuthorizationPayload>
    } catch {
      this.report({ code: 'realtime_authorization_failed', phase, status: response.status })
      throw new Error('Realtime authorization response was invalid.')
    }
    if (!payload.tokenRequest || !Array.isArray(payload.channels) || payload.channels.length === 0 || payload.channels.some(channel => typeof channel !== 'string')) {
      this.report({ code: 'realtime_authorization_failed', phase })
      throw new Error('Realtime authorization response was invalid.')
    }
    return payload as AuthorizationPayload
  }

  private clearRetry() {
    if (this.retryTimer) this.dependencies.clearTimer(this.retryTimer)
    this.retryTimer = null
  }

  private scheduleRetry() {
    if (this.stopped || this.retryTimer) return
    const attempt = this.retryAttempt++
    const retryInMs = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * (2 ** attempt))
    this.retryTimer = this.dependencies.setTimer(() => {
      this.retryTimer = null
      void this.restart()
    }, retryInMs)
    this.fire('reconnect_scheduled', { attempt: attempt + 1, retryInMs })
  }

  private teardownClient() {
    const client = this.client
    this.client = null
    this.ready = false
    for (const { channel, event, listener } of this.subscriptions) channel.unsubscribe(event, listener)
    this.subscriptions = []
    for (const { channel, event, listener } of this.channelStateListeners) channel.off(event, listener)
    this.channelStateListeners = []
    if (client) {
      client.connection.off()
      client.close()
    }
  }

  private async restart() {
    if (this.stopped) return
    this.generation += 1
    this.teardownClient()
    this.connectInFlight = null
    await this.connect()
  }

  async connect() {
    if (this.ready || this.stopped) return
    if (this.connectInFlight) return this.connectInFlight
    const generation = ++this.generation
    const attempt = this.startConnectionAttempt(generation)
    this.connectInFlight = attempt
    try {
      await attempt
    } finally {
      if (this.connectInFlight === attempt) this.connectInFlight = null
    }
  }

  private async startConnectionAttempt(generation: number) {
    try {
      const authorization = await this.authorize('initial')
      if (this.stopped || generation !== this.generation) return
      let initialTokenRequest: TokenRequest | null = authorization.tokenRequest
      const client = this.dependencies.createRealtimeClient({
        autoConnect: false,
        closeOnUnload: true,
        disconnectedRetryTimeout: RECONNECT_MAX_DELAY_MS,
        suspendedRetryTimeout: RECONNECT_MAX_DELAY_MS,
        authCallback: async (_params, callback) => {
          if (initialTokenRequest) {
            const tokenRequest = initialTokenRequest
            initialTokenRequest = null
            callback(null, tokenRequest)
            return
          }
          try {
            const refreshed = await this.authorize('renewal')
            callback(null, refreshed.tokenRequest)
          } catch {
            callback('Realtime authorization renewal failed.', null)
          }
        },
      })
      this.client = client

      let subscriptionsReady = false
      const channels: RealtimeChannel[] = []
      const markReady = () => {
        const channelsAttached = channels.length > 0 && channels.every(channel => channel.state === 'attached')
        if (this.stopped || generation !== this.generation || client.connection.state !== 'connected' || !subscriptionsReady || !channelsAttached) return
        this.clearRetry()
        this.retryAttempt = 0
        if (!this.ready) {
          this.ready = true
          this.fire('connect')
        }
      }
      const handleConnected = () => {
        markReady()
      }
      const handleDisconnected = () => {
        if (this.ready) this.fire('disconnect')
        this.ready = false
        this.report({ code: 'ably_connection_failed', attempt: this.retryAttempt + 1, ...errorMetadata(client.connection.errorReason) })
        this.scheduleRetry()
      }
      const handleFailed = () => {
        if (this.ready) this.fire('disconnect')
        this.ready = false
        const diagnostic = { code: 'ably_connection_failed' as const, attempt: this.retryAttempt + 1, ...errorMetadata(client.connection.errorReason) }
        this.report(diagnostic)
        this.fire('connect_error', diagnostic)
        this.scheduleRetry()
      }
      client.connection.on('connected', handleConnected)
      client.connection.on('disconnected', handleDisconnected)
      client.connection.on('suspended', handleFailed)
      client.connection.on('failed', handleFailed)
      client.connection.connect()

      for (const name of [...new Set(authorization.channels)]) {
        const channel = client.channels.get(name)
        channels.push(channel)
        const handleAttached = () => markReady()
        const handleChannelFailure = () => {
          if (this.ready) this.fire('disconnect')
          this.ready = false
          const diagnostic = { code: 'channel_subscription_failed' as const, channel: name, ...errorMetadata(channel.errorReason) }
          this.report(diagnostic)
          this.fire('connect_error', diagnostic)
          this.scheduleRetry()
        }
        for (const event of ['attached', 'detached', 'suspended', 'failed'] as const) {
          const listener = event === 'attached' ? handleAttached : handleChannelFailure
          channel.on(event, listener)
          this.channelStateListeners.push({ channel, event, listener })
        }
        for (const event of ['order:updated', 'tasks:updated'] as const) {
          const listener = (message: InboundMessage) => this.fire(event, message.data)
          this.subscriptions.push({ channel, event, listener })
          try {
            await channel.subscribe(event, listener)
          } catch (error) {
            const diagnostic = { code: 'channel_subscription_failed' as const, channel: name, ...errorMetadata(error) }
            this.report(diagnostic)
            this.fire('connect_error', diagnostic)
            throw new Error('Realtime channel subscription failed.')
          }
        }
      }

      if (this.stopped || generation !== this.generation) return
      subscriptionsReady = true
      markReady()
    } catch (error) {
      if (this.stopped || generation !== this.generation) return
      this.ready = false
      const message = error instanceof Error ? error.message : ''
      const alreadyClassified = message.startsWith('Realtime authorization') || message.startsWith('Realtime channel subscription')
      if (!alreadyClassified) {
        const diagnostic = { code: 'ably_connection_failed' as const, attempt: this.retryAttempt + 1, ...errorMetadata(error) }
        this.report(diagnostic)
        this.fire('connect_error', diagnostic)
      }
      this.scheduleRetry()
    }
  }

  disconnect() {
    this.stopped = true
    this.generation += 1
    this.clearRetry()
    this.teardownClient()
    this.connectInFlight = null
    this.handlers.clear()
  }
}

type OnlineEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>

export class SharedSocketPool {
  private sharedClient: SharedRealtimeClient | null = null
  private consumers = 0
  private listeningForOnline = false
  private readonly handleOnline = () => { if (this.sharedClient && this.consumers > 0 && !this.sharedClient.connected) void this.sharedClient.connect() }

  constructor(
    private readonly createSharedClient: () => SharedRealtimeClient = () => new BrowserRealtimeClient(),
    private readonly onlineTarget: OnlineEventTarget = window,
  ) {}

  acquire() {
    if (!this.sharedClient) this.sharedClient = this.createSharedClient()
    this.consumers += 1
    if (!this.listeningForOnline) {
      this.onlineTarget.addEventListener('online', this.handleOnline)
      this.listeningForOnline = true
    }
    void this.sharedClient.connect()
    return this.sharedClient
  }

  release(client: SharedRealtimeClient | null | undefined) {
    if (!client || client !== this.sharedClient) return
    this.consumers = Math.max(0, this.consumers - 1)
    if (this.consumers) return
    if (this.listeningForOnline) {
      this.onlineTarget.removeEventListener('online', this.handleOnline)
      this.listeningForOnline = false
    }
    this.sharedClient.disconnect()
    this.sharedClient = null
  }
}

let sharedPool: SharedSocketPool | null = null
function pool() { return sharedPool ||= new SharedSocketPool() }
export function acquireSharedSocket() { return pool().acquire() }
export function releaseSharedSocket(client: SharedRealtimeClient | null | undefined) { pool().release(client) }
/** @deprecated API requests no longer interrupt realtime. */
export function pauseSharedSocketForApi() {}
export async function fetchWithSocketPause(input: RequestInfo | URL, init?: RequestInit, pauseDuration?: number) {
  void pauseDuration
  return fetchWithTimeout(input, init)
}
