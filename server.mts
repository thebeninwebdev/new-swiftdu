import { createServer } from 'node:http'
import next from 'next'

// Retained for the existing npm start/dev commands; Socket.IO is no longer hosted here.
const dev = process.env.NODE_ENV !== 'production' && process.env.npm_lifecycle_event !== 'start'
const hostname = '0.0.0.0'
const port = Number(process.env.PORT || 3000)
const app = next({ dev, hostname, port })
async function bootstrap() {
  await app.prepare()
  createServer(app.getRequestHandler()).listen(port, hostname, () => console.log(`> Server ready on http://localhost:${port}`))
}
bootstrap().catch((error) => { console.error('Failed to start server', error); process.exit(1) })
