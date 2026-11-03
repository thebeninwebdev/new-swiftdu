import { createHash, randomBytes } from 'node:crypto'

export function createTelegramLinkToken() {
  return randomBytes(32).toString('base64url')
}
export function hashTelegramLinkToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
export function isValidTelegramLinkToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}
export function isTelegramLinkEligible(account: {
  role?: string | null
  isExco?: boolean
  isSuspended?: boolean
  telegramRevokedAt?: Date | null
}) {
  return account.isSuspended !== true && !account.telegramRevokedAt &&
    (account.role === 'admin' || account.isExco === true)
}
