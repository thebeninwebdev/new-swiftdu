import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import { NextRequest } from 'next/server'

const { connectDB } = await import('@/lib/db')
const { handleSammyStaffOrder } = await import('@/lib/sammy/staff-order-service')

const STAFF_ORDERS_PATH = '/api/internal/sammy/staff/orders'
const MAX_BODY_BYTES = 1_048_576

function safeErrorFields(error: unknown) {
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    code: typeof error === 'object' && error && 'code' in error ? (error as { code?: unknown }).code : undefined,
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
  for (const name of ['authorization', 'content-type', 'x-swiftdu-correlation-id']) {
    const value = request.headers[name]
    if (typeof value === 'string') headers.set(name, value)
  }
  return headers
}

export function assertMongoTransactionSupport() {
  const topologyType = mongoose.connection.getClient().topology?.description.type
  if (topologyType !== 'ReplicaSetWithPrimary' && topologyType !== 'Sharded') {
    throw new Error('MongoDB transactions are unavailable; configure a replica set or sharded cluster before starting the order API.')
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
      const nextRequest = new NextRequest(new URL(STAFF_ORDERS_PATH, baseUrl), {
        method: 'POST',
        headers: forwardHeaders(request),
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
        : 500
      if (status >= 500) console.error('[Order API] request failed', safeErrorFields(error))
      sendJson(response, status, { error: status === 413 ? 'Request body is too large.' : 'The request could not be completed.' })
    }
  })

  async function drainBackgroundWork() {
    while (backgroundWork.size) await Promise.allSettled([...backgroundWork])
  }

  return {
    server,
    drainBackgroundWork,
  }
}

export async function startOrderApiServer(port = Number(process.env.PORT || 10000)) {
  if (!process.env.MONGODB_URI?.trim()) throw new Error('MONGODB_URI must be configured.')
  if (!process.env.SAMMY_SWIFTDU_INTERNAL_SECRET?.trim()) throw new Error('SAMMY_SWIFTDU_INTERNAL_SECRET must be configured.')
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error('PORT must be a valid TCP port.')

  await connectDB()
  assertMongoTransactionSupport()

  const service = createOrderApiServer()
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error)
    service.server.once('error', onError)
    service.server.listen(port, '0.0.0.0', () => {
      service.server.off('error', onError)
      resolve()
    })
  })

  console.info('[Order API] listening', { port })
  return {
    server: service.server,
    async close() {
      await new Promise<void>((resolve, reject) => {
        service.server.close((error) => error ? reject(error) : resolve())
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