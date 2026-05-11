import { getSiteUrl } from '@/lib/site'

type PushAudience =
  | { userIds: string[] }
  | { roles: Array<'user' | 'admin' | 'tasker'> }

interface SendPushNotificationInput {
  audience: PushAudience
  title: string
  body: string
  url: string
  tag?: string
}

interface SendPushNotificationResult {
  recipientCount: number
  deliveredCount: number
  skipped: boolean
  reason?: string
}

function getPushEngageApiKey() {
  return process.env.PUSHENGAGE_API_KEY?.trim() || ''
}

function getTaskerSegmentName() {
  return process.env.PUSHENGAGE_TASKER_SEGMENT?.trim() || 'Taskers'
}

function getTaskerSegmentParamName() {
  return process.env.PUSHENGAGE_TASKER_SEGMENT_PARAM?.trim() || 'segment_name'
}

function normalizeUrl(url: string) {
  if (url.startsWith('http')) {
    return url
  }

  return `${getSiteUrl()}${url.startsWith('/') ? url : `/${url}`}`
}

function shouldSendToTaskers(audience: PushAudience) {
  return 'roles' in audience && audience.roles.includes('tasker')
}

async function sendPushEngageNotification(input: SendPushNotificationInput) {
  const apiKey = getPushEngageApiKey()

  if (!apiKey) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'PUSHENGAGE_API_KEY is not configured.',
    }
  }

  if (!shouldSendToTaskers(input.audience)) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'PushEngage is currently configured only for tasker-wide notifications.',
    }
  }

  const body = new URLSearchParams({
    notification_title: input.title,
    notification_message: input.body,
    notification_url: normalizeUrl(input.url),
  })

  body.set(getTaskerSegmentParamName(), getTaskerSegmentName())

  const response = await fetch('https://api.pushengage.com/apiv1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      api_key: apiKey,
    },
    body,
  })

  const responseText = await response.text()

  if (!response.ok) {
    console.error('[PushEngage Send Error]:', {
      status: response.status,
      response: responseText,
    })

    return {
      recipientCount: 1,
      deliveredCount: 0,
      skipped: false,
      reason: `PushEngage returned ${response.status}.`,
    }
  }

  return {
    recipientCount: 1,
    deliveredCount: 1,
    skipped: false,
  }
}

export async function sendPushNotification(
  input: SendPushNotificationInput
): Promise<SendPushNotificationResult> {
  try {
    return await sendPushEngageNotification(input)
  } catch (error) {
    console.error('[PushEngage Send Exception]:', error)

    return {
      recipientCount: 1,
      deliveredCount: 0,
      skipped: false,
      reason: error instanceof Error ? error.message : 'PushEngage send failed.',
    }
  }
}

export function formatPushTaskType(taskType?: string) {
  const labels: Record<string, string> = {
    restaurant: 'Food delivery',
    printing: 'Printing',
    copy_notes: 'Copy notes',
    shopping: 'Shopping',
    water: 'Bag of water',
    others: 'Errand',
  }

  return labels[taskType || ''] || taskType || 'Errand'
}
