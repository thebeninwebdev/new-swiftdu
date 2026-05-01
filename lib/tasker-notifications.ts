import NewTaskEmail from '@/emails/newTaskEmail'
import { getResendApiKey, sendTransactionalEmail } from '@/lib/email'
import { sendTelegramMessage } from '@/lib/telegram'
import Tasker from '@/models/tasker'
import { User } from '@/models/user'

interface NotifyTaskersOfNewTaskInput {
  taskType: string
  description: string
  amount: number
  location: string
  userName: string
}

interface NotifyTaskersOfNewTaskResult {
  recipientCount: number
  deliveredCount: number
  skipped: boolean
  reason?: string
}

interface TaskerNotificationTarget {
  userId: unknown
  isPremium?: boolean
  location?: string
}

interface EmailRecipient {
  name?: string
  email: string
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://swiftdu.vercel.app'
  ).replace(/\/$/, '')
}

function formatTaskType(taskType: string) {
  const labels: Record<string, string> = {
    restaurant: 'food delivery',
    printing: 'printing',
    copy_notes: 'copy notes',
    shopping: 'shopping',
    water: 'bag of water',
    others: 'errand',
  }

  return labels[taskType] || taskType
}

function normalizeLocation(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

function isGirlsHostelLocation(value: string) {
  const normalized = normalizeLocation(value)
  return normalized.includes('girlshostel') || normalized.includes('girlshotel')
}

export async function notifyTaskersOfNewTask(
  input: NotifyTaskersOfNewTaskInput
): Promise<NotifyTaskersOfNewTaskResult> {
  // Check if either email or Telegram channel is configured
  const hasEmailConfig = Boolean(getResendApiKey());
  const hasTelegramConfig = Boolean(
    process.env.TELEGRAM_BOT_TOKEN &&
    (process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID)
  );
  const girlsHostelOnly = isGirlsHostelLocation(input.location)

  console.log('[Tasker Notifications] Config check:', { hasEmailConfig, hasTelegramConfig });

  // Test bot connection if Telegram channel is configured
  if (hasTelegramConfig) {
    const { testBotConnection } = await import('@/lib/telegram');
    const botWorking = await testBotConnection();
    console.log('[Tasker Notifications] Bot connection test:', botWorking);
  }

  if (!hasEmailConfig && !hasTelegramConfig) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'No notification configuration found (email or Telegram channel).',
    }
  }

  const taskerFilter = girlsHostelOnly
    ? {
        isVerified: true,
        isRejected: { $ne: true },
        location: { $regex: 'girls?\\s*hos?tel', $options: 'i' },
      }
    : {
        isVerified: true,
        isPremium: true,
        isRejected: { $ne: true },
      }

  const targetTaskers = await Tasker.find(taskerFilter)
    .select('userId isPremium location')
    .lean<TaskerNotificationTarget[]>()

  console.log('[Tasker Notifications] Found target taskers:', {
    count: targetTaskers.length,
    girlsHostelOnly,
  })

  if (targetTaskers.length === 0 && !hasTelegramConfig) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: girlsHostelOnly
        ? 'No verified Girls Hostel taskers found.'
        : 'No verified premium taskers found.',
    }
  }

  // Get users for email notifications
  let emailRecipients: EmailRecipient[] = [];
  if (hasEmailConfig) {
    const users = await User.find({
      _id: { $in: targetTaskers.map((tasker) => tasker.userId) },
      role: 'tasker',
      emailVerified: true,
      isSuspended: { $ne: true },
    })
      .select('name email')
      .lean()

    emailRecipients = Array.from(
      new Map(
        users
          .filter((user) => Boolean(user.email))
          .map((user) => [user.email.toLowerCase(), user])
      ).values()
    )
  }

  const shouldSendTelegram = hasTelegramConfig
  const taskUrl = `${getAppBaseUrl()}/tasker-dashboard`
  const subject = `New ${formatTaskType(input.taskType)} task posted on SwiftDU`

  const telegramMessage = `<b>New ${formatTaskType(input.taskType)} task posted on SwiftDU</b>

📋 <b>Task:</b> ${formatTaskType(input.taskType)}
📝 <b>Description:</b> ${input.description}
💰 <b>Amount:</b> ₦${input.amount.toLocaleString()}
📍 <b>Location:</b> ${input.location}
👤 <b>Customer:</b> ${input.userName}

🔗 <a href="${taskUrl}">View Task Details</a>`

  // Prepare notification promises
  const notificationPromises: Array<Promise<unknown>> = []

  // Email notifications
  if (hasEmailConfig && emailRecipients.length > 0) {
    const emailPromises = emailRecipients.map((recipient) =>
      sendTransactionalEmail({
        to: recipient.email,
        subject,
        react: NewTaskEmail({
          taskerName: recipient.name || 'Tasker',
          taskType: input.taskType,
          description: input.description,
          amount: input.amount,
          location: input.location,
          userName: input.userName,
          taskUrl,
        }),
        tags: [
          { name: 'email_type', value: 'new_task' },
          { name: 'audience', value: girlsHostelOnly ? 'girls_hostel_tasker' : 'premium_tasker' },
        ],
      })
    )
    notificationPromises.push(...emailPromises)
  }

  // Telegram channel notification
  if (shouldSendTelegram) {
    console.log('[Tasker Notifications] Sending Telegram message to channel');
    notificationPromises.push(sendTelegramMessage(telegramMessage))
  }

  const results = await Promise.allSettled(notificationPromises)

  const totalRecipients = (hasEmailConfig ? emailRecipients.length : 0) + (shouldSendTelegram ? 1 : 0)
  const deliveredCount = results.filter((result) => {
    if (result.status === 'fulfilled') {
      // For email, result.value is undefined on success
      // For Telegram, result.value is boolean
      return result.value === undefined || result.value === true
    }
    return false
  }).length

  console.log('[Tasker Notifications] Final result:', {
    totalRecipients,
    deliveredCount,
    emailRecipients: emailRecipients.length,
    telegramChannel: Boolean(shouldSendTelegram),
    girlsHostelOnly,
  });

  return {
    recipientCount: totalRecipients,
    deliveredCount,
    skipped: false,
  }
}
