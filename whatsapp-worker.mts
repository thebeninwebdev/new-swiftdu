import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

import {
  destroyWhatsAppClient,
  getWhatsAppStateSnapshot,
  initializeWhatsAppClient,
  isWhatsAppWebEnabled,
} from '@/lib/whatsapp'

async function shutdown(signal: string) {
  console.log(`[WhatsApp Worker] Received ${signal}. Shutting down...`)
  await destroyWhatsAppClient()
  process.exit(0)
}

async function bootstrap() {
  if (!isWhatsAppWebEnabled()) {
    const snapshot = getWhatsAppStateSnapshot()
    console.error('[WhatsApp Worker] Startup skipped.')

    if (snapshot.disabledReason) {
      console.error(`[WhatsApp Worker] ${snapshot.disabledReason}`)
    }

    process.exitCode = 1
    return
  }

  const snapshot = await initializeWhatsAppClient()

  console.log('[WhatsApp Worker] Startup state:', snapshot)
  console.log('[WhatsApp Worker] Waiting for QR scan or incoming alerts...')
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

bootstrap().catch((error) => {
  console.error('[WhatsApp Worker] Failed to start.', error)
  process.exit(1)
})
