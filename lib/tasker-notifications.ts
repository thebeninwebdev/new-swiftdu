import NewTaskEmail from '@/emails/newTaskEmail'
import { getResendApiKey } from '@/lib/email'
import { sendBrevoEmailWithReactComponent } from '@/lib/brevo'
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
    shopping: 'shopping',
    water: 'water delivery',
    others: 'errand',
  }

  return labels[taskType] || taskType
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

const premiumTaskers = await Tasker.find({
  isVerified: true,
  isPremium: true,
  isRejected: { $ne: true },
})
  .select('userId isPremium')
  .lean()

console.log(
  '[Tasker Notifications] Found premium taskers:',
  premiumTaskers.length
)

if (premiumTaskers.length === 0) {
  return {
    recipientCount: 0,
    deliveredCount: 0,
    skipped: true,
    reason: 'No verified premium taskers found.',
  }
}

  // Get users for email notifications
  let emailRecipients: any[] = [];
  if (hasEmailConfig) {
    const users = await User.find({
      _id: { $in: premiumTaskers.map((tasker) => tasker.userId) },
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
  const notificationPromises: Promise<any>[] = []

  // Email notifications - using Brevo for tasker emails
  if (hasEmailConfig && emailRecipients.length > 0) {
    const emailPromises = emailRecipients.map((recipient) =>
      sendBrevoEmailWithReactComponent({
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
        tags: ['new_task', 'premium_tasker'],
      })
    )
    notificationPromises.push(...emailPromises)
  }

  // Telegram channel notification
  if (hasTelegramConfig) {
    console.log('[Tasker Notifications] Sending Telegram message to channel');
    notificationPromises.push(sendTelegramMessage(telegramMessage))
  }

  const results = await Promise.allSettled(notificationPromises)

  const totalRecipients = (hasEmailConfig ? emailRecipients.length : 0) + (hasTelegramConfig ? 1 : 0)
  const deliveredCount = results.filter((result) => {
    if (result.status === 'fulfilled') {
      // Both Brevo and Telegram return truthy values on success
      return result.value === undefined || result.value === true
    }
    return false
  }).length

  console.log('[Tasker Notifications] Final result:', {
    totalRecipients,
    deliveredCount,
    emailRecipients: emailRecipients.length,
    telegramChannel: Boolean(hasTelegramConfig),
  });

  return {
    recipientCount: totalRecipients,
    deliveredCount,
    skipped: false,
  }
}
