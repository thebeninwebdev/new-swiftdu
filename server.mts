import { createServer } from 'node:http'

import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

import { initializeWhatsAppClient, isWhatsAppWebEnabled } from '@/lib/whatsapp'

const dev =
  process.env.NODE_ENV !== 'production' &&
  process.env.npm_lifecycle_event !== 'start'
const hostname = '0.0.0.0'
const port = Number(process.env.PORT || 3000)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

function toHeaders(source: Record<string, string | string[] | undefined>) {
  const headers = new Headers()

  for (const [key, value] of Object.entries(source)) {
    if (!value) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  return headers
}

async function getSocketSession(cookieHeader?: string) {
  if (!cookieHeader) {
    return null
  }

  const response = await fetch(`http://127.0.0.1:${port}/api/auth/get-session`, {
    headers: {
      cookie: cookieHeader,
    },
  })

  if (!response.ok) {
    return null
  }

  return response.json()
}

async function bootstrap() {
  await app.prepare()

  if (isWhatsAppWebEnabled()) {
    void initializeWhatsAppClient().catch((error) => {
      console.error('[WhatsApp Web] Startup initialization failed.', error)
    })
  }

  const httpServer = createServer((request, response) => {
    handle(request, response)
  })

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  })

  globalThis.__swiftDuIo = io

  io.use(async (socket, nextSocket) => {
    try {
      const handshakeHeaders = toHeaders(
        socket.handshake.headers as Record<string, string | string[] | undefined>
      )
      const session = await getSocketSession(handshakeHeaders.get('cookie') || undefined)

      if (!session?.user) {
        return nextSocket(new Error('Unauthorized'))
      }

      socket.data.userId = session.user.id
      socket.data.taskerId = session.user.taskerId || null
      socket.join(`user:${session.user.id}`)

      if (session.user.taskerId) {
        socket.join(`tasker:${session.user.taskerId}`)
      }

      if (session.user.taskerId || session.user.role === 'tasker') {
        socket.join('taskers')
      }

      nextSocket()
    } catch (error) {
      nextSocket(error instanceof Error ? error : new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    socket.on('order:watch', (orderId: string) => {
      if (typeof orderId === 'string' && orderId.trim()) {
        socket.join(`order:${orderId}`)
      }
    })

    socket.on('order:unwatch', (orderId: string) => {
      if (typeof orderId === 'string' && orderId.trim()) {
        socket.leave(`order:${orderId}`)
      }
    })
  })

  httpServer.listen(port, hostname, () => {
    console.log(
      `> Server ready on http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`
    )
  })
}

bootstrap().catch((error) => {
  console.error('Failed to start custom server', error)
  process.exit(1)
})
