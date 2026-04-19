import NewTaskEmail from '@/emails/newTaskEmail'
import { sendTransactionalEmail } from '@/lib/email'
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
    others: 'errand',
  }

  return labels[taskType] || taskType
}

export async function notifyTaskersOfNewTask(
  input: NotifyTaskersOfNewTaskInput
): Promise<NotifyTaskersOfNewTaskResult> {
  if (
    !process.env.RESEND_API_KEY
  ) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'Email configuration is missing.',
    }
  }

  const taskers = await Tasker.find({
    isVerified: true,
    isRejected: { $ne: true },
  })
    .select('userId')
    .lean()

  if (taskers.length === 0) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'No verified taskers found.',
    }
  }

  const users = await User.find({
    _id: { $in: taskers.map((tasker) => tasker.userId) },
    role: 'tasker',
    emailVerified: true,
    isSuspended: { $ne: true },
  })
    .select('name email')
    .lean()

  const recipients = Array.from(
    new Map(
      users
        .filter((user) => Boolean(user.email))
        .map((user) => [user.email.toLowerCase(), user])
    ).values()
  )

  if (recipients.length === 0) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      skipped: true,
      reason: 'No deliverable tasker emails found.',
    }
  }

  const taskUrl = `${getAppBaseUrl()}/tasker-dashboard`
  const subject = `New ${formatTaskType(input.taskType)} task posted on SwiftDU`

  const results = await Promise.allSettled(
    recipients.map((recipient) =>
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
          { name: 'audience', value: 'tasker' },
        ],
      })
    )
  )

  return {
    recipientCount: recipients.length,
    deliveredCount: results.filter((result) => result.status === 'fulfilled').length,
    skipped: false,
  }
}
