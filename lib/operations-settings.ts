import { OperationsSettings } from '@/models/operations-settings'

export const OPERATIONS_TIMEZONE = 'Africa/Lagos'
export const DEFAULT_OPERATIONS_SETTINGS = { openMinute: 7 * 60, closeMinute: 22 * 60 } as const
export type OperationsSchedule = { openMinute: number; closeMinute: number }
export type IndomieSchedule = { startMinute: number; endMinute: number; bookingCutoffMinutes?: number }
export type IndomieServiceMode = 'normal' | 'batching' | 'closed'

export function getLagosDateParts(now: Date) {
  const lagos = new Date(now.getTime() + 60 * 60_000)
  return { year: lagos.getUTCFullYear(), month: lagos.getUTCMonth(), day: lagos.getUTCDate(), minute: lagos.getUTCHours() * 60 + lagos.getUTCMinutes() }
}

export function lagosDateAtMinute(now: Date, minute: number, dayOffset = 0) {
  const parts = getLagosDateParts(now)
  return new Date(Date.UTC(parts.year, parts.month, parts.day + dayOffset, 0, minute - 60, 0, 0))
}

export function formatMinute(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

export function isWithinOperatingHours(now: Date, settings: OperationsSchedule) {
  const minute = getLagosDateParts(now).minute
  return minute >= settings.openMinute && minute < settings.closeMinute
}

export function getNextOpeningTime(now: Date, settings: OperationsSchedule) {
  const minute = getLagosDateParts(now).minute
  return lagosDateAtMinute(now, settings.openMinute, minute < settings.openMinute ? 0 : 1)
}

export function getIndomieServiceMode({ now, operationsSettings, batchingSettings }: { now: Date; operationsSettings: OperationsSchedule; batchingSettings: IndomieSchedule }): IndomieServiceMode {
  if (!isWithinOperatingHours(now, operationsSettings)) return 'closed'
  const minute = getLagosDateParts(now).minute
  if (minute < batchingSettings.startMinute) return 'normal'
  const lastBookingMinute = batchingSettings.endMinute - (batchingSettings.bookingCutoffMinutes || 0)
  return minute < lastBookingMinute ? 'batching' : 'closed'
}

export function getOperationsStatus(now: Date, settings: OperationsSchedule) {
  return { open: isWithinOperatingHours(now, settings), nextOpeningAt: getNextOpeningTime(now, settings) }
}

export async function getOperationsSettings(): Promise<OperationsSchedule> {
  const saved = await OperationsSettings.findOne({ key: 'default' }).lean()
  return saved ? { openMinute: saved.openMinute, closeMinute: saved.closeMinute } : { ...DEFAULT_OPERATIONS_SETTINGS }
}
