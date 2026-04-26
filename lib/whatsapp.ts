import 'server-only'

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

interface WhatsAppTransportConfig {
  enabled: boolean
  recipients: string[]
  accountSid?: string
  authToken?: string
  from?: string
  reason?: string
}

declare global {
  var __swiftDuTwilioWhatsAppState:
    | {
        lastAlertSentAt: Map<string, number>
      }
    | undefined
}

function parseBoolean(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '').trim().toLowerCase()
  )
}

function normalizePhoneNumber(value: string) {
  const trimmed = value.replace(/^whatsapp:/i, '').trim()

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

  // Nigerian numbers
  if (digits.startsWith('0') && digits.length === 11) {
    digits = `234${digits.slice(1)}`
  }

  return `+${digits}`
}

function toWhatsAppAddress(value: string) {
  const phoneNumber = normalizePhoneNumber(value)

  if (!phoneNumber) {
    return null
  }

  return `whatsapp:${phoneNumber}`
}

function getAlertRecipients() {
  const configuredRecipients =
    process.env.TWILIO_WHATSAPP_TO ||
    process.env.WHATSAPP_ALERT_RECIPIENTS ||
    process.env.WHATSAPP_ALERT_NUMBER ||
    ''

  return Array.from(
    new Set(
      configuredRecipients
        .split(/[;,]/)
        .map((value) => toWhatsAppAddress(value))
        .filter((value): value is string => Boolean(value))
    )
  )
}

function getTransportConfig(): WhatsAppTransportConfig {
  const recipients = getAlertRecipients()

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()

  const from = toWhatsAppAddress(
    process.env.TWILIO_WHATSAPP_FROM || ''
  )

  if (!parseBoolean(process.env.TWILIO_WHATSAPP_ENABLED)) {
    return {
      enabled: false,
      recipients,
      reason: 'Twilio WhatsApp alerts are disabled',
    }
  }

  if (!accountSid || !authToken) {
    return {
      enabled: false,
      recipients,
      reason: 'Twilio credentials missing',
    }
  }

  if (!from) {
    return {
      enabled: false,
      recipients,
      reason: 'Twilio WhatsApp sender missing',
    }
  }

  if (!recipients.length) {
    return {
      enabled: false,
      recipients,
      reason: 'No recipients configured',
    }
  }

  return {
    enabled: true,
    recipients,
    accountSid,
    authToken,
    from,
  }
}

function getState() {
  if (!globalThis.__swiftDuTwilioWhatsAppState) {
    globalThis.__swiftDuTwilioWhatsAppState = {
      lastAlertSentAt: new Map(),
    }
  }

  return globalThis.__swiftDuTwilioWhatsAppState
}

async function sendTwilioWhatsAppMessage(
  config: WhatsAppTransportConfig,
  recipient: string,
  message: string
) {
  const body = new URLSearchParams({
    To: recipient,
    From: config.from!,
    Body: message,
  })

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.accountSid}:${config.authToken}`
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)

    throw new Error(
      errorData?.message || 'Failed to send WhatsApp message'
    )
  }
}

export async function sendWhatsAppAdminAlert({
  message,
  dedupeKey,
  cooldownMs = 5 * 60 * 1000,
}: SendWhatsAppAdminAlertInput): Promise<SendWhatsAppAdminAlertResult> {
  const state = getState()
  const config = getTransportConfig()

  if (!config.enabled) {
    return {
      recipientCount: config.recipients.length,
      deliveredCount: 0,
      skipped: true,
      reason: config.reason,
    }
  }

  if (dedupeKey) {
    const lastSentAt = state.lastAlertSentAt.get(dedupeKey)

    if (lastSentAt && Date.now() - lastSentAt < cooldownMs) {
      return {
        recipientCount: config.recipients.length,
        deliveredCount: 0,
        skipped: true,
        reason: 'Duplicate alert prevented',
      }
    }
  }

  const results = await Promise.allSettled(
    config.recipients.map((recipient) =>
      sendTwilioWhatsAppMessage(config, recipient, message)
    )
  )

  const deliveredCount = results.filter(
    (r) => r.status === 'fulfilled'
  ).length

  if (deliveredCount > 0 && dedupeKey) {
    state.lastAlertSentAt.set(dedupeKey, Date.now())
  }

  return {
    recipientCount: config.recipients.length,
    deliveredCount,
    skipped: false,
    reason:
      deliveredCount === 0
        ? 'Twilio could not deliver WhatsApp alert'
        : undefined,
  }
}