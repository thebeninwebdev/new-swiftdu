import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'

import { connectDB } from '@/lib/db'
import { getEmailFromAddress, getEmailFromName } from '@/lib/email-config'
import { SammyPortalOtp } from '@/models/sammy-portal-otp'
import { TelegramLinkChallenge } from '@/models/telegram-link-challenge'
import { User } from '@/models/user'
import { WhatsAppRegistration } from '@/models/whatsapp-registration'
import { SammyApiError } from './server'
import { consumeTelegramLink } from './telegram-link'
import { hashTelegramLinkToken, isTelegramLinkEligible, isValidTelegramLinkToken } from './telegram-link-policy'

export type PortalPurpose = 'telegram' | 'whatsapp'

const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_SENDS_PER_TOKEN = 3
const MAX_CHALLENGES_PER_ACCOUNT_HOUR = 5
const MAX_CODE_ATTEMPTS = 5
const MAX_EMAIL_LENGTH = 254
const WA_TOKEN = /^[A-Za-z0-9_-]{32}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function requireConfig() {
  const secret = process.env.SAMMY_LINK_OTP_SECRET?.trim()
  const key = process.env.RESEND_API_KEY?.trim()
  if (!secret || secret.length < 32 || !key) {
    throw new SammyApiError(503, 'PORTAL_NOT_CONFIGURED', 'Account verification is temporarily unavailable.')
  }
  return { secret, key }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function hashCode(secret: string, tokenHash: string, userId: string, code: string) {
  return createHmac('sha256', secret).update(
    `sammy-portal-v1:${tokenHash}:${userId}:${code}`
  ).digest('hex')
}

function normalizeEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) {
    throw new SammyApiError(400, 'INVALID_EMAIL', 'Enter a valid SwiftDU account email address.')
  }
  return email
}

export function validatePortalToken(purpose: PortalPurpose, token: string) {
  const valid = purpose === 'telegram' ? isValidTelegramLinkToken(token) : WA_TOKEN.test(token)
  if (!valid) {
    throw new SammyApiError(410, 'LINK_EXPIRED', 'This connection link is invalid or has expired.')
  }
  return hash(token)
}

async function getChallenge(purpose: PortalPurpose, token: string) {
  await connectDB()
  const now = new Date()
  const tokenHash = validatePortalToken(purpose, token)
  if (purpose === 'telegram') {
    const challenge = await TelegramLinkChallenge.findOne({
      tokenHash: hashTelegramLinkToken(token),
      expiresAt: { $gt: now },
      consumedAt: { $exists: false },
      invalidatedAt: { $exists: false },
      active: true,
    }).lean()
    if (!challenge) {
      throw new SammyApiError(410, 'LINK_EXPIRED', 'This connection link is invalid or has expired.')
    }
    return { tokenHash, challenge }
  }
  const registration = await WhatsAppRegistration.findOne({
    token,
    status: 'pending',
  }).lean()
  if (!registration) {
    throw new SammyApiError(410, 'LINK_EXPIRED', 'This registration link is no longer valid.')
  }
  // Legacy WhatsApp tokens have no database TTL. The bot rotates pending
  // tokens every 24 hours, using their actual issue timestamp rather than
  // updatedAt (which can be changed by unrelated profile updates).
  const timestamp = registration.tokenIssuedAt || registration.createdAt
  const issuedAt = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (issuedAt.getTime() + 24 * 60 * 60 * 1000 <= now.getTime()) {
    throw new SammyApiError(410, 'LINK_EXPIRED', 'Request a fresh connection link in WhatsApp.')
  }
  return { tokenHash, registration }
}

export async function checkPortalChallenge(purpose: PortalPurpose, token: string) {
  await getChallenge(purpose, token)
}

export async function sendPortalCode(purpose: PortalPurpose, token: string, rawEmail: unknown) {
  const { key, secret } = requireConfig()
  const email = normalizeEmail(rawEmail)
  const { tokenHash } = await getChallenge(purpose, token)
  const account = await User.findOne({
    email, emailVerified: true, isSuspended: { $ne: true },
  }).select('_id name email role isExco excoRole telegramUserId telegramRevokedAt isSuspended twoFactorEnabled').lean()

  // Account existence and eligibility are deliberately not disclosed.
  if (!account || account.twoFactorEnabled === true || (purpose === 'telegram' &&
      (!isTelegramLinkEligible(account) || Boolean(account.telegramUserId)))) {
    return { sent: true }
  }

  const now = new Date()
  const previous = await SammyPortalOtp.findOne({ tokenHash }).lean()
  if (previous && (
    previous.sentCount >= MAX_SENDS_PER_TOKEN ||
    new Date(previous.lastSentAt).getTime() + RESEND_COOLDOWN_MS > now.getTime()
  )) {
    throw new SammyApiError(429, 'RATE_LIMITED', 'Please wait before requesting another code.')
  }

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const recent = await SammyPortalOtp.countDocuments({
    userId: account._id, createdAt: { $gte: oneHourAgo },
  })
  if (!previous && recent >= MAX_CHALLENGES_PER_ACCOUNT_HOUR) {
    throw new SammyApiError(429, 'RATE_LIMITED', 'Too many verification attempts. Try again later.')
  }

  const code = String(randomInt(0, 100_000_000)).padStart(8, '0')
  const codeHash = hashCode(secret, tokenHash, String(account._id), code)
  // Enforce cooldown and maximum sends AT WRITE TIME. Checking these using
  // only a preliminary read would allow parallel submissions to bypass limits.
  // The unique tokenHash index rejects any racing upsert.
  try {
    await SammyPortalOtp.findOneAndUpdate(
      {
        tokenHash,
        $or: [
          { sentCount: { $exists: false } },
          {
            sentCount: { $lt: MAX_SENDS_PER_TOKEN },
            lastSentAt: { $lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
          },
        ],
      },
      {
        $set: {
          purpose, userId: account._id, codeHash,
          expiresAt: new Date(now.getTime() + CODE_TTL_MS),
          attempts: 0, lastSentAt: now,
        },
        $inc: { sentCount: 1 },
        // A prior consumed code may be reissued after downstream linking
        // fails; a freshly sent code must be usable.
        $unset: { consumedAt: '' },
      },
      // Avoid setDefaultsOnInsert clashing with $inc on sentCount.
      { upsert: true, setDefaultsOnInsert: false },
    )
  } catch (error) {
    if (typeof error === 'object' && error !== null &&
        'code' in error && error.code === 11000) {
      throw new SammyApiError(429, 'RATE_LIMITED', 'Please wait before requesting another code.')
    }
    throw error
  }

  const resend = new Resend(key)
  const title = purpose === 'telegram' ? 'Telegram staff connection' : 'WhatsApp account connection'
  const result = await resend.emails.send({
    from: `${getEmailFromName()} <${getEmailFromAddress()}>`,
    to: account.email,
    subject: `SwiftDU ${title} code`,
    html: `<p>Use this one-time code to confirm your SwiftDU ${title.toLowerCase()}:</p><p style="font-size:28px;font-weight:bold;letter-spacing:3px">${code}</p><p>The code expires in 10 minutes. If you did not request this, ignore this message.</p>`,
  })
  if (result.error) {
    console.error('[Sammy Portal] email delivery failed', { purpose, status: 'provider_error' })
    throw new SammyApiError(503, 'EMAIL_UNAVAILABLE', 'We could not send the verification email. Try again later.')
  }
  return { sent: true }
}

export async function confirmPortalCode(purpose: PortalPurpose, token: string, rawCode: unknown) {
  const { secret } = requireConfig()
  const code = typeof rawCode === 'string' ? rawCode.trim() : ''
  if (!/^\d{8}$/.test(code)) {
    throw new SammyApiError(400, 'INVALID_CODE', 'Enter the 8-digit verification code.')
  }
  const { tokenHash } = await getChallenge(purpose, token)
  const now = new Date()
  // Every attempt consumes one of the five allowed guesses, including incorrect codes.
  const record = await SammyPortalOtp.findOneAndUpdate({
    tokenHash, purpose, consumedAt: { $exists: false },
    expiresAt: { $gt: now }, attempts: { $lt: MAX_CODE_ATTEMPTS },
  }, { $inc: { attempts: 1 } }, { new: true })
  if (!record) {
    throw new SammyApiError(410, 'CODE_EXPIRED', 'Your code expired or has been used. Request another code.')
  }
  const supplied = hashCode(secret, tokenHash, String(record.userId), code)
  const left = Buffer.from(record.codeHash, 'hex')
  const right = Buffer.from(supplied, 'hex')
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new SammyApiError(400, 'INVALID_CODE', 'That code is incorrect.')
  }
  const consumed = await SammyPortalOtp.updateOne({
    _id: record._id, consumedAt: { $exists: false },
  }, { $set: { consumedAt: now } })
  if (consumed.modifiedCount !== 1) {
    throw new SammyApiError(410, 'CODE_ALREADY_USED', 'That code has already been used.')
  }

  const account = await User.findOne({
    _id: record.userId, emailVerified: true, isSuspended: { $ne: true },
  }).select('_id email role isExco excoRole telegramUserId telegramRevokedAt isSuspended twoFactorEnabled').lean()
  if (!account || account.twoFactorEnabled === true) {
    // Email OTP alone must not bypass an existing multi-factor requirement.
    // Such accounts need an administrator-authorized recovery procedure.
    throw new SammyApiError(403, 'ACCOUNT_NOT_ELIGIBLE', 'This account cannot be connected by email verification. Contact a SwiftDU administrator.')
  }

  if (purpose === 'telegram') {
    if (!isTelegramLinkEligible(account) || account.telegramUserId) {
      throw new SammyApiError(403, 'STAFF_NOT_ELIGIBLE', 'This account cannot be connected.')
    }
    const linked = await consumeTelegramLink(token, {
      id: String(account._id),
      email: account.email,
    })
    if (!linked) throw new SammyApiError(410, 'LINK_EXPIRED', 'This connection link has expired.')
    return { connected: true, returnUrl: linked.botUsername
      ? 'https://t.me/' + encodeURIComponent(linked.botUsername)
      : 'https://t.me' }
  }

  const registration = await WhatsAppRegistration.findOne({ token, status: 'pending' }).lean()
  if (!registration) throw new SammyApiError(410, 'LINK_EXPIRED', 'This registration link is no longer valid.')
  const alreadyLinked = await WhatsAppRegistration.exists({
    userId: String(account._id),
    phone: { $ne: registration.phone },
    status: 'linked',
  })
  if (alreadyLinked) {
    throw new SammyApiError(409, 'ACCOUNT_ALREADY_LINKED', 'This account is linked to another WhatsApp number. Contact SwiftDU support.')
  }
  const linked = await WhatsAppRegistration.updateOne({
    token, status: 'pending',
  }, {
    $set: {
      status: 'linked', userId: String(account._id), linkedAt: now,
      whatsappNotificationsEnabled: false,
    },
  })
  if (linked.modifiedCount !== 1) {
    throw new SammyApiError(409, 'LINK_ALREADY_USED', 'This registration link is no longer valid.')
  }
  return { connected: true, returnUrl: null }
}
