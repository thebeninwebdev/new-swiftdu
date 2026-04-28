import { siteUrl } from '@/lib/site'

export const DEFAULT_SUPPORT_EMAIL = 'support@swiftdu.org'
export const DEFAULT_EMAIL_FROM_NAME = 'SwiftDU Support'

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BLOCKED_EMAIL_ADDRESSES = new Set(['hello@mreseosa.com'])
const BLOCKED_EMAIL_DOMAINS = new Set(['mreseosa.com', 'mrseosa.com'])

function isBlockedEmail(email: string | null | undefined) {
  if (!email) {
    return false
  }

  const normalized = email.trim().toLowerCase()
  const domain = normalized.split('@')[1]

  return (
    BLOCKED_EMAIL_ADDRESSES.has(normalized) ||
    (domain ? BLOCKED_EMAIL_DOMAINS.has(domain) : false)
  )
}

function resolveEmailAddress(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const normalizedCandidate = candidate?.trim().toLowerCase()

    if (
      normalizedCandidate &&
      EMAIL_ADDRESS_PATTERN.test(normalizedCandidate) &&
      !isBlockedEmail(normalizedCandidate)
    ) {
      return normalizedCandidate
    }
  }

  return DEFAULT_SUPPORT_EMAIL
}

export function getSupportEmailAddress() {
  return resolveEmailAddress(
    process.env.EMAIL_SUPPORT_ADDRESS,
    process.env.EMAIL_SUPPORT?.trim(),
    process.env.EMAIL_REPLY_TO,
    process.env.EMAIL_FROM_ADDRESS,
    process.env.EMAIL_FROM?.trim()
  )
}

export function getEmailFromName() {
  return process.env.EMAIL_FROM_NAME?.trim() || DEFAULT_EMAIL_FROM_NAME
}

export function getEmailFromAddress() {
  return resolveEmailAddress(
    process.env.EMAIL_FROM_ADDRESS,
    process.env.EMAIL_FROM?.trim(),
    process.env.EMAIL_SUPPORT_ADDRESS,
    process.env.EMAIL_SUPPORT?.trim()
  )
}

export function getEmailReplyTo() {
  return resolveEmailAddress(
    process.env.EMAIL_REPLY_TO,
    process.env.EMAIL_REPLY?.trim(),
    process.env.EMAIL_SUPPORT_ADDRESS,
    process.env.EMAIL_SUPPORT?.trim(),
    process.env.EMAIL_FROM_ADDRESS,
    process.env.EMAIL_FROM?.trim()
  )
}

export function getEmailSupportMailto() {
  return `mailto:${getSupportEmailAddress()}`
}

export function getEmailSiteUrl() {
  return siteUrl
}
