import { getOrderRestriction, type TaskerGenderRestriction } from '@/lib/delivery-policy'
import { getSiteUrl } from '@/lib/site'
import { getTelegramOrderChatIds, sendTelegramMessage } from '@/lib/telegram'
import { shouldSendOrderNotification } from '@/lib/test-orders'
import { User } from '@/models/user'

type OrderLike = {
  _id: { toString(): string } | string
  userId: { toString(): string } | string
  taskType?: string
  description?: string
  amount?: number
  totalAmount?: number
  taskerGenderRestriction?: TaskerGenderRestriction
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
  isTestOrder?: boolean | null
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

function formatTaskType(taskType?: string) {
  const labels: Record<string, string> = {
    restaurant: 'food delivery',
    printing: 'printing',
    copy_notes: 'copy notes',
    shopping: 'shopping',
    dry_cleaning: 'dry cleaning',
    indomie: 'buy indomie',
    water: 'bag of water',
    others: 'errand',
  }

  return labels[taskType || ''] || taskType || 'errand'
}

function escapeHtml(value?: string | null) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatCurrency(value: number) {
  return `NGN ${value.toLocaleString('en-NG')}`
}

function formatDateTime(value?: Date | string) {
  if (!value) {
    return 'Not provided'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not provided'
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
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

function createSkippedChannelResult(reason: string): AlertChannelResult {
  return {
    recipientCount: 0,
    deliveredCount: 0,
    skipped: true,
    reason,
  }
}

function buildTelegramOrderAlertMessage(input: {
  event: OrderAlertEvent
  taskType?: string
  description?: string
  amount: number
  totalAmount: number
  taskerGenderRestriction?: TaskerGenderRestriction
  location: string
  customerName?: string | null
  customerEmail?: string | null
  dashboardUrl: string
}) {
  const heading = input.event === 'cancelled' ? 'Booking cancelled' : 'New booking received'
  const description = input.description?.trim()
  const lines = [
    `<b>${escapeHtml(heading)}</b>`,
    `<b>Task:</b> ${escapeHtml(formatTaskType(input.taskType))}`,
    `<b>Location:</b> ${escapeHtml(input.location)}`,
    ...(description ? [`<b>Description:</b> ${escapeHtml(description)}`] : []),
    `<b>Amount:</b> ${formatCurrency(input.amount)}`,
    `<b>Total:</b> ${formatCurrency(input.totalAmount)}`,
    `<b>Customer:</b> ${escapeHtml(input.customerName || input.customerEmail || 'Unknown')}`,
    `<a href="${escapeHtml(input.dashboardUrl)}">View dashboard</a>`,
  ]

  return lines.join('\n')
}

function formatCopyNotesTelegramMessage(
  order: {
    orderId?: string
    description?: string
    totalAmount?: number
    amount?: number
    location?: string
    noteSize?: 'small' | 'big'
    numberOfPages?: number
    copyNotesType?: string
    copyNotesPages?: number
    deadline?: Date | string
    dueDate?: Date | string
    deadlineDate?: Date | string
  },
  customerName?: string | null,
  dashboardUrl?: string
) {
  const dueDate = order.dueDate || order.deadline || order.deadlineDate
  const lines = [
    '<b>New Copy Notes task</b>',
    '<b>Task type:</b> Copy Notes',
    `<b>Customer:</b> ${escapeHtml(customerName || 'Unknown')}`,
    `<b>Location:</b> ${escapeHtml(order.location || 'Location not provided')}`,
    `<b>Pages:</b> ${Number(order.numberOfPages || order.copyNotesPages || 0).toLocaleString('en-NG')}`,
    `<b>Note size:</b> ${escapeHtml(
      order.noteSize ||
        (order.copyNotesType === 'hardback' ? 'big' : order.copyNotesType) ||
        'Not provided'
    )}`,
    `<b>Due date:</b> ${escapeHtml(formatDateTime(dueDate))}`,
    `<b>Calculated amount:</b> ${formatCurrency(Number(order.totalAmount || order.amount || 0))}`,
  ]

  const description = order.description?.trim()
  if (description) {
    lines.push(`<b>Description:</b> ${escapeHtml(description)}`)
  }

  if (dashboardUrl) {
    lines.push(`<a href="${escapeHtml(dashboardUrl)}">View/accept task</a>`)
  }

  if (order.orderId) {
    lines.push(`<b>Order ID:</b> ${escapeHtml(order.orderId)}`)
  }

  return lines.join('\n')
}

async function sendTelegramOrderAlertDirect(input: {
  event: OrderAlertEvent
  orderId: string
  taskType?: string
  description?: string
  amount: number
  totalAmount: number
  taskerGenderRestriction?: TaskerGenderRestriction
  location: string
  customerName?: string | null
  customerEmail?: string | null
  dashboardUrl: string
  dueDate?: Date | string
  deadline?: Date | string
  deadlineDate?: Date | string
  noteSize?: 'small' | 'big'
  numberOfPages?: number
  copyNotesType?: string
  copyNotesPages?: number
}): Promise<AlertChannelResult> {
  const chatIds = getTelegramOrderChatIds(getOrderRestriction(input))
  if (!chatIds.length) {
    console.error('[Telegram Order Alert] Destination is unclassified or order chats are not configured.')
    return createSkippedChannelResult('Destination is unclassified or order chats are not configured.')
  }
  const message = input.taskType === 'copy_notes'
    ? formatCopyNotesTelegramMessage(input, input.customerName, input.dashboardUrl)
    : buildTelegramOrderAlertMessage(input)
  const results = await Promise.allSettled(chatIds.map(chatId => sendTelegramMessage(message, chatId)))
  const deliveredCount = results.filter(result => result.status === 'fulfilled' && result.value).length
  return {
    recipientCount: chatIds.length,
    deliveredCount,
    skipped: false,
    reason: deliveredCount === chatIds.length ? undefined : 'Telegram send failed.',
  }
}

async function sendTelegramOrderAlert(input: {
  event: OrderAlertEvent
  orderId: string
  taskType?: string
  description?: string
  amount: number
  totalAmount: number
  taskerGenderRestriction?: TaskerGenderRestriction
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

  // The legacy Sammy relay cannot guarantee destination-specific recipients.
  // Reuse the existing direct sender for all order alerts, including copy notes.
  return sendTelegramOrderAlertDirect(input)
}

export async function notifyAdminsOfOrderEvent(
  input: NotifyAdminsOfOrderEventInput
): Promise<NotifyAdminsOfOrderEventResult> {
  const orderId = serializeId(input.order._id)
  const userId = serializeId(input.order.userId)

  if (!shouldSendOrderNotification(input.order)) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'Test order notifications are disabled.',
      email: createSkippedChannelResult('Test order notifications are disabled.'),
      telegram: createSkippedChannelResult('Test order notifications are disabled.'),
    }
  }

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
  const actorLabel = getActorLabel(input.actorRole, input.actorName, input.actorEmail)
  const amount = Number(input.order.amount || 0)
  const totalAmount = Number(input.order.totalAmount || input.order.amount || 0)
  const location = input.order.location || 'Location not provided'
  const [telegramSettled] = await Promise.allSettled([
    sendTelegramOrderAlert({
      taskerGenderRestriction: getOrderRestriction(input.order),
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
    recipientCount: telegramResult.recipientCount,
    deliveredCount: telegramResult.deliveredCount,
    skipped: telegramResult.skipped,
    reason: telegramResult.reason,
    email: createSkippedChannelResult('Order emails are disabled.'),
    telegram: telegramResult,
  }
}
