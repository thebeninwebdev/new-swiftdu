import { NextResponse, type NextRequest } from 'next/server'

import { previewTelegramLink } from '@/lib/sammy/telegram-link'
import { requireTelegramLinkSession, telegramLinkWebError } from '@/lib/sammy/telegram-link-web'

export async function GET(request: NextRequest) {
  try {
    const session = await requireTelegramLinkSession(request)
    const token = request.nextUrl.searchParams.get('token') || ''
    const preview = await previewTelegramLink(token, session.user.id)
    if (!preview) {
      return NextResponse.json({
        error: 'This connection link has expired.',
        code: 'INVALID_OR_EXPIRED_LINK',
      }, { status: 410 })
    }
    return NextResponse.json(preview, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return telegramLinkWebError(error)
  }
}
