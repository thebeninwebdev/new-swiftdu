import OrderAlertEmail from '@/emails/orderAlertEmail'
import { sendBrevoEmailWithReactComponent } from '@/lib/brevo'
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

  const emailResult = process.env.BREVO_API_KEY?.trim()
    ? await (async () => {
        const recipients = await getOrderAlertRecipients()

        if (recipients.length === 0) {
          return createSkippedChannelResult('No admin alert recipients are configured.')
        }

        const results = await Promise.allSettled(
          recipients.map((recipient) =>
            sendBrevoEmailWithReactComponent({
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
              tags: ['order_alert', input.event, orderId],
            })
          )
        )

        return {
          recipientCount: recipients.length,
          deliveredCount: results.filter((result) => result.status === 'fulfilled').length,
          skipped: false,
        }
      })()
    : createSkippedChannelResult('Brevo email configuration is missing.')

 return {
  recipientCount: emailResult.recipientCount,
  deliveredCount: emailResult.deliveredCount,
  skipped: emailResult.skipped,
  reason: emailResult.reason,
  email: emailResult
}
}
