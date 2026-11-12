/**
 * Use the verified SwiftDU account name for staff greetings. Telegram's
 * profile first name may be a nickname or an old name (e.g. "Nik").
 */
export function getSammyStaffFirstName(staff: {
  name?: string | null
  telegramFirstName?: string | null
}): string {
  const accountFirst = staff.name?.trim().split(/\s+/)[0]
  const telegramFirst = staff.telegramFirstName?.trim().split(/\s+/)[0]
  return accountFirst || telegramFirst || 'Staff'
}
