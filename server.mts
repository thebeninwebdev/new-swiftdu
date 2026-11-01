import { createServer } from 'node:http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production' && process.env.npm_lifecycle_event !== 'start'
const hostname = '0.0.0.0'
const port = Number(process.env.PORT || 3000)
const app = next({ dev, hostname, port })
async function bootstrap() {
  await app.prepare()
  // Let Next load .env before importing giveaway modules, which initialize MongoDB.
  const { default: installGiveawaySocket } = await import('./lib/giveaway-socket')
  const httpServer = createServer(app.getRequestHandler())
  const io = new SocketIOServer(httpServer, { cors: { origin: true, credentials: true }, transports: ['websocket', 'polling'] })
  installGiveawaySocket(io)
  httpServer.listen(port, hostname, () => console.log(`> Server ready on http://localhost:${port}`))
}
bootstrap().catch((error) => { console.error('Failed to start server', error); process.exit(1) })
