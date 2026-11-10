import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import { NextRequest } from 'next/server'

const { connectDB } = await import('@/lib/db')
const { handleSammyStaffOrder } = await import('@/lib/sammy/staff-order-service')

const STAFF_ORDERS_PATH = '/api/internal/sammy/staff/orders'
const MAX_BODY_BYTES = 1_048_576

function sanitizeSensitiveText(text: string): string {
  return text
    .replace(/(mongodb(?:\+srv)?:\/\/)[^:]+:[^@]+@/gi, '$1***:***@')
    .replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi, '$1[REDACTED]')
    .replace(/(secret|token|password|key)=([^\s&]+)/gi, '$1=[REDACTED]')
}

export function safeErrorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errorWithExtras = error as Error & {
      code?: unknown
      status?: unknown
      errors?: Array<{ text?: string; location?: unknown }>
      loc?: unknown
    }
    const sanitizedMessage = sanitizeSensitiveText(error.message)
    const sanitizedStack = error.stack ? sanitizeSensitiveText(error.stack) : undefined
    const base: Record<string, unknown> = {
      name: error.name || 'Error',
      message: sanitizedMessage,
    }
    if (errorWithExtras.code !== undefined) {
      base.code = errorWithExtras.code
    }
    if (errorWithExtras.status !== undefined) {
      base.status = errorWithExtras.status
    }
    if (errorWithExtras.loc !== undefined) {
      base.loc = errorWithExtras.loc
    }
    if (Array.isArray(errorWithExtras.errors) && errorWithExtras.errors.length > 0) {
      base.errors = errorWithExtras.errors.map((item) => {
        if (typeof item === 'object' && item !== null) {
          return {
            text: typeof item.text === 'string' ? sanitizeSensitiveText(item.text) : undefined,
            location: item.location,
          }
        }
        return String(item)
      })
    }
    if (sanitizedStack) {
      base.stack = sanitizedStack
    }
    return base
  }
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>
    return {
      name: typeof obj.name === 'string' ? obj.name : 'UnknownError',
      message: typeof obj.message === 'string' ? sanitizeSensitiveText(String(obj.message)) : undefined,
      code: obj.code,
    }
  }
  return {
    name: 'UnknownError',
    message: sanitizeSensitiveText(String(error)),
  }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request body is too large.'), { status: 413 })
    chunks.push(bytes)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function forwardHeaders(request: IncomingMessage) {
  const headers = new Headers()
  for (const name of ['authorization', 'content-type', 'x-swiftdu-correlation-id', 'idempotency-key']) {
    const value = request.headers[name]
    if (typeof value === 'string') headers.set(name, value)
  }
  return headers
}

export async function assertMongoTransactionSupport() {
  const db = mongoose.connection.db

  if (!db) {
    throw new Error('MongoDB connection is not initialized.')
  }

  const hello = await db.admin().command({ hello: 1 })

  const isReplicaSetPrimary =
    typeof hello.setName === 'string' &&
    hello.isWritablePrimary === true

  const isSharded = hello.msg === 'isdbgrid'

  if (!isReplicaSetPrimary && !isSharded) {
    throw new Error(
      'MongoDB transactions are unavailable; configure a replica set or sharded cluster before starting the order API.'
    )
  }
}

export function createOrderApiServer() {
  const backgroundWork = new Set<Promise<unknown>>()
  const scheduleBackground = (promise: Promise<unknown>) => {
    let tracked: Promise<unknown>
    tracked = Promise.resolve(promise)
      .catch((error) => {
        console.error('[Order API] background task failed', safeErrorFields(error))
      })
      .finally(() => backgroundWork.delete(tracked))
    backgroundWork.add(tracked)
  }

  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname
    const requestedCorrelation = request.headers['x-swiftdu-correlation-id']
    const correlationId = typeof requestedCorrelation === 'string' && /^[a-f0-9-]{16,64}$/i.test(requestedCorrelation)
      ? requestedCorrelation
      : randomUUID()
    const startedAt = performance.now()

    if (request.method === 'GET' && pathname === '/health') {
      const connected = mongoose.connection.readyState === 1
      return sendJson(response, connected ? 200 : 503, { status: connected ? 'ok' : 'unavailable' })
    }
    if (request.method !== 'POST' || pathname !== STAFF_ORDERS_PATH) {
      return sendJson(response, 404, { error: 'Not found.' })
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
      return sendJson(response, 415, { error: 'Content-Type must be application/json.' })
    }

    try {
      const body = await readBody(request)
      const baseUrl = process.env.SWIFTDU_BASE_URL?.trim() || 'https://swiftdu.org'
      const headers = forwardHeaders(request)
      if (!headers.has('x-swiftdu-correlation-id')) {
        headers.set('x-swiftdu-correlation-id', correlationId)
      }

      const nextRequest = new NextRequest(new URL(STAFF_ORDERS_PATH, baseUrl), {
        method: 'POST',
        headers,
        body,
      })
      const result = await handleSammyStaffOrder(nextRequest, scheduleBackground)
      response.writeHead(result.status, {
        'content-type': result.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
      response.end(await result.text())
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error && typeof error.status === 'number'
        ? error.status
        : (error instanceof SyntaxError ? 400 : 500)
      const durationMs = Math.round(performance.now() - startedAt)
      if (status >= 500) {
        console.error('[Order API] request failed', {
          correlationId,
          status,
          durationMs,
          ...safeErrorFields(error),
        })
      }
      sendJson(response, status, {
        error: status === 413 ? 'Request body is too large.' : (status === 400 ? 'Invalid request payload.' : 'The request could not be completed.'),
      })
    }
  })

  async function drainBackgroundWork() {
    while (backgroundWork.size) await Promise.allSettled([...backgroundWork])
  }

  return {
    server,
    scheduleBackground,
    drainBackgroundWork,
  }
}

function startEscalationWorker(service: { scheduleBackground: (p: Promise<unknown>) => void }) {
  let interval: NodeJS.Timeout | undefined
  let running = false

  const runEscalation = async () => {
    if (running) return
    running = true
    try {
      const { processDueOrderEscalations } = await import('@/lib/orders/order-escalation')
      const result = await processDueOrderEscalations()
      if (result.remindersSent > 0 || result.adminAlertsSent > 0 || result.errors.length > 0) {
        console.info('[Order API] escalation processed', {
          ordersChecked: result.ordersChecked,
          remindersSent: result.remindersSent,
          adminAlertsSent: result.adminAlertsSent,
          errorCount: result.errors.length,
        })
      }
    } catch (error) {
      console.error('[Order API] escalation processing error', safeErrorFields(error))
    } finally {
      running = false
    }
  }

  const initialTimer = setTimeout(() => {
    service.scheduleBackground(runEscalation())
  }, 5_000)
  initialTimer.unref?.()

  interval = setInterval(() => {
    service.scheduleBackground(runEscalation())
  }, 20_000)
  interval.unref?.()

  return () => {
    clearTimeout(initialTimer)
    if (interval) clearInterval(interval)
  }
}

export async function startOrderApiServer(port = Number(process.env.PORT || 10000)) {
  if (!process.env.MONGODB_URI?.trim()) throw new Error('MONGODB_URI must be configured.')
  if (!process.env.SAMMY_SWIFTDU_INTERNAL_SECRET?.trim()) throw new Error('SAMMY_SWIFTDU_INTERNAL_SECRET must be configured.')
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error('PORT must be a valid TCP port.')

  await connectDB()
  await assertMongoTransactionSupport()

  const service = createOrderApiServer()
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error)
    service.server.once('error', onError)
    service.server.listen(port, '0.0.0.0', () => {
      service.server.off('error', onError)
      resolve()
    })
  })

  // Start periodic unaccepted order escalation processor in an isolated, supervised background routine
  const stopEscalation = startEscalationWorker(service)

  console.info('[Order API] listening', { port })
  return {
    server: service.server,
    async close() {
      stopEscalation()
      await new Promise<void>((resolve, reject) => {
        service.server.close((error) => (error ? reject(error) : resolve()))
        service.server.closeIdleConnections()
      })
      await service.drainBackgroundWork()
      await mongoose.disconnect()
    },
  }
}

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isMainModule()) {
  startOrderApiServer().then((service) => {
    let shutdownPromise: Promise<void> | undefined
    const shutdown = (signal: string) => {
      shutdownPromise ??= service.close().catch((error) => {
        console.error('[Order API] graceful shutdown failed', safeErrorFields(error))
        process.exitCode = 1
      })
      console.info('[Order API] shutdown requested', { signal })
    }
    process.once('SIGTERM', () => shutdown('SIGTERM'))
    process.once('SIGINT', () => shutdown('SIGINT'))
  }).catch((error) => {
    console.error('[Order API] startup failed', safeErrorFields(error))
    process.exitCode = 1
  })
}
