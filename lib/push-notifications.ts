import webpush, {
  type PushSubscription as WebPushSubscription,
  type SendResult,
} from 'web-push'

import { connectDB } from '@/lib/db'
import { getSiteUrl } from '@/lib/site'
import {
  type BrowserPushSubscription,
  toWebPushSubscription,
} from '@/lib/tasker-push-subscriptions'
import { PushSubscription } from '@/models/push-subscription'
import Tasker from '@/models/tasker'

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
  expiredCount?: number
  skipped: boolean
  reason?: string
}

interface StoredPushSubscription extends BrowserPushSubscription {
  userId: string
}

interface WebPushErrorLike {
  statusCode?: number
  message?: string
  body?: string
  endpoint?: string
  headers?: Record<string, string | string[] | undefined>
}

interface SendOneWebPushResult {
  delivered: boolean
  expired: boolean
  statusCode?: number
  reason?: string
}

interface PushPayloadInput {
  title: string
  body: string
  url: string
  tag?: string
}

interface SendToSubscriptionsOptions {
  logPrefix: string
  logSends?: boolean
}

let vapidConfigured = false

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || `mailto:support@swiftdu.org`

  if (!publicKey || !privateKey) {
    return null
  }

  return { publicKey, privateKey, subject }
}

function configureVapid() {
  if (vapidConfigured) {
    return true
  }

  const config = getVapidConfig()

  if (!config) {
    return false
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  vapidConfigured = true
  return true
}

function normalizeUrl(url: string) {
  if (url.startsWith('http')) {
    return url
  }

  return `${getSiteUrl()}${url.startsWith('/') ? url : `/${url}`}`
}

function isTaskerAudience(audience: PushAudience) {
  return 'roles' in audience && audience.roles.includes('tasker')
}

function isUserIdAudience(audience: PushAudience) {
  return 'userIds' in audience
}

function getWebPushStatusCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  return (error as WebPushErrorLike).statusCode
}

function getWebPushErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    return (error as WebPushErrorLike).message
  }

  return undefined
}

function getWebPushErrorDetails(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { message: 'Unknown Web Push error' }
  }

  const candidate = error as WebPushErrorLike

  return {
    message:
      error instanceof Error
        ? error.message
        : candidate.message || 'Web Push send failed.',
    statusCode: candidate.statusCode,
    body: candidate.body,
    endpoint: candidate.endpoint,
    headers: candidate.headers,
  }
}

function getEndpointHost(endpoint: string) {
  try {
    return new URL(endpoint).host
  } catch {
    return endpoint
  }
}

function createPushPayload(input: PushPayloadInput) {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    url: normalizeUrl(input.url),
    tag: input.tag,
  })
}

async function getApprovedTaskerUserIds() {
  const taskers = await Tasker.find({
    isVerified: true,
    isRejected: { $ne: true },
  })
    .select('userId')
    .lean<Array<{ userId: { toString(): string } }>>()

  return taskers.map((tasker) => tasker.userId.toString())
}

async function getSubscriptionsForAudience(audience: PushAudience) {
  let userIds: string[] = []

  if (isTaskerAudience(audience)) {
    userIds = await getApprovedTaskerUserIds()
  } else if (isUserIdAudience(audience)) {
    userIds = audience.userIds
  }

  if (userIds.length === 0) {
    return []
  }

  return PushSubscription.find({
    userId: { $in: userIds },
    ...(isTaskerAudience(audience) ? { role: 'tasker' } : {}),
  })
    .select('userId endpoint expirationTime keys')
    .lean<StoredPushSubscription[]>()
}

async function removeExpiredSubscription(endpoint: string) {
  await PushSubscription.deleteOne({ endpoint })
}

async function sendOneWebPush(
  subscription: StoredPushSubscription,
  payload: string,
  options?: SendToSubscriptionsOptions
): Promise<SendOneWebPushResult> {
  const webPushSubscription: WebPushSubscription = toWebPushSubscription(subscription)
  const endpointHost = getEndpointHost(subscription.endpoint)

  try {
    if (options?.logSends) {
      console.info(`${options.logPrefix} sending`, {
        userId: subscription.userId,
        endpointHost,
      })
    }

    const result: SendResult = await webpush.sendNotification(
      webPushSubscription,
      payload
    )

    console.info(`${options?.logPrefix || '[SwiftDU Push]'} push sent successfully`, {
      userId: subscription.userId,
      endpointHost,
      statusCode: result.statusCode,
    })

    return {
      delivered: true,
      expired: false,
      statusCode: result.statusCode,
    }
  } catch (error) {
    const statusCode = getWebPushStatusCode(error)
    const errorDetails = getWebPushErrorDetails(error)

    if (statusCode === 404 || statusCode === 410) {
      await removeExpiredSubscription(subscription.endpoint)
      console.warn(`${options?.logPrefix || '[SwiftDU Push]'} expired subscription removed`, {
        userId: subscription.userId,
        endpointHost,
        statusCode,
        responseBody: errorDetails.body,
      })

      return {
        delivered: false,
        expired: true,
        statusCode,
        reason: `Subscription expired with status ${statusCode}.`,
      }
    }

    console.error(`${options?.logPrefix || '[SwiftDU Push]'} send failed`, {
      userId: subscription.userId,
      endpointHost,
      error: errorDetails,
    })

    return {
      delivered: false,
      expired: false,
      statusCode,
      reason: getWebPushErrorMessage(error) || 'Web Push send failed.',
    }
  }
}

async function sendPushPayloadToSubscriptions(
  subscriptions: StoredPushSubscription[],
  payloadInput: PushPayloadInput,
  options: SendToSubscriptionsOptions
): Promise<SendPushNotificationResult> {
  console.info(`${options.logPrefix} subscriptions fetched`, {
    count: subscriptions.length,
  })

  if (subscriptions.length === 0) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'No matching push subscriptions found.',
    }
  }

  const payload = createPushPayload(payloadInput)

  const results = await Promise.all(
    subscriptions.map((subscription) =>
      sendOneWebPush(subscription, payload, options)
    )
  )

  const deliveredCount = results.filter((result) => result.delivered).length
  const expiredCount = results.filter((result) => result.expired).length
  const failureReasons = Array.from(
    new Set(
      results
        .filter((result) => !result.expired)
        .map((result) => result.reason)
        .filter((reason): reason is string => Boolean(reason))
    )
  )

  return {
    recipientCount: subscriptions.length,
    deliveredCount,
    expiredCount,
    skipped: false,
    reason: failureReasons.length ? failureReasons.join(' ') : undefined,
  }
}

async function preparePushSend(): Promise<SendPushNotificationResult | null> {
  if (!configureVapid()) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'VAPID keys are not configured.',
    }
  }

  await connectDB()
  return null
}

export async function sendPushNotification(
  input: SendPushNotificationInput
): Promise<SendPushNotificationResult> {
  const skippedResult = await preparePushSend()

  if (skippedResult) {
    return skippedResult
  }

  const subscriptions = await getSubscriptionsForAudience(input.audience)

  return sendPushPayloadToSubscriptions(subscriptions, input, {
    logPrefix: '[SwiftDU Push]',
  })
}

export async function sendTestPushToUser(userId: string) {
  return sendPushNotification({
    audience: { userIds: [userId] },
    title: 'SwiftDU test notification',
    body: 'Your tasker push notifications are connected.',
    url: '/tasker-dashboard',
    tag: `push-test-${Date.now()}`,
  })
}

export async function sendTaskerTestPush() {
  const skippedResult = await preparePushSend()

  if (skippedResult) {
    return skippedResult
  }

  const subscriptions = await PushSubscription.find({ role: 'tasker' })
    .select('userId endpoint expirationTime keys')
    .lean<StoredPushSubscription[]>()

  return sendPushPayloadToSubscriptions(
    subscriptions,
    {
      title: 'Swift DU Test',
      body: 'This is a test push notification.',
      url: '/tasker-dashboard',
      tag: `swiftdu-test-${Date.now()}`,
    },
    {
      logPrefix: '[SwiftDU Push Test]',
      logSends: true,
    }
  )
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
