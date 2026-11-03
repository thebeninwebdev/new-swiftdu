import { NextResponse, type NextRequest } from 'next/server'

import { auth } from '@/lib/auth'
import { getTrustedOrigins } from '@/lib/site'
import { SammyApiError } from './server'

const confirmationAttempts = new Map<string, { count: number; resetAt: number }>()

export async function requireTelegramLinkSession(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    throw new SammyApiError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to SwiftDU to continue.')
  }
  return session
}

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin || !getTrustedOrigins().includes(origin)) {
    throw new SammyApiError(403, 'INVALID_ORIGIN', 'The confirmation request was rejected.')
  }
}

export function rateLimitTelegramConfirmation(key: string) {
  const now = Date.now()
  const current = confirmationAttempts.get(key)
  if (!current || current.resetAt <= now) {
    confirmationAttempts.set(key, { count: 1, resetAt: now + 60_000 })
    return
  }
  current.count += 1
  if (current.count > 10) {
    throw new SammyApiError(429, 'CONFIRM_RATE_LIMITED', 'Please wait before trying again.')
  }
}

export function telegramLinkWebError(error: unknown) {
  if (error instanceof SammyApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error('[Telegram linking]', error)
  return NextResponse.json({ error: 'The connection could not be completed.', code: 'INTERNAL_ERROR' }, { status: 500 })
}
