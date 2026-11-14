import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  ClientOptions,
  ConnectionState,
  InboundMessage,
  PubSubClient,
  RealtimeChannel,
  TokenRequest,
} from '@ably/pubsub-device'
import {
  BrowserRealtimeClient,
  SharedSocketPool,
  type ClientSocketDependencies,
  type RealtimeDiagnostic,
  type SharedRealtimeClient,
} from './client-socket'
import { getMissedRealtimeOrderIds, getTaskerDashboardPollInterval } from './realtime/tasker-dashboard-diagnostics'

const tokenRequest = {
  keyName: 'test.key', clientId: 'swiftdu:test', nonce: 'nonce', mac: 'mac', capability: '{}', timestamp: 1,
} as TokenRequest

class FakeTimers {
  pending: Array<{ callback: () => void; delayMs: number; handle: ReturnType<typeof setTimeout> }> = []
  set = (callback: () => void, delayMs: number) => {
    const handle = { delayMs } as unknown as ReturnType<typeof setTimeout>
    this.pending.push({ callback, delayMs, handle })
    return handle
  }
  clear = (handle: ReturnType<typeof setTimeout>) => {
    this.pending = this.pending.filter(timer => timer.handle !== handle)
  }
  async runNext() {
    const timer = this.pending.shift()
    assert.ok(timer)
    timer.callback()
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
  }
}

type Listener = () => void
class FakeConnection {
  state: ConnectionState = 'initialized'
  errorReason = null
  private listeners = new Map<string, Set<Listener>>()
  constructor(private readonly options: ClientOptions, private readonly failConnection: boolean) {}
  on(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) || new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }
  off() { this.listeners.clear() }
  emit(event: string) { this.listeners.get(event)?.forEach(listener => listener()) }
  connect() {
    const authCallback = this.options.authCallback
    if (!authCallback) throw new Error('Expected auth callback')
    authCallback({}, (error) => {
      if (error || this.failConnection) {
        this.state = 'failed'
        this.errorReason = { name: 'FakeConnectionError', code: 50001 } as never
        this.emit('failed')
        return
      }
      this.state = 'connected'
      this.emit('connected')
    })
  }
  renew() {
    const authCallback = this.options.authCallback
    if (!authCallback) throw new Error('Expected auth callback')
    authCallback({}, (error) => {
      if (!error) return
      this.state = 'failed'
      this.errorReason = { name: 'FakeRenewalError', code: 40142 } as never
      this.emit('failed')
    })
  }
}

class FakeChannel {
  state = 'initialized'
  subscriptions = new Map<string, Set<(message: InboundMessage) => void>>()
  unsubscribeCount = 0
  errorReason = null
  private stateListeners = new Map<string, Set<Listener>>()
  constructor(readonly name: string, private readonly failSubscription: boolean) {}
  async subscribe(event: string, listener: (message: InboundMessage) => void) {
    const listeners = this.subscriptions.get(event) || new Set<(message: InboundMessage) => void>()
    listeners.add(listener)
    this.subscriptions.set(event, listeners)
    if (this.failSubscription) throw Object.assign(new Error('subscription failed'), { code: 91001 })
    this.state = 'attached'
    return null
  }
  unsubscribe(event: string, listener: (message: InboundMessage) => void) {
    this.unsubscribeCount++
    this.subscriptions.get(event)?.delete(listener)
  }
  on(event: string, listener: Listener) {
    const listeners = this.stateListeners.get(event) || new Set<Listener>()
    listeners.add(listener)
    this.stateListeners.set(event, listeners)
  }
  off(event: string, listener: Listener) { this.stateListeners.get(event)?.delete(listener) }
}

class FakeAblyClient {
  readonly connection: FakeConnection
  readonly channel: FakeChannel
  closeCount = 0
  channels: { get: () => RealtimeChannel }
  constructor(options: ClientOptions, failConnection: boolean, failSubscription: boolean) {
    this.connection = new FakeConnection(options, failConnection)
    this.channel = new FakeChannel('tasks:live', failSubscription)
    this.channels = { get: () => this.channel as unknown as RealtimeChannel }
  }
  close() { this.closeCount++ }
}

function harness(options: { authorizationFailures?: number; renewalFailure?: boolean; connectionFailures?: number; subscriptionFailures?: number } = {}) {
  const timers = new FakeTimers()
  const diagnostics: RealtimeDiagnostic[] = []
  const clients: FakeAblyClient[] = []
  let authorizationAttempts = 0
  const dependencies: ClientSocketDependencies = {
    fetchAuthorization: async () => {
      authorizationAttempts++
      if (authorizationAttempts <= (options.authorizationFailures || 0) || (options.renewalFailure && authorizationAttempts === 2)) return Response.json({ error: 'no' }, { status: 503 })
      return Response.json({ tokenRequest, channels: ['tasks:live', 'tasks:live'] })
    },
    createRealtimeClient: ((clientOptions: ClientOptions) => {
      const index = clients.length
      const client = new FakeAblyClient(
        clientOptions,
        index < (options.connectionFailures || 0),
        index < (options.subscriptionFailures || 0),
      )
      clients.push(client)
      return client as unknown as PubSubClient
    }) as ClientSocketDependencies['createRealtimeClient'],
    setTimer: timers.set,
    clearTimer: timers.clear,
    report: diagnostic => diagnostics.push(diagnostic),
  }
  return { client: new BrowserRealtimeClient(dependencies), clients, diagnostics, timers, get authorizationAttempts() { return authorizationAttempts } }
}

test('initial authorization failure reconnects with bounded exponential backoff', async () => {
  const state = harness({ authorizationFailures: 2 })
  await state.client.connect()
  assert.equal(state.client.connected, false)
  assert.equal(state.diagnostics[0].code, 'realtime_authorization_failed')
  assert.equal(state.timers.pending[0].delayMs, 1_000)
  await state.timers.runNext()
  assert.equal(state.timers.pending[0].delayMs, 2_000)
  await state.timers.runNext()
  assert.equal(state.client.connected, true)
  assert.equal(state.authorizationAttempts, 3)
})

test('connection and channel failures are distinct and cleanup precedes reconnect', async () => {
  const connectionState = harness({ connectionFailures: 1 })
  await connectionState.client.connect()
  assert.ok(connectionState.diagnostics.some(item => item.code === 'ably_connection_failed'))
  await connectionState.timers.runNext()
  assert.equal(connectionState.client.connected, true)
  assert.equal(connectionState.clients[0].closeCount, 1)

  const channelState = harness({ subscriptionFailures: 1 })
  await channelState.client.connect()
  assert.ok(channelState.diagnostics.some(item => item.code === 'channel_subscription_failed'))
  await channelState.timers.runNext()
  assert.equal(channelState.client.connected, true)
  assert.equal(channelState.clients[0].channel.unsubscribeCount, 1)
})

test('failed token renewal is observable and recreates the client', async () => {
  const state = harness({ renewalFailure: true })
  await state.client.connect()
  assert.equal(state.client.connected, true)
  state.clients[0].connection.renew()
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(state.diagnostics.some(item => item.code === 'realtime_authorization_failed' && item.phase === 'renewal'))
  assert.ok(state.diagnostics.some(item => item.code === 'ably_connection_failed'))
  await state.timers.runNext()
  assert.equal(state.client.connected, true)
  assert.equal(state.clients.length, 2)
})

test('repeated connect and disconnect cycles do not duplicate channel subscriptions', async () => {
  const state = harness()
  await Promise.all([state.client.connect(), state.client.connect(), state.client.connect()])
  assert.equal(state.clients.length, 1)
  assert.equal(state.clients[0].channel.subscriptions.get('order:updated')?.size, 1)
  assert.equal(state.clients[0].channel.subscriptions.get('tasks:updated')?.size, 1)
  state.client.disconnect()
  assert.equal(state.clients[0].channel.unsubscribeCount, 2)

  const onlineListeners = new Set<Listener>()
  const onlineTarget = {
    addEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => onlineListeners.add(listener as Listener),
    removeEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => onlineListeners.delete(listener as Listener),
  }
  const pooledClients: Array<SharedRealtimeClient & { connectCount: number; disconnectCount: number }> = []
  const pool = new SharedSocketPool(() => {
    const pooled = {
      connected: false, connectCount: 0, disconnectCount: 0,
      on: () => {}, off: () => {}, emit: () => {},
      connect: async function () { this.connectCount++; this.connected = true },
      disconnect: function () { this.disconnectCount++; this.connected = false },
    }
    pooledClients.push(pooled)
    return pooled
  }, onlineTarget as Pick<Window, 'addEventListener' | 'removeEventListener'>)
  const first = pool.acquire()
  const second = pool.acquire()
  assert.equal(first, second)
  assert.equal(pooledClients.length, 1)
  assert.equal(onlineListeners.size, 1)
  pool.release(first)
  assert.equal(pooledClients[0].disconnectCount, 0)
  pool.release(second)
  assert.equal(pooledClients[0].disconnectCount, 1)
  assert.equal(onlineListeners.size, 0)
})

test('API reconciliation identifies missed realtime orders and keeps low-frequency fallback', () => {
  assert.deepEqual(getMissedRealtimeOrderIds(['known', 'received', 'missed'], new Set(['known']), new Set(['received']), false), [])
  assert.deepEqual(getMissedRealtimeOrderIds(['known', 'received', 'missed'], new Set(['known']), new Set(['received']), true), ['missed'])
  assert.equal(getTaskerDashboardPollInterval(false), 30_000)
  assert.equal(getTaskerDashboardPollInterval(true), 60_000)
})
