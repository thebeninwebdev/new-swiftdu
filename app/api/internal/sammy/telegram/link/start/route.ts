import { type NextRequest } from 'next/server'

import { readSammyBody, withSammy } from '@/lib/sammy/server'
import type { TelegramIdentity } from '@/lib/sammy/staff'
import { issueTelegramLinkChallenge } from '@/lib/sammy/telegram-link'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{
      telegram?: TelegramIdentity
      telegramChatId?: unknown
      botUsername?: unknown
    }>(request)
    const challenge = await issueTelegramLinkChallenge({
      telegram: body.telegram || { id: '' },
      telegramChatId: body.telegramChatId,
      botUsername: body.botUsername,
    })
    return { token: challenge.token, expiresAt: challenge.expiresAt.toISOString() }
  })
}
