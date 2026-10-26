import { Types } from 'mongoose'

const SEARCHABLE_TEXT_FIELDS = [
  'name',
  'email',
  'phone',
  'location',
  'defaultLocation',
  'gender',
  'role',
  'excoRole',
  'taskerId',
  'serviceFeeDiscountGrantedByName',
  'serviceFeeDiscountGrantedByPhone',
] as const

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
  october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function validUtcDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null
}

function birthdayParts(value: string) {
  const normalized = value.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
  let year: number | undefined
  let month: number | undefined
  let day: number | undefined

  let match = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (match) [, year, month, day] = match.map(Number)

  match ||= normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (match && year === undefined) [, day, month, year] = match.map(Number)

  const monthPattern = Object.keys(MONTHS).join('|')
  match ||= normalized.match(new RegExp(`^(\\d{1,2})\\s+(${monthPattern})(?:\\s+(\\d{4}))?$`))
  if (match && month === undefined) {
    day = Number(match[1]); month = MONTHS[match[2]]; year = match[3] ? Number(match[3]) : undefined
  }

  match ||= normalized.match(new RegExp(`^(${monthPattern})\\s+(\\d{1,2})(?:\\s+(\\d{4}))?$`))
  if (match && month === undefined) {
    month = MONTHS[match[1]]; day = Number(match[2]); year = match[3] ? Number(match[3]) : undefined
  }

  if (month === undefined && MONTHS[normalized]) month = MONTHS[normalized]
  if (month !== undefined && (month < 1 || month > 12)) return {}
  if (day !== undefined && (day < 1 || day > 31)) return {}
  return { year, month, day }
}

/** Build a safe admin-directory search without exposing credentials or secret fields. */
export function buildAdminUserSearch(search?: string | null) {
  const value = String(search || '').trim()
  if (!value) return undefined

  const conditions: Record<string, unknown>[] = SEARCHABLE_TEXT_FIELDS.map(field => ({
    [field]: { $regex: escapeRegex(value), $options: 'i' },
  }))

  const digits = value.replace(/\D/g, '')
  if (digits.length >= 3) {
    conditions.push({ phone: { $regex: digits.split('').join('\\D*') } })
    conditions.push({ serviceFeeDiscountGrantedByPhone: { $regex: digits.split('').join('\\D*') } })
  }

  if (Types.ObjectId.isValid(value)) conditions.push({ _id: new Types.ObjectId(value) })

  const { year, month, day } = birthdayParts(value)
  if (month) {
    conditions.push({ birthdayMonth: month })
    conditions.push({ $expr: { $eq: [{ $month: '$dateOfBirth' }, month] } })
  }
  if (day) conditions.push({ birthdayDay: day })
  if (month && day) {
    conditions.push({ $expr: { $and: [
      { $eq: [{ $month: '$dateOfBirth' }, month] },
      { $eq: [{ $dayOfMonth: '$dateOfBirth' }, day] },
    ] } })
  }
  if (year && month && day) {
    const start = validUtcDate(year, month, day)
    if (start) {
      const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1)
      conditions.push({ dateOfBirth: { $gte: start, $lt: end } })
      conditions.push({ createdAt: { $gte: start, $lt: end } })
    }
  }

  const status = value.toLowerCase().replace(/[\s_-]+/g, '')
  if (status === 'verified') conditions.push({ emailVerified: true })
  if (status === 'unverified') conditions.push({ emailVerified: false })
  if (status === 'suspended') conditions.push({ isSuspended: true })
  if (status === 'active') conditions.push({ isSuspended: { $ne: true } })
  if (status === 'exco') conditions.push({ isExco: true })

  return { $or: conditions }
}
