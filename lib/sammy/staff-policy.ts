import { isTelegramLinkEligible, type TelegramStaffEligibilityAccount } from './telegram-link-policy'

export function normalizeCustomerPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('0')) return '234' + digits.slice(1)
  if (digits.length === 10) return '234' + digits
  return digits
}

export function isApprovedTelegramStaffAccount<T extends TelegramStaffEligibilityAccount & {
    telegramUserId?: string | null
    telegramEnabled?: boolean
  }>(
  staff: T | null | undefined,
  telegramUserId: string
): staff is T {
  return Boolean(
    staff &&
    /^\d+$/.test(telegramUserId) &&
    staff.telegramUserId === telegramUserId &&
    staff.telegramEnabled === true &&
    isTelegramLinkEligible(staff)
  )
}
