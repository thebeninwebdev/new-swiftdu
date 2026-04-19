import { siteUrl } from '@/lib/site'

export const DEFAULT_SUPPORT_EMAIL = 'support@swiftdu.org'
export const DEFAULT_EMAIL_FROM_NAME = 'SwiftDU Support'

export function getSupportEmailAddress() {
  return (
    process.env.EMAIL_SUPPORT_ADDRESS?.trim().toLowerCase() || DEFAULT_SUPPORT_EMAIL
  )
}

export function getEmailFromName() {
  return process.env.EMAIL_FROM_NAME?.trim() || DEFAULT_EMAIL_FROM_NAME
}

export function getEmailFromAddress() {
  return getSupportEmailAddress()
}

export function getEmailReplyTo() {
  return getSupportEmailAddress()
}

export function getEmailSupportMailto() {
  return `mailto:${getSupportEmailAddress()}`
}

export function getEmailSiteUrl() {
  return siteUrl
}
