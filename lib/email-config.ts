import { siteUrl } from '@/lib/site'

export const DEFAULT_SUPPORT_EMAIL = 'support@swiftdu.org'
export const DEFAULT_EMAIL_FROM_NAME = 'SwiftDU Support'

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function resolveEmailAddress(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const normalizedCandidate = candidate?.trim().toLowerCase()

    if (normalizedCandidate && EMAIL_ADDRESS_PATTERN.test(normalizedCandidate)) {
      return normalizedCandidate
    }
  }

  return DEFAULT_SUPPORT_EMAIL
}

export function getSupportEmailAddress() {
  return resolveEmailAddress(
    process.env.EMAIL_SUPPORT_ADDRESS,
    process.env.EMAIL_REPLY_TO,
    process.env.EMAIL_FROM_ADDRESS
  )
}

export function getEmailFromName() {
  return process.env.EMAIL_FROM_NAME?.trim() || DEFAULT_EMAIL_FROM_NAME
}

export function getEmailFromAddress() {
  return resolveEmailAddress(
    process.env.EMAIL_FROM_ADDRESS,
    process.env.EMAIL_SUPPORT_ADDRESS
  )
}

export function getEmailReplyTo() {
  return resolveEmailAddress(
    process.env.EMAIL_REPLY_TO,
    process.env.EMAIL_SUPPORT_ADDRESS,
    process.env.EMAIL_FROM_ADDRESS
  )
}

export function getEmailSupportMailto() {
  return `mailto:${getSupportEmailAddress()}`
}

export function getEmailSiteUrl() {
  return siteUrl
}
