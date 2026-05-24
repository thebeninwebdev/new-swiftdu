import OrderAlertEmail from '@/emails/orderAlertEmail'
import { sendTransactionalEmail } from '@/lib/email'
import { getSupportEmailAddress } from '@/lib/email-config'
import { getSiteUrl } from '@/lib/site'
import { User } from '@/models/user'

type OrderLike = {
  _id: { toString(): string } | string
  userId: { toString(): string } | string
  taskType?: string
  description?: string
  amount?: number
  totalAmount?: number
  location?: string
  noteSize?: 'small' | 'big'
  numberOfPages?: number
  drawingPages?: number
  copyNotesType?: string
  copyNotesPages?: number
  deadline?: Date | string
  dueDate?: Date | string
  deadlineDate?: Date | string
  taskerName?: string
  createdAt?: Date | string
  cancelledAt?: Date | string
}

type OrderAlertEvent = 'created' | 'cancelled'
type OrderAlertActorRole = 'customer' | 'tasker' | 'admin' | 'system'

interface NotifyAdminsOfOrderEventInput {
  event: OrderAlertEvent
  order: OrderLike
  actorName?: string | null
  actorEmail?: string | null
  actorRole?: OrderAlertActorRole
}

interface NotifyAdminsOfOrderEventResult {
  recipientCount: number
  deliveredCount: number
  skipped: boolean
  reason?: string
  email: AlertChannelResult
  telegram: AlertChannelResult
}

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface AlertChannelResult {
  recipientCount: number
  deliveredCount: number
  skipped: boolean
  reason?: string
  providerIds?: string[]
  failures?: string[]
}

function serializeId(value?: { toString(): string } | string | null) {
  if (!value) {
    return ''
  }

  return typeof value === 'string' ? value : value.toString()
}

function serializeDate(value?: Date | string) {
  if (!value) {
    return undefined
  }

  return value instanceof Date ? value.toISOString() : value
}

function parseConfiguredRecipients(value?: string | null) {
  if (!value) {
    return []
  }

  return value
    .split(/[;,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => EMAIL_ADDRESS_PATTERN.test(entry))
}

function formatTaskType(taskType?: string) {
  const labels: Record<string, string> = {
    restaurant: 'food delivery',
    printing: 'printing',
    copy_notes: 'copy notes',
    shopping: 'shopping',
    water: 'bag of water',
    others: 'errand',
  }

  return labels[taskType || ''] || taskType || 'errand'
}

function getActorLabel(
  actorRole: OrderAlertActorRole | undefined,
  actorName?: string | null,
  actorEmail?: string | null
) {
  const identity = actorName?.trim() || actorEmail?.trim() || 'Unknown'

  switch (actorRole) {
    case 'tasker':
      return `${identity} (tasker)`
    case 'admin':
      return `${identity} (admin)`
    case 'system':
      return `${identity} (system)`
    case 'customer':
    default:
      return `${identity} (customer)`
  }
}

async function getOrderAlertRecipients() {
  const configuredRecipients = [
    ...parseConfiguredRecipients(process.env.ORDER_ALERT_EMAILS),
    ...parseConfiguredRecipients(process.env.ADMIN_ALERT_EMAILS),
  ]

  const adminUsers = await User.find({
    role: 'admin',
    isSuspended: { $ne: true },
  })
    .select('email')
    .lean()

  const supportEmail = getSupportEmailAddress()

  return Array.from(
    new Set(
      [...configuredRecipients, ...adminUsers.map((user) => user.email), supportEmail]
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value && EMAIL_ADDRESS_PATTERN.test(value)))
    )
  )
}

function createSkippedChannelResult(reason: string): AlertChannelResult {
  return {
    recipientCount: 0,
    deliveredCount: 0,
    skipped: true,
    reason,
  }
}

async function sendTelegramOrderAlert(input: {
  event: OrderAlertEvent
  orderId: string
  taskType?: string
  description?: string
  amount: number
  totalAmount: number
  location: string
  customerName?: string | null
  customerEmail?: string | null
  actorLabel: string
  dashboardUrl: string
  dueDate?: Date | string
  deadline?: Date | string
  deadlineDate?: Date | string
  noteSize?: 'small' | 'big'
  numberOfPages?: number
  drawingPages?: number
  copyNotesType?: string
  copyNotesPages?: number
}) {
  if (process.env.TELEGRAM_ALERTS_ENABLED === 'false') {
    return createSkippedChannelResult('Telegram alerts are disabled.')
  }

  const sammyBaseUrl =
    process.env.SAMMY_NOTIFICATIONS_URL?.trim() ||
    process.env.SAMMY_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_SAMMY_URL?.trim()

  if (!sammyBaseUrl) {
    return createSkippedChannelResult('Sammy notification URL is missing.')
  }

  try {
    const url = new URL('/notifications/telegram/order-alert', sammyBaseUrl)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const internalSecret = process.env.SAMMY_INTERNAL_SECRET?.trim()

    if (internalSecret) {
      headers.Authorization = `Bearer ${internalSecret}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    })

    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: AlertChannelResult; error?: string }
      | null
    const delivered = response.ok && Boolean(data?.ok)

    if (data?.result) {
      return data.result
    }

    return {
      recipientCount: 1,
      deliveredCount: delivered ? 1 : 0,
      skipped: false,
      reason: delivered
        ? undefined
        : data?.error || `Sammy Telegram notification failed with ${response.status}.`,
    }
  } catch (error) {
    return {
      recipientCount: 1,
      deliveredCount: 0,
      skipped: false,
      reason: 'Telegram send failed.',
      failures: [error instanceof Error ? error.message : 'Unknown Telegram error'],
    }
  }
}

async function sendEmailOrderAlerts(input: {
  recipients: string[]
  subject: string
  event: OrderAlertEvent
  orderId: string
  taskType?: string
  description?: string
  amount: number
  totalAmount: number
  location: string
  customerName?: string | null
  customerEmail?: string | null
  actorLabel: string
  taskerName?: string
  createdAt?: string
  cancelledAt?: string
  dashboardUrl: string
}) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return createSkippedChannelResult('Email configuration is missing.')
  }

  if (input.recipients.length === 0) {
    return createSkippedChannelResult('No admin alert recipients are configured.')
  }

  const results = await Promise.allSettled(
    input.recipients.map(async (recipient) => {
      const providerId = await sendTransactionalEmail({
        to: recipient,
        subject: input.subject,
        react: OrderAlertEmail({
          event: input.event,
          orderId: input.orderId,
          taskType: input.taskType,
          description: input.description,
          amount: input.amount,
          totalAmount: input.totalAmount,
          location: input.location,
          customerName: input.customerName ?? undefined,
          customerEmail: input.customerEmail ?? undefined,
          actorLabel: input.actorLabel,
          taskerName: input.taskerName,
          createdAt: input.createdAt,
          cancelledAt: input.cancelledAt,
          dashboardUrl: input.dashboardUrl,
        }),
        tags: [
          { name: 'email_type', value: 'order_alert' },
          { name: 'order_event', value: input.event },
          { name: 'order_id', value: input.orderId },
        ],
        headers: {
          'X-SwiftDU-Order-Id': input.orderId,
          'X-SwiftDU-Order-Event': input.event,
        },
      })

      return { recipient, providerId }
    })
  )

  const delivered = results.filter((result) => result.status === 'fulfilled')
  const failures = results
    .map((result, index) => {
      if (result.status === 'fulfilled') {
        return null
      }

      const reason =
        result.reason instanceof Error ? result.reason.message : String(result.reason)

      return `${input.recipients[index]}: ${reason}`
    })
    .filter((failure): failure is string => Boolean(failure))

  return {
    recipientCount: input.recipients.length,
    deliveredCount: delivered.length,
    skipped: false,
    reason: failures.length ? 'Some email sends failed.' : undefined,
    providerIds: delivered
      .map((result) => result.value.providerId)
      .filter((providerId): providerId is string => Boolean(providerId)),
    failures: failures.length ? failures : undefined,
  }
}

export async function notifyAdminsOfOrderEvent(
  input: NotifyAdminsOfOrderEventInput
): Promise<NotifyAdminsOfOrderEventResult> {
  const orderId = serializeId(input.order._id)
  const userId = serializeId(input.order.userId)

  if (!orderId || !userId) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'Order identifiers are missing.',
      email: createSkippedChannelResult('Order identifiers are missing.'),
      telegram: createSkippedChannelResult('Order identifiers are missing.'),
    }
  }

  const customer = await User.findById(userId).select('name email').lean()
  const dashboardUrl = `${getSiteUrl()}/tasker-dashboard`
  const subjectPrefix =
    input.event === 'cancelled' ? 'Booking cancelled' : 'New booking received'
  const subject = `${subjectPrefix}: ${formatTaskType(input.order.taskType)} in ${
    input.order.location || 'SwiftDU'
  }`
  const actorLabel = getActorLabel(input.actorRole, input.actorName, input.actorEmail)
  const amount = Number(input.order.amount || 0)
  const totalAmount = Number(input.order.totalAmount || input.order.amount || 0)
  const location = input.order.location || 'Location not provided'
  const createdAt = serializeDate(input.order.createdAt)
  const cancelledAt = serializeDate(input.order.cancelledAt)
  const recipients = await getOrderAlertRecipients()

  const [emailSettled, telegramSettled] = await Promise.allSettled([
    sendEmailOrderAlerts({
      recipients,
      subject,
      event: input.event,
      orderId,
      taskType: input.order.taskType,
      description: input.order.description,
      amount,
      totalAmount,
      location,
      customerName: customer?.name,
      customerEmail: customer?.email,
      actorLabel,
      taskerName: input.order.taskerName,
      createdAt,
      cancelledAt,
      dashboardUrl,
    }),
    sendTelegramOrderAlert({
      event: input.event,
      orderId,
      taskType: input.order.taskType,
      description: input.order.description,
      amount,
      totalAmount,
      location,
      dueDate: input.order.dueDate,
      deadline: input.order.deadline,
      deadlineDate: input.order.deadlineDate,
      noteSize: input.order.noteSize,
      numberOfPages: input.order.numberOfPages,
      drawingPages: input.order.drawingPages,
      copyNotesType: input.order.copyNotesType,
      copyNotesPages: input.order.copyNotesPages,
      customerName: customer?.name,
      customerEmail: customer?.email,
      actorLabel,
      dashboardUrl,
    }),
  ])

  const emailResult =
    emailSettled.status === 'fulfilled'
      ? emailSettled.value
      : {
          recipientCount: recipients.length,
          deliveredCount: 0,
          skipped: false,
          reason: 'Email send failed.',
          failures: [
            emailSettled.reason instanceof Error
              ? emailSettled.reason.message
              : String(emailSettled.reason),
          ],
        }

  const telegramResult =
    telegramSettled.status === 'fulfilled'
      ? telegramSettled.value
      : {
          recipientCount: 1,
          deliveredCount: 0,
          skipped: false,
          reason: 'Telegram send failed.',
          failures: [
            telegramSettled.reason instanceof Error
              ? telegramSettled.reason.message
              : String(telegramSettled.reason),
          ],
        }

  return {
    recipientCount: emailResult.recipientCount + telegramResult.recipientCount,
    deliveredCount: emailResult.deliveredCount + telegramResult.deliveredCount,
    skipped: emailResult.skipped && telegramResult.skipped,
    reason:
      emailResult.reason && telegramResult.reason
        ? `${emailResult.reason} ${telegramResult.reason}`
        : emailResult.reason || telegramResult.reason,
    email: emailResult,
    telegram: telegramResult,
  }
}
