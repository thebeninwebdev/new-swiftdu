import { NextResponse, type NextRequest } from 'next/server'

import { consumeTelegramLink } from '@/lib/sammy/telegram-link'
import {
  rateLimitTelegramConfirmation,
  requireSameOrigin,
  requireTelegramLinkSession,
  telegramLinkWebError,
} from '@/lib/sammy/telegram-link-web'

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const session = await requireTelegramLinkSession(request)
    rateLimitTelegramConfirmation(session.user.id)
    const body = await request.json().catch(() => ({})) as { token?: unknown }
    const token = typeof body.token === 'string' ? body.token : ''
    const result = await consumeTelegramLink(token, { id: session.user.id, email: session.user.email })
    if (!result) {
      return NextResponse.json({
        error: 'This connection link has expired.',
        code: 'INVALID_OR_EXPIRED_LINK',
      }, { status: 410 })
    }
    const returnUrl = result.botUsername
      ? 'https://t.me/' + encodeURIComponent(result.botUsername)
      : 'https://t.me'
    return NextResponse.json({ connected: true, returnUrl }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return telegramLinkWebError(error)
  }
}
