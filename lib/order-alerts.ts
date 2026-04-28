import OrderAlertEmail from '@/emails/orderAlertEmail'
import { sendTransactionalEmail } from '@/lib/email'
import { getSupportEmailAddress } from '@/lib/email-config'
import { getSiteUrl } from '@/lib/site'
import { sendWhatsAppAdminAlert } from '@/lib/whatsapp'
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
  whatsapp: AlertChannelResult
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
    shopping: 'shopping',
    water: 'water delivery',
    others: 'errand',
  }

  return labels[taskType || ''] || taskType || 'errand'
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value?: string) {
  if (!value) {
    return 'Not available'
  }

  return new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

function mergeChannelResults(
  email: AlertChannelResult,
  whatsapp: AlertChannelResult
): NotifyAdminsOfOrderEventResult {
  const skipped = email.skipped && whatsapp.skipped
  const reason = skipped
    ? [email.reason, whatsapp.reason].filter((value): value is string => Boolean(value)).join(' ')
    : undefined

  return {
    recipientCount: email.recipientCount + whatsapp.recipientCount,
    deliveredCount: email.deliveredCount + whatsapp.deliveredCount,
    skipped,
    reason,
    email,
    whatsapp,
  }
}

function buildWhatsAppOrderAlertMessage({
  event,
  orderId,
  taskType,
  description,
  amount,
  totalAmount,
  location,
  customerName,
  customerEmail,
  actorLabel,
  taskerName,
  createdAt,
  cancelledAt,
  dashboardUrl,
}: {
  event: OrderAlertEvent
  orderId: string
  taskType?: string
  description?: string
  amount: number
  totalAmount: number
  location: string
  customerName?: string
  customerEmail?: string
  actorLabel?: string
  taskerName?: string
  createdAt?: string
  cancelledAt?: string
  dashboardUrl: string
}) {
  const lines = [
    event === 'cancelled' ? 'SwiftDU booking cancelled.' : 'New SwiftDU booking received.',
    `Order ID: ${orderId}`,
    `Task type: ${formatTaskType(taskType)}`,
    `Customer: ${customerName || 'Unknown customer'}${customerEmail ? ` (${customerEmail})` : ''}`,
    `Budget: ${formatCurrency(amount)}`,
    `Total collected: ${formatCurrency(totalAmount)}`,
    `Location: ${location}`,
    `Description: ${description?.trim() || 'No description provided.'}`,
    `Booked at: ${formatDate(createdAt)}`,
  ]

  if (taskerName) {
    lines.push(`Tasker: ${taskerName}`)
  }

  if (event === 'cancelled') {
    lines.push(`Cancelled at: ${formatDate(cancelledAt)}`)

    if (actorLabel) {
      lines.push(`Cancelled by: ${actorLabel}`)
    }
  }

  lines.push(`Dashboard: ${dashboardUrl}`)

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
      whatsapp: createSkippedChannelResult('Order identifiers are missing.'),
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

  const whatsappResult = await sendWhatsAppAdminAlert({
    dedupeKey: ['order-alert', input.event, orderId].join('|'),
    cooldownMs: 60 * 1000,
    message: buildWhatsAppOrderAlertMessage({
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
  })

  return mergeChannelResults(emailResult, whatsappResult)
}
