import { createHash, randomBytes } from 'node:crypto'
import { normalizeExcoRole } from '@/lib/exco-constants'

export type TelegramStaffEligibilityAccount = {
  role?: string | null
  excoRole?: string | null
  " excoRole"?: string | null
  isExco?: boolean | null
  isSuspended?: boolean | null
  telegramRevokedAt?: Date | null
}

export function createTelegramLinkToken() {
  return randomBytes(32).toString('base64url')
}
export function hashTelegramLinkToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
export function isValidTelegramLinkToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}
export function hasTelegramStaffPrivilege(account: TelegramStaffEligibilityAccount) {
  // ` excoRole` is a read-only compatibility path for records created by an
  // old typo. Only a recognised EXCO value is accepted; clients cannot submit
  // either role field through Better Auth.
  const excoRole = normalizeExcoRole(account.excoRole ?? account[" excoRole"])
  return account.role === 'admin' || Boolean(excoRole) || account.isExco === true
}

export function isTelegramLinkEligible(account: TelegramStaffEligibilityAccount) {
  return account.isSuspended !== true && !account.telegramRevokedAt &&
    hasTelegramStaffPrivilege(account)
}
