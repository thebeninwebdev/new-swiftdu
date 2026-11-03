import { type NextRequest } from 'next/server'

import { readSammyBody, withSammy } from '@/lib/sammy/server'
import { getTelegramLinkStatus } from '@/lib/sammy/telegram-link'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ telegramUserId?: unknown }>(request)
    return getTelegramLinkStatus(body.telegramUserId)
  })
}
