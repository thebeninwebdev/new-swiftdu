import 'server-only'

import path from 'node:path'

import type { Client as WhatsAppClient } from 'whatsapp-web.js'

export type WhatsAppRuntimeStatus =
  | 'disabled'
  | 'initializing'
  | 'needs_qr'
  | 'authenticated'
  | 'ready'
  | 'auth_failure'
  | 'disconnected'
  | 'error'

interface WhatsAppRuntimeState {
  client: WhatsAppClient | null
  initPromise: Promise<void> | null
  readyPromise: Promise<void> | null
  resolveReady?: () => void
  rejectReady?: (error: Error) => void
  status: WhatsAppRuntimeStatus
  qrCode: string | null
  lastError: string | null
  lastEventAt: string | null
  lastAlertSentAt: Map<string, number>
}

interface SendWhatsAppAdminAlertInput {
  message: string
  dedupeKey?: string
  cooldownMs?: number
}

interface SendWhatsAppAdminAlertResult {
  recipientCount: number
  deliveredCount: number
  skipped: boolean
  reason?: string
}

interface WhatsAppEnablementStatus {
  enabled: boolean
  recipients: string[]
  reason?: string
}

declare global {
  var __swiftDuWhatsAppState: WhatsAppRuntimeState | undefined
}

function parseBoolean(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function normalizePhoneNumber(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  let digits = trimmed.replace(/\D/g, '')

  if (!digits) {
    return null
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith('0') && digits.length === 11) {
    digits = `234${digits.slice(1)}`
  }

  return digits
}

function getAlertRecipients() {
  const configuredRecipients =
    process.env.WHATSAPP_ALERT_RECIPIENTS ||
    process.env.WHATSAPP_ALERT_NUMBER ||
    ''

  return Array.from(
    new Set(
      configuredRecipients
        .split(/[;,]/)
        .map((value) => normalizePhoneNumber(value))
        .filter((value): value is string => Boolean(value))
    )
  )
}

function getUnsupportedRuntimeReason() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return (
      'WhatsApp Web needs a persistent Node.js server and writable session storage, ' +
      'so it cannot stay authenticated inside Vercel Functions.'
    )
  }

  return null
}

function getWhatsAppEnablementStatus(): WhatsAppEnablementStatus {
  const recipients = getAlertRecipients()

  if (!parseBoolean(process.env.WHATSAPP_WEB_ENABLED)) {
    return {
      enabled: false,
      recipients,
      reason: 'WhatsApp alerts are disabled.',
    }
  }

  if (recipients.length === 0) {
    return {
      enabled: false,
      recipients,
      reason: 'No WhatsApp recipients are configured.',
    }
  }

  const unsupportedRuntimeReason = getUnsupportedRuntimeReason()

  if (unsupportedRuntimeReason) {
    return {
      enabled: false,
      recipients,
      reason: unsupportedRuntimeReason,
    }
  }

  return {
    enabled: true,
    recipients,
  }
}

export function isWhatsAppWebEnabled() {
  return getWhatsAppEnablementStatus().enabled
}

function getState() {
  if (!globalThis.__swiftDuWhatsAppState) {
    globalThis.__swiftDuWhatsAppState = {
      client: null,
      initPromise: null,
      readyPromise: null,
      status: isWhatsAppWebEnabled() ? 'initializing' : 'disabled',
      qrCode: null,
      lastError: null,
      lastEventAt: null,
      lastAlertSentAt: new Map<string, number>(),
    }
  }

  return globalThis.__swiftDuWhatsAppState
}

function createReadyPromise(state: WhatsAppRuntimeState) {
  state.readyPromise = new Promise<void>((resolve, reject) => {
    state.resolveReady = resolve
    state.rejectReady = reject
  })
}

function updateStateStatus(
  state: WhatsAppRuntimeState,
  status: WhatsAppRuntimeStatus,
  error?: string | null
) {
  state.status = status
  state.lastError = error || null
  state.lastEventAt = new Date().toISOString()
}

function rejectReadyPromise(state: WhatsAppRuntimeState, error: Error) {
  state.rejectReady?.(error)
  state.resolveReady = undefined
  state.rejectReady = undefined
  createReadyPromise(state)
}

function resolveReadyPromise(state: WhatsAppRuntimeState) {
  state.resolveReady?.()
  state.resolveReady = undefined
  state.rejectReady = undefined
}

async function logQrToTerminal(qrCode: string) {
  try {
    const qrTerminal = await import('qrcode-terminal')
    qrTerminal.generate(qrCode, { small: true })
  } catch (error) {
    console.warn('[WhatsApp Web] QR code generated, but terminal rendering failed.', error)
    console.log(qrCode)
  }

  console.log('[WhatsApp Web] Scan the QR code above with the WhatsApp account you want to use.')
}

function toChatId(phoneNumber: string) {
  return `${phoneNumber}@c.us`
}

function getPuppeteerConfig() {
  const headless = !['0', 'false', 'no', 'off'].includes(
    String(process.env.WHATSAPP_WEB_HEADLESS || '').trim().toLowerCase()
  )

  return {
    headless,
    executablePath: process.env.WHATSAPP_WEB_CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function getWhatsAppStateSnapshot() {
  const state = getState()
  const enablement = getWhatsAppEnablementStatus()

  return {
    enabled: enablement.enabled,
    recipients: enablement.recipients,
    status: state.status,
    qrPending: Boolean(state.qrCode),
    lastError: state.lastError,
    lastEventAt: state.lastEventAt,
    disabledReason: enablement.reason || null,
  }
}

export async function initializeWhatsAppClient() {
  const state = getState()
  const enablement = getWhatsAppEnablementStatus()

  if (!enablement.enabled) {
    updateStateStatus(state, 'disabled', enablement.reason)
    return getWhatsAppStateSnapshot()
  }

  if (!state.readyPromise) {
    createReadyPromise(state)
  }

  if (state.client || state.initPromise) {
    await state.initPromise?.catch(() => undefined)
    return getWhatsAppStateSnapshot()
  }

  state.initPromise = (async () => {
    updateStateStatus(state, 'initializing')

    const { Client, LocalAuth } = await import('whatsapp-web.js')

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: process.env.WHATSAPP_WEB_SESSION_NAME || 'swiftdu-admin-alerts',
        dataPath:
          process.env.WHATSAPP_WEB_AUTH_PATH ||
          path.join(process.cwd(), '.wwebjs_auth'),
      }),
      puppeteer: getPuppeteerConfig(),
    })

    state.client = client

    client.on('qr', (qrCode) => {
      state.qrCode = qrCode
      updateStateStatus(state, 'needs_qr')
      void logQrToTerminal(qrCode)
    })

    client.on('authenticated', () => {
      state.qrCode = null
      updateStateStatus(state, 'authenticated')
    })

    client.on('ready', () => {
      state.qrCode = null
      updateStateStatus(state, 'ready')
      resolveReadyPromise(state)
      console.log('[WhatsApp Web] Client is ready.')
    })

    client.on('auth_failure', (message) => {
      const error = new Error(`WhatsApp authentication failed: ${String(message)}`)
      state.qrCode = null
      updateStateStatus(state, 'auth_failure', error.message)
      rejectReadyPromise(state, error)
      console.error('[WhatsApp Web] Authentication failed.', error)
    })

    client.on('disconnected', (reason) => {
      const error = new Error(`WhatsApp disconnected: ${String(reason)}`)
      state.client = null
      state.qrCode = null
      state.initPromise = null
      updateStateStatus(state, 'disconnected', error.message)
      rejectReadyPromise(state, error)
      console.warn('[WhatsApp Web] Client disconnected.', error)
    })

    client.initialize().catch((error: unknown) => {
      const resolvedError =
        error instanceof Error ? error : new Error('WhatsApp initialization failed.')

      state.client = null
      state.qrCode = null
      state.initPromise = null
      updateStateStatus(state, 'error', resolvedError.message)
      rejectReadyPromise(state, resolvedError)
      console.error('[WhatsApp Web] Failed to initialize client.', resolvedError)
    })
  })()

  await state.initPromise.catch(() => undefined)

  return getWhatsAppStateSnapshot()
}

async function ensureWhatsAppReady(timeoutMs = 15000) {
  const state = getState()

  await initializeWhatsAppClient()

  if (state.status === 'ready' && state.client) {
    return true
  }

  if (!state.readyPromise) {
    return false
  }

  try {
    await Promise.race([state.readyPromise, wait(timeoutMs)])
  } catch {
    return false
  }

  return state.status === 'ready' && Boolean(state.client)
}

export async function sendWhatsAppAdminAlert({
  message,
  dedupeKey,
  cooldownMs = 5 * 60 * 1000,
}: SendWhatsAppAdminAlertInput): Promise<SendWhatsAppAdminAlertResult> {
  const state = getState()
  const enablement = getWhatsAppEnablementStatus()
  const recipients = enablement.recipients

  if (!enablement.enabled) {
    updateStateStatus(state, 'disabled', enablement.reason)
    return {
      recipientCount: recipients.length,
      deliveredCount: 0,
      skipped: true,
      reason: enablement.reason,
    }
  }

  if (recipients.length === 0) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'No WhatsApp recipients are configured.',
    }
  }

  if (dedupeKey) {
    const lastSentAt = state.lastAlertSentAt.get(dedupeKey)

    if (lastSentAt && Date.now() - lastSentAt < cooldownMs) {
      return {
        recipientCount: recipients.length,
        deliveredCount: 0,
        skipped: true,
        reason: 'An equivalent WhatsApp alert was sent recently.',
      }
    }
  }

  const isReady = await ensureWhatsAppReady()

  if (!isReady || !state.client) {
    return {
      recipientCount: recipients.length,
      deliveredCount: 0,
      skipped: true,
      reason: `WhatsApp Web is currently ${state.status}.`,
    }
  }

  const results = await Promise.allSettled(
    recipients.map((recipient) => state.client!.sendMessage(toChatId(recipient), message))
  )

  const deliveredCount = results.filter((result) => result.status === 'fulfilled').length

  if (deliveredCount > 0 && dedupeKey) {
    state.lastAlertSentAt.set(dedupeKey, Date.now())
  }

  return {
    recipientCount: recipients.length,
    deliveredCount,
    skipped: false,
    reason:
      deliveredCount === 0
        ? 'WhatsApp Web could not deliver the alert.'
        : undefined,
  }
}

export async function destroyWhatsAppClient() {
  const state = getState()
  const client = state.client

  state.client = null
  state.initPromise = null
  state.qrCode = null

  if (!client) {
    updateStateStatus(
      state,
      isWhatsAppWebEnabled() ? 'disconnected' : 'disabled',
      isWhatsAppWebEnabled() ? 'WhatsApp Web client was stopped.' : getWhatsAppEnablementStatus().reason
    )
    return
  }

  try {
    await client.destroy()
  } catch (error) {
    console.warn('[WhatsApp Web] Failed to destroy client cleanly.', error)
  }

  updateStateStatus(state, 'disconnected', 'WhatsApp Web client was stopped.')
}
