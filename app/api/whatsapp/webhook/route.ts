import { waitUntil } from '@vercel/functions'
import { NextRequest, NextResponse } from 'next/server'

import { connectDB } from '@/lib/db'
import { processWhatsAppConversation } from '@/lib/whatsapp/flow'
import { acquireWhatsAppMessageLease, completeWhatsAppMessage, failWhatsAppMessage } from '@/lib/whatsapp/message-lease'
import { markWhatsAppMessageRead } from '@/lib/whatsapp/send-message'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/signature'
import { parseWhatsAppMessages } from '@/lib/whatsapp/webhook-parser'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim()
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Webhook verification failed.' }, { status: 403 })
}
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() || ''
  if (!verifyMetaWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const messages = parseWhatsAppMessages(payload)
  if (!messages.length) return NextResponse.json({ ok: true })

  await connectDB()
  const acquired = []
  for (const message of messages) {
    const lease = await acquireWhatsAppMessageLease(message)
    if (lease.acquired) acquired.push(message)
  }

  if (acquired.length) {
    const messagesByPhone = new Map<string, typeof acquired>()
    for (const message of acquired) {
      messagesByPhone.set(message.phone, [...(messagesByPhone.get(message.phone) || []), message])
    }
    // Meta may batch several taps/texts from one customer. Preserve their order
    // while still processing independent customers concurrently.
    waitUntil(Promise.all([...messagesByPhone.values()].map(async (phoneMessages) => {
      for (const message of phoneMessages) {
        try {
          await markWhatsAppMessageRead(message.messageId)
          await processWhatsAppConversation(message)
          await completeWhatsAppMessage(message.messageId)
        } catch (error) {
          console.error('[WhatsApp webhook processing]', {
            messageId: message.messageId,
            error: error instanceof Error ? error.name : 'UnknownError',
          })
          await failWhatsAppMessage(message.messageId, error)
        }
      }
    })).then(() => undefined))
  }

  return NextResponse.json({ ok: true })
}
