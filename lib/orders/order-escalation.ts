import { Order } from '@/models/order'
import { getSiteUrl } from '@/lib/site'
import { sendPushNotification } from '@/lib/push-notifications'
import { sendTelegramMessage } from '@/lib/telegram'
import { connectDB } from '@/lib/db'

export const REMINDER_DELAY_MS = 2 * 60 * 1000 // 2 minutes
export const ADMIN_ESCALATION_DELAY_MS = 3 * 60 * 1000 // 3 minutes

export interface EscalationRunResult {
  ordersChecked: number
  remindersSent: number
  adminAlertsSent: number
  errors: Array<{ orderId: string; step: 'reminder' | 'admin_alert'; error: string }>
}

function getTelegramAdminChatId(): string | undefined {
  return (
    process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() ||
    process.env.TELEGRAM_CHANNEL_ID?.trim() ||
    process.env.TELEGRAM_CHAT_ID?.trim() ||
    undefined
  )
}

function buildAdminEscalationMessage(orderId: string, location: string): string {
  return [
    '⚠️ <b>SwiftDU — Unaccepted Order</b>',
    '',
    'An order has remained unaccepted for 3 minutes.',
    '',
    `<b>Order:</b> #${orderId}`,
    `<b>Location:</b> ${location}`,
    '<b>Status:</b> Awaiting Tasker',
    '',
    'Please review and arrange dispatch.',
  ].join('\n')
}

/**
 * Scan for unaccepted actionable orders and perform timely escalations:
 * 1. At 2 minutes: Reminder push to opted-in eligible taskers.
 * 2. At 3 minutes: Admin alert via Telegram.
 *
 * Fully idempotent using atomic MongoDB updates so concurrent workers cannot duplicate alerts.
 */
export async function processDueOrderEscalations(now = new Date()): Promise<EscalationRunResult> {
  await connectDB()

  const result: EscalationRunResult = {
    ordersChecked: 0,
    remindersSent: 0,
    adminAlertsSent: 0,
    errors: [],
  }

  // Find candidate orders that are pending, unaccepted, not waiting for batch release, and have at least 2 minutes elapsed
  const twoMinutesAgo = new Date(now.getTime() - REMINDER_DELAY_MS)

  const candidateOrders = await Order.find({
    status: 'pending',
    taskerId: { $in: [null, ''] },
    batchingStatus: { $ne: 'waiting' },
    $or: [
      { taskerSearchStartedAt: { $lte: twoMinutesAgo } },
      { taskerSearchStartedAt: { $exists: false }, createdAt: { $lte: twoMinutesAgo } },
    ],
    // Only fetch orders where at least one escalation step is still pending
    $and: [
      {
        $or: [
          { escalationReminderSentAt: { $exists: false } },
          { escalationAdminAlertSentAt: { $exists: false } },
        ],
      },
    ],
  }).lean()

  result.ordersChecked = candidateOrders.length

  for (const candidate of candidateOrders) {
    const orderId = String(candidate._id)
    const searchStarted = candidate.taskerSearchStartedAt
      ? new Date(candidate.taskerSearchStartedAt).getTime()
      : new Date(candidate.createdAt).getTime()
    const elapsedMs = now.getTime() - searchStarted

    // ─── Step 1: Reminder Push (>= 2 minutes) ───
    if (elapsedMs >= REMINDER_DELAY_MS && !candidate.escalationReminderSentAt) {
      // Atomic claim
      const claimedForReminder = await Order.findOneAndUpdate(
        {
          _id: candidate._id,
          status: 'pending',
          taskerId: { $in: [null, ''] },
          batchingStatus: { $ne: 'waiting' },
          escalationReminderSentAt: { $exists: false },
        },
        {
          $set: { escalationReminderSentAt: now },
        },
        { new: true }
      )

      if (claimedForReminder) {
        try {
          const isTest = claimedForReminder.isTestOrder === true
          const pushResult = await sendPushNotification({
            audience: {
              roles: ['tasker'],
              taskerGenderRestriction: claimedForReminder.taskerGenderRestriction || null,
              taskerMode: isTest ? 'training' : 'live',
            },
            title: isTest
              ? '[Training] Reminder: Task Still Available'
              : 'Reminder: Task Still Available',
            body: `A delivery task in ${claimedForReminder.location} is still waiting for a tasker - NGN ${Number(
              claimedForReminder.totalAmount || 0
            ).toLocaleString()}`,
            url: `/tasker-dashboard/${orderId}?preview=true`,
            tag: `order-reminder-${orderId}`,
            orderId,
            urgency: 'high',
            category: 'escalation_reminder',
          })

          result.remindersSent += 1
          console.info('[Order Escalation Reminder]', {
            orderId,
            elapsedSeconds: Math.round(elapsedMs / 1000),
            recipientCount: pushResult.recipientCount,
            deliveredCount: pushResult.deliveredCount,
          })
        } catch (error) {
          console.error('[Order Escalation Reminder Failed]', { orderId, error })
          result.errors.push({
            orderId,
            step: 'reminder',
            error: error instanceof Error ? error.message : 'Push delivery error',
          })
        }
      }
    }

    // ─── Step 2: Admin Telegram Alert (>= 3 minutes) ───
    if (elapsedMs >= ADMIN_ESCALATION_DELAY_MS && !candidate.escalationAdminAlertSentAt) {
      // Atomic claim
      const claimedForAdmin = await Order.findOneAndUpdate(
        {
          _id: candidate._id,
          status: 'pending',
          taskerId: { $in: [null, ''] },
          batchingStatus: { $ne: 'waiting' },
          escalationAdminAlertSentAt: { $exists: false },
        },
        {
          $set: { escalationAdminAlertSentAt: now },
        },
        { new: true }
      )

      if (claimedForAdmin) {
        try {
          const dashboardUrl = `${getSiteUrl()}/admin/orders?search=${orderId}`
          const message = buildAdminEscalationMessage(orderId, claimedForAdmin.location)
          const adminChatId = getTelegramAdminChatId()

          if (adminChatId) {
            const sent = await sendTelegramMessage(message, adminChatId, {
              replyMarkup: {
                inline_keyboard: [
                  [
                    {
                      text: 'View in Admin Dashboard',
                      url: dashboardUrl,
                    },
                  ],
                ],
              },
            })

            if (sent) {
              result.adminAlertsSent += 1
              console.info('[Order Escalation Admin Alert]', {
                orderId,
                elapsedSeconds: Math.round(elapsedMs / 1000),
                adminChatId,
              })
            } else {
              console.warn('[Order Escalation Admin Alert Delivery Warning]', {
                orderId,
                adminChatId,
              })
            }
          } else {
            console.warn('[Order Escalation Admin Alert Skipped]', {
              orderId,
              reason: 'No admin Telegram chat ID configured.',
            })
          }
        } catch (error) {
          console.error('[Order Escalation Admin Alert Failed]', { orderId, error })
          result.errors.push({
            orderId,
            step: 'admin_alert',
            error: error instanceof Error ? error.message : 'Telegram send error',
          })
        }
      }
    }
  }

  return result
}
