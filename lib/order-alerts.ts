import OrderAlertEmail from '@/emails/orderAlertEmail'
import { sendTransactionalEmail } from '@/lib/email'
import { getSupportEmailAddress } from '@/lib/email-config'
import { getSiteUrl } from '@/lib/site'
import { sendTelegramMessage } from '@/lib/telegram'
import { User } from '@/models/user'

type OrderLike = {
  _id: { toString(): string } | string
  userId: { toString(): string } | string
  taskType?: string
  description?: string
  amount?: number
  totalAmount?: number
  location?: string
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

function escapeTelegramHtml(value?: string | null) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildTelegramOrderAlertMessage(input: {
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
}) {
  const heading =
    input.event === 'cancelled' ? 'Booking cancelled' : 'New booking received'
  const lines = [
    `<b>${escapeTelegramHtml(heading)}</b>`,
    `<b>Task:</b> ${escapeTelegramHtml(formatTaskType(input.taskType))}`,
    `<b>Location:</b> ${escapeTelegramHtml(input.location)}`,
    `<b>Amount:</b> NGN ${input.amount.toLocaleString()}`,
    `<b>Total:</b> NGN ${input.totalAmount.toLocaleString()}`,
    `<b>Customer:</b> ${escapeTelegramHtml(
      input.customerName || input.customerEmail || 'Unknown'
    )}`,
    `<b>Actor:</b> ${escapeTelegramHtml(input.actorLabel)}`,
    `<b>Order:</b> ${escapeTelegramHtml(input.orderId)}`,
    `<a href="${escapeTelegramHtml(input.dashboardUrl)}">Open admin dashboard</a>`,
  ]

  const description = input.description?.trim()

  if (description) {
    lines.splice(3, 0, `<b>Description:</b> ${escapeTelegramHtml(description)}`)
  }

  return lines.join('\n')
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
  const dashboardUrl = `${getSiteUrl()}/admin/orders`
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

  const telegramResult =
    process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.TELEGRAM_BOT_API_TOKEN?.trim()
      ? await (async () => {
          const delivered = await sendTelegramMessage(
            buildTelegramOrderAlertMessage({
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
              dashboardUrl,
            })
          )

          return {
            recipientCount: 1,
            deliveredCount: delivered ? 1 : 0,
            skipped: false,
            reason: delivered ? undefined : 'Telegram send failed.',
          }
        })()
      : createSkippedChannelResult('Telegram configuration is missing.')

  const emailResult = process.env.RESEND_API_KEY?.trim()
    ? await (async () => {
        const recipients = await getOrderAlertRecipients()

        if (recipients.length === 0) {
          return createSkippedChannelResult('No admin alert recipients are configured.')
        }

        const results = await Promise.allSettled(
          recipients.map((recipient) =>
            sendTransactionalEmail({
              to: recipient,
              subject,
              react: OrderAlertEmail({
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
              tags: [
                { name: 'email_type', value: 'order_alert' },
                { name: 'order_event', value: input.event },
                { name: 'order_id', value: orderId },
              ],
              headers: {
                'X-SwiftDU-Order-Id': orderId,
                'X-SwiftDU-Order-Event': input.event,
              },
            })
          )
        )

        return {
          recipientCount: recipients.length,
          deliveredCount: results.filter((result) => result.status === 'fulfilled').length,
          skipped: false,
        }
      })()
    : createSkippedChannelResult('Email configuration is missing.')

  return {
    recipientCount: emailResult.recipientCount + telegramResult.recipientCount,
    deliveredCount: emailResult.deliveredCount + telegramResult.deliveredCount,
    skipped: emailResult.skipped && telegramResult.skipped,
    reason: emailResult.reason || telegramResult.reason,
    email: emailResult,
    telegram: telegramResult,
  }
}
