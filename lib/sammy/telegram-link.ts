import mongoose, { Types } from 'mongoose'

import { connectDB } from '@/lib/db'
import { TelegramLinkChallenge } from '@/models/telegram-link-challenge'
import { User } from '@/models/user'
import { SammyApiError } from './server'
import type { TelegramIdentity } from './staff'
import {
  createTelegramLinkToken,
  hashTelegramLinkToken,
  isTelegramLinkEligible,
  isValidTelegramLinkToken,
} from './telegram-link-policy'

const CHALLENGE_LIFETIME_MS = 10 * 60 * 1000
const MAX_CHALLENGES_PER_WINDOW = 5

export type TelegramLinkStatus =
  | 'LINKED'
  | 'NOT_LINKED'
  | 'TELEGRAM_DISABLED'
  | 'ACCOUNT_SUSPENDED'
  | 'INSUFFICIENT_PRIVILEGES'

export type TelegramLinkSessionIdentity = { id?: string | null; email?: string | null }

function telegramLinkAccountLookup(identity: string | TelegramLinkSessionIdentity) {
  const sessionId = typeof identity === 'string' ? identity : identity.id
  const email = typeof identity === 'string' ? undefined : identity.email
  const lookup: Record<string, unknown>[] = []
  if (sessionId) {
    if (Types.ObjectId.isValid(sessionId)) lookup.push({ _id: new Types.ObjectId(sessionId) })
    // Legacy Better Auth records may retain the adapter id as `id`.
    lookup.push({ id: sessionId })
  }
  const normalizedEmail = email?.trim().toLowerCase()
  if (normalizedEmail) lookup.push({ email: normalizedEmail })
  return lookup
}

async function findTelegramLinkAccount(identity: string | TelegramLinkSessionIdentity) {
  const lookup = telegramLinkAccountLookup(identity)
  if (!lookup.length) return null
  return User.findOne({ $or: lookup })
    .select('_id name email role isExco isSuspended telegramUserId telegramEnabled telegramRevokedAt')
    .lean()
}
function cleanSnapshot(value: unknown, maxLength = 128) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text.slice(0, maxLength) : undefined
}

function validateTelegramIdentity(identity: TelegramIdentity, chatId: unknown) {
  const telegramUserId = String(identity.id || '').trim()
  const telegramChatId = String(chatId || '').trim()
  if (!/^\d+$/.test(telegramUserId) || !/^-?\d+$/.test(telegramChatId)) {
    throw new SammyApiError(400, 'INVALID_TELEGRAM_USER', 'A valid Telegram identity is required.')
  }
  return { telegramUserId, telegramChatId }
}

export async function getTelegramLinkStatus(telegramUserIdValue: unknown) {
  const telegramUserId = String(telegramUserIdValue || '').trim()
  if (!/^\d+$/.test(telegramUserId)) {
    throw new SammyApiError(400, 'INVALID_TELEGRAM_USER', 'A valid Telegram user ID is required.')
  }
  await connectDB()
  const account = await User.findOne({ telegramUserId })
    .select('role isExco isSuspended telegramEnabled telegramRevokedAt')
    .lean()
  if (!account) return { status: 'NOT_LINKED' as TelegramLinkStatus }
  if (account.isSuspended) return { status: 'ACCOUNT_SUSPENDED' as TelegramLinkStatus }
  if (account.role !== 'admin' && !account.isExco) {
    return { status: 'INSUFFICIENT_PRIVILEGES' as TelegramLinkStatus }
  }
  if (account.telegramEnabled !== true || account.telegramRevokedAt) {
    return { status: 'TELEGRAM_DISABLED' as TelegramLinkStatus }
  }
  return { status: 'LINKED' as TelegramLinkStatus }
}

export async function issueTelegramLinkChallenge(input: {
  telegram: TelegramIdentity
  telegramChatId: unknown
  botUsername?: unknown
}) {
  const { telegramUserId, telegramChatId } = validateTelegramIdentity(input.telegram, input.telegramChatId)
  const current = await getTelegramLinkStatus(telegramUserId)
  if (current.status !== 'NOT_LINKED') {
    throw new SammyApiError(409, current.status, 'This Telegram account cannot start a new connection.')
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - CHALLENGE_LIFETIME_MS)
  const recentCount = await TelegramLinkChallenge.countDocuments({
    telegramUserId,
    createdAt: { $gt: windowStart },
  })
  if (recentCount >= MAX_CHALLENGES_PER_WINDOW) {
    throw new SammyApiError(429, 'LINK_RATE_LIMITED', 'Please wait before requesting another connection link.')
  }

  await TelegramLinkChallenge.updateMany({
    telegramUserId,
    active: true,
  }, { $set: { invalidatedAt: now, active: false } })

  const token = createTelegramLinkToken()
  const botUsername = cleanSnapshot(input.botUsername, 32)
  await TelegramLinkChallenge.create({
    tokenHash: hashTelegramLinkToken(token),
    telegramUserId,
    telegramChatId,
    telegramUsername: cleanSnapshot(input.telegram.username),
    telegramFirstName: cleanSnapshot(input.telegram.firstName),
    telegramLastName: cleanSnapshot(input.telegram.lastName),
    ...(botUsername && /^[A-Za-z0-9_]{5,32}$/.test(botUsername) ? { botUsername } : {}),
    expiresAt: new Date(now.getTime() + CHALLENGE_LIFETIME_MS),
    active: true,
  })
  return { token, expiresAt: new Date(now.getTime() + CHALLENGE_LIFETIME_MS) }
}

export async function previewTelegramLink(token: string, identity: string | TelegramLinkSessionIdentity) {
  if (!isValidTelegramLinkToken(token)) return null
  await connectDB()
  const now = new Date()
  const [challenge, account] = await Promise.all([
    TelegramLinkChallenge.findOne({
      tokenHash: hashTelegramLinkToken(token),
      expiresAt: { $gt: now },
      consumedAt: { $exists: false },
      invalidatedAt: { $exists: false },
      active: true,
    }).lean(),
    findTelegramLinkAccount(identity),
  ])
  if (!challenge) {
    const consumed = await TelegramLinkChallenge.findOne({ tokenHash: hashTelegramLinkToken(token) }).lean()
    if (consumed?.consumedAt && !consumed.invalidatedAt && consumed.expiresAt > now && account && isTelegramLinkEligible(account) &&
      String(consumed.consumedByUserId || '') === String(account._id) && account.telegramUserId === consumed.telegramUserId && account.telegramEnabled === true) {
      return { alreadyConnected: true as const, returnUrl: consumed.botUsername ? 'https://t.me/' + encodeURIComponent(consumed.botUsername) : 'https://t.me' }
    }
    return null
  }
  if (!account || !isTelegramLinkEligible(account)) {
    throw new SammyApiError(403, account?.isSuspended ? 'ACCOUNT_SUSPENDED' : 'STAFF_NOT_ELIGIBLE', 'This account is not eligible for Telegram staff access.')
  }
  if (account.telegramUserId) {
    throw new SammyApiError(409, account.telegramEnabled ? 'ACCOUNT_ALREADY_LINKED' : 'TELEGRAM_DISABLED', 'This SwiftDU account cannot create a new Telegram connection.')
  }
  const telegramName = [challenge.telegramFirstName, challenge.telegramLastName].filter(Boolean).join(' ') || 'Telegram user'
  return {
    account: { name: account.name || 'SwiftDU staff', email: account.email },
    telegram: { name: telegramName, username: challenge.telegramUsername },
  }
}

export async function consumeTelegramLink(token: string, identity: string | TelegramLinkSessionIdentity) {
  if (!isValidTelegramLinkToken(token)) return null
  await connectDB()
  const dbSession = await mongoose.startSession()
  let result: { botUsername?: string } | null | undefined
  try {
    result = await dbSession.withTransaction(async (): Promise<{
      botUsername?: string
    } | null> => {
      const now = new Date()
      const challenge = await TelegramLinkChallenge.findOne({
        tokenHash: hashTelegramLinkToken(token),
        expiresAt: { $gt: now },
        consumedAt: { $exists: false },
        invalidatedAt: { $exists: false },
        active: true,
      }).session(dbSession)
      const lookup = telegramLinkAccountLookup(identity)
      const account = lookup.length ? await User.findOne({ $or: lookup })
        .select('_id role isExco isSuspended telegramUserId telegramEnabled telegramRevokedAt')
        .session(dbSession) : null
      if (!account || !isTelegramLinkEligible(account)) {
        throw new SammyApiError(403, account?.isSuspended ? 'ACCOUNT_SUSPENDED' : 'STAFF_NOT_ELIGIBLE', 'This account is not eligible for Telegram staff access.')
      }

      if (!challenge) {
        const consumed = await TelegramLinkChallenge.findOne({ tokenHash: hashTelegramLinkToken(token) }).session(dbSession)
        const safeRetry = consumed && consumed.consumedAt && !consumed.invalidatedAt && consumed.expiresAt > now &&
          String(consumed.consumedByUserId || '') === String(account._id) &&
          account.telegramUserId === consumed.telegramUserId && account.telegramEnabled === true && !account.telegramRevokedAt
        if (safeRetry) {
          console.info('[Telegram link]', { event: 'safe_repeated_confirmation', challengeId: String(consumed._id) })
          return { botUsername: consumed.botUsername }
        }
        console.info('[Telegram link]', { event: consumed?.consumedAt ? 'already_consumed_rejected' : consumed?.invalidatedAt ? 'invalidated_rejected' : 'expired_or_invalid_rejected', challengeId: consumed ? String(consumed._id) : undefined })
        return null
      }

      if (account.telegramUserId) {
        throw new SammyApiError(409, account.telegramEnabled ? 'ACCOUNT_ALREADY_LINKED' : 'TELEGRAM_DISABLED', 'This SwiftDU account cannot create a new Telegram connection.')
      }
      const duplicate = await User.exists({ telegramUserId: challenge.telegramUserId }).session(dbSession)
      if (duplicate) throw new SammyApiError(409, 'TELEGRAM_ALREADY_LINKED', 'This Telegram account is already connected.')

      const linked = await User.updateOne({
        _id: account._id,
        telegramUserId: { $exists: false },
        telegramRevokedAt: { $exists: false },
      }, { $set: {
        telegramUserId: challenge.telegramUserId,
        telegramUsername: challenge.telegramUsername,
        telegramFirstName: challenge.telegramFirstName,
        telegramLastName: challenge.telegramLastName,
        telegramEnabled: true,
        telegramLinkedAt: now,
      } }, { session: dbSession })
      if (linked.modifiedCount !== 1) {
        throw new SammyApiError(409, 'ACCOUNT_ALREADY_LINKED', 'This SwiftDU account is already connected.')
      }
      const consumed = await TelegramLinkChallenge.updateOne({
        _id: challenge._id,
        consumedAt: { $exists: false },
        invalidatedAt: { $exists: false },
        active: true,
        expiresAt: { $gt: now },
      }, { $set: {
        consumedAt: now,
        consumedByUserId: account._id,
        active: false,
      } }, { session: dbSession })
      if (consumed.modifiedCount !== 1) {
        throw new SammyApiError(409, 'LINK_ALREADY_USED', 'This connection link is no longer valid.')
      }
      console.info('[Telegram link]', { event: 'connection_completed', challengeId: String(challenge._id) })
      return { botUsername: challenge.botUsername }
    })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new SammyApiError(409, 'TELEGRAM_ALREADY_LINKED', 'This Telegram account is already connected.')
    }
    throw error
  } finally {
    await dbSession.endSession()
  }
  return result || null
}
