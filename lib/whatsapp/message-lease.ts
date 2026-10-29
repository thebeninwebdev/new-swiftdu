import 'server-only'

import { WhatsAppProcessedMessage } from '@/models/whatsapp-processed-message'

const DEFAULT_LEASE_MS = 2 * 60 * 1000

export async function acquireWhatsAppMessageLease({
  messageId,
  phone,
  now = new Date(),
  leaseMs = DEFAULT_LEASE_MS,
}: {
  messageId: string
  phone: string
  now?: Date
  leaseMs?: number
}) {
  try {
    const lease = await WhatsAppProcessedMessage.findOneAndUpdate(
      {
        messageId,
        $or: [
          { status: 'failed' },
          { status: 'processing', leaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: { phone, status: 'processing', leaseExpiresAt: new Date(now.getTime() + leaseMs) },
        $inc: { attempts: 1 },
        $unset: { lastErrorCode: '', processedAt: '' },
      },
      { new: true }
    ).lean()
    if (lease) return { acquired: true as const, lease }

    const created = await WhatsAppProcessedMessage.create({
      messageId,
      phone,
      status: 'processing',
      attempts: 1,
      leaseExpiresAt: new Date(now.getTime() + leaseMs),
    })
    return { acquired: true as const, lease: created.toObject() }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const existing = await WhatsAppProcessedMessage.findOne({ messageId }).lean()
      return { acquired: false as const, lease: existing }
    }
    throw error
  }
}
export async function completeWhatsAppMessage(messageId: string) {
  await WhatsAppProcessedMessage.updateOne(
    { messageId, status: 'processing' },
    { $set: { status: 'completed', processedAt: new Date() }, $unset: { leaseExpiresAt: '', lastErrorCode: '' } }
  )
}

export async function failWhatsAppMessage(messageId: string, error: unknown) {
  const code = error instanceof Error ? error.name.slice(0, 80) : 'UNKNOWN'
  await WhatsAppProcessedMessage.updateOne(
    { messageId, status: 'processing' },
    { $set: { status: 'failed', lastErrorCode: code }, $unset: { leaseExpiresAt: '' } }
  )
}
