import webpush, { type PushSubscription as WebPushSubscription } from 'web-push'

import { getSiteUrl } from '@/lib/site'
import { PushSubscription } from '@/models/push-subscription'

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

let webPushConfigured = false

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || ''
}

function getVapidPrivateKey() {
  return process.env.VAPID_PRIVATE_KEY?.trim() || ''
}

function getVapidSubject() {
  return (
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.WEB_PUSH_SUBJECT?.trim() ||
    `mailto:support@${new URL(getSiteUrl()).hostname}`
  )
}

function configureWebPush() {
  if (webPushConfigured) {
    return true
  }

  const publicKey = getVapidPublicKey()
  const privateKey = getVapidPrivateKey()

  if (!publicKey || !privateKey) {
    return false
  }

  webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey)
  webPushConfigured = true
  return true
}

function normalizeUrl(url: string) {
  if (url.startsWith('http')) {
    return url
  }

  return `${getSiteUrl()}${url.startsWith('/') ? url : `/${url}`}`
}

function toWebPushSubscription(subscription: {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: subscription.keys,
  }
}

export async function sendPushNotification(
  input: SendPushNotificationInput
): Promise<SendPushNotificationResult> {
  if (!configureWebPush()) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'Web Push VAPID keys are not configured.',
    }
  }

  const query =
    'userIds' in input.audience
      ? { userId: { $in: input.audience.userIds } }
      : { role: { $in: input.audience.roles } }

  const subscriptions = await PushSubscription.find(query).lean()

  if (subscriptions.length === 0) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'No push subscriptions found for this audience.',
    }
  }

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: normalizeUrl(input.url),
    tag: input.tag,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  })

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(subscription), payload)
        return true
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error && 'statusCode' in error
            ? Number(error.statusCode)
            : 0

        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({ endpoint: subscription.endpoint })
        } else {
          console.error('[Web Push Send Error]:', error)
        }

        return false
      }
    })
  )

  return {
    recipientCount: subscriptions.length,
    deliveredCount: results.filter(
      (result) => result.status === 'fulfilled' && result.value
    ).length,
    skipped: false,
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
