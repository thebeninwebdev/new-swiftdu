import { getOrderRestriction, type TaskerGenderRestriction } from '@/lib/delivery-policy'
import { DEFAULT_SITE_URL, getSiteUrl } from '@/lib/site'
import { getTelegramOrderChatIds, getTelegramTrainingOrdersChatId, sendTelegramMessage } from '@/lib/telegram'
import { shouldSendOrderNotification } from '@/lib/test-orders'
import { User } from '@/models/user'

type OrderLike = {
  _id: { toString(): string } | string
  userId: { toString(): string } | string
  taskType?: string
  description?: string
  amount?: number
  totalAmount?: number
  taskerFee?: number
  taskerGenderRestriction?: TaskerGenderRestriction
  location?: string
  store?: string
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

function getTaskIcon(taskType?: string) {
  const icons: Record<string, string> = {
    restaurant: '🍽️', printing: '🖨️', copy_notes: '📝', shopping: '🛍️',
    dry_cleaning: '🧺', indomie: '🍜', water: '💧', others: '📦',
  }
  return icons[taskType || ''] || '📦'
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

function formatNaira(value: number) {
  return `₦${Number(value || 0).toLocaleString('en-NG')}`
}

function formatOptionalDate(value?: Date | string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', hour12: true }).format(date)
}

function getPublicAcceptOrderUrl(orderId: string) {
  const configuredSiteUrl = getSiteUrl()

  try {
    const siteUrl = new URL(configuredSiteUrl)
    const isLocalUrl = ['localhost', '127.0.0.1', '0.0.0.0'].includes(siteUrl.hostname)
    if (siteUrl.protocol === 'https:' && !isLocalUrl) {
      return new URL(`/tasker-dashboard/accept-order/${encodeURIComponent(orderId)}`, siteUrl).toString()
    }
  } catch {
    // Fall through to the canonical public URL.
  }

  return new URL(`/tasker-dashboard/accept-order/${encodeURIComponent(orderId)}`, DEFAULT_SITE_URL).toString()
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

type TelegramOrderAlertInput = {
  event: OrderAlertEvent
  orderId: string
  taskType?: string
  description?: string
  amount: number
  totalAmount: number
  taskerFee?: number
  taskerGenderRestriction?: TaskerGenderRestriction
  location: string
  customerName?: string | null
  customerEmail?: string | null
  dashboardUrl: string
  directOrderUrl: string
  store?: string
  dueDate?: Date | string
  deadline?: Date | string
  deadlineDate?: Date | string
  noteSize?: 'small' | 'big'
  numberOfPages?: number
  copyNotesType?: string
  copyNotesPages?: number
  isTestOrder?: boolean
}

function buildTrainingTelegramOrderAlertMessage(input: TelegramOrderAlertInput) {
  const description = input.description?.trim()
  const store = input.store?.trim()
  const taskLabel = formatTaskType(input.taskType)
  const orderReference = `T-${input.orderId.slice(-6).toUpperCase()}`
  const dueDate = formatOptionalDate(input.dueDate || input.deadline || input.deadlineDate)
  const copyNotesDetails = input.taskType === 'copy_notes'
    ? [
        '',
        `📝 <b>Copy Notes</b>`,
        `Pages: ${Number(input.numberOfPages || input.copyNotesPages || 0).toLocaleString('en-NG')}`,
        ...(input.noteSize || input.copyNotesType
          ? [`Note size: ${escapeHtml(input.noteSize || (input.copyNotesType === 'hardback' ? 'big' : input.copyNotesType) || '')}`]
          : []),
        ...(dueDate ? [`Due: ${escapeHtml(dueDate)}`] : []),
      ]
    : []
  const lines = [
    input.event === 'cancelled'
      ? '🧪 <b>SWIFTDU TRAINING ORDER CANCELLED</b>'
      : '🧪 <b>SWIFTDU TRAINING ORDER</b>',
    '',
    `${getTaskIcon(input.taskType)} <b>${escapeHtml(taskLabel.replace(/\b\w/g, character => character.toUpperCase()))}</b>`,
    `<code>#${escapeHtml(orderReference)}</code>`,
    '',
    `📍 <b>${escapeHtml(input.location)}</b>`,
    '',
    `🧾 ${description ? escapeHtml(description) : escapeHtml(taskLabel)}`,
    ...(store ? [escapeHtml(store)] : []),
    ...copyNotesDetails,
    '',
    `👤 ${escapeHtml(input.customerName || input.customerEmail || 'Customer')}`,
    '',
    `💰 <b>Order Value:</b> ${formatNaira(input.totalAmount)}`,
    `🪙 <b>Your Earnings:</b> ${formatNaira(input.taskerFee || 0)}`,
  ]

  return lines.join('\n')
}

function buildLiveTelegramOrderAlertMessage(input: TelegramOrderAlertInput) {
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

async function sendTelegramOrderAlertDirect(input: {
  event: OrderAlertEvent
  orderId: string
  taskType?: string
  description?: string
  amount: number
  totalAmount: number
  taskerFee?: number
  taskerGenderRestriction?: TaskerGenderRestriction
  location: string
  customerName?: string | null
  customerEmail?: string | null
  dashboardUrl: string
  directOrderUrl: string
  store?: string
  dueDate?: Date | string
  deadline?: Date | string
  deadlineDate?: Date | string
  noteSize?: 'small' | 'big'
  numberOfPages?: number
  copyNotesType?: string
  copyNotesPages?: number
  isTestOrder?: boolean
}): Promise<AlertChannelResult> {
  const chatIds = input.isTestOrder
    ? [getTelegramTrainingOrdersChatId()].filter((chatId): chatId is string => Boolean(chatId))
    : getTelegramOrderChatIds(getOrderRestriction(input))
  if (!chatIds.length) {
    const reason = input.isTestOrder
      ? 'TELEGRAM_TRAINING_ORDERS_CHAT_ID is not configured.'
      : 'Destination is unclassified or order chats are not configured.'
    console.error(`[Telegram Order Alert] ${reason}`)
    return createSkippedChannelResult(reason)
  }
  const message = input.isTestOrder
    ? buildTrainingTelegramOrderAlertMessage(input)
    : buildLiveTelegramOrderAlertMessage(input)
  const telegramOptions = input.isTestOrder && input.event !== 'cancelled'
    ? { replyMarkup: { inline_keyboard: [[{ text: '⚡ Accept Order', url: input.directOrderUrl }]] } }
    : undefined
  const results = await Promise.allSettled(chatIds.map(chatId => sendTelegramMessage(message, chatId, telegramOptions)))
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
  taskerFee?: number
  taskerGenderRestriction?: TaskerGenderRestriction
  location: string
  customerName?: string | null
  customerEmail?: string | null
  actorLabel: string
  dashboardUrl: string
  directOrderUrl: string
  store?: string
  dueDate?: Date | string
  deadline?: Date | string
  deadlineDate?: Date | string
  noteSize?: 'small' | 'big'
  numberOfPages?: number
  drawingPages?: number
  copyNotesType?: string
  copyNotesPages?: number
  isTestOrder?: boolean
}) {
  // Training notifications use their isolated channel and must not be coupled to
  // the production-order alert switch. This keeps training operational while
  // production Telegram alerts are intentionally paused.
  if (!input.isTestOrder && process.env.TELEGRAM_ALERTS_ENABLED === 'false') {
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

  if (!shouldSendOrderNotification(input.order) && input.order.isTestOrder !== true) {
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
  const directOrderUrl = getPublicAcceptOrderUrl(orderId)
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
      taskerFee: input.order.taskerFee,
      location,
      dueDate: input.order.dueDate,
      deadline: input.order.deadline,
      deadlineDate: input.order.deadlineDate,
      noteSize: input.order.noteSize,
      numberOfPages: input.order.numberOfPages,
      drawingPages: input.order.drawingPages,
      copyNotesType: input.order.copyNotesType,
      copyNotesPages: input.order.copyNotesPages,
      isTestOrder: input.order.isTestOrder === true,
      customerName: customer?.name,
      customerEmail: customer?.email,
      actorLabel,
      dashboardUrl,
      directOrderUrl,
      store: input.order.store,
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
