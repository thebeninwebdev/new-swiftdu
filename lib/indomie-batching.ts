import { getDeliveryDestination, getOrderRestriction, type TaskerGenderRestriction } from '@/lib/delivery-policy'

export const LAGOS_TIME_ZONE = 'Africa/Lagos'
export const BATCH_WINDOW_MINUTES = 15
export const BATCH_MAX_ORDERS = 3

type BatchableOrder = { taskType?: string; location?: string | null; store?: string | null; taskerGenderRestriction?: TaskerGenderRestriction | null; isTestOrder?: boolean; createdInMode?: string; status?: string; taskerId?: string | null; batchWindowStart?: Date | string }

function lagosParts(date: Date) {
  const values = new Intl.DateTimeFormat('en-GB', { timeZone: LAGOS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  return Object.fromEntries(values.filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)])) as Record<string, number>
}

/** Returns a Date that represents the supplied Lagos wall-clock time in UTC. Lagos has no DST. */
function lagosDate(parts: Record<string, number>, hour: number, minute: number) { return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 1, minute)) }

export type IndomieBatchSchedule = { startMinute: number; endMinute: number; windowMinutes: number }
export function isIndomieBatchingActive(now = new Date(), schedule: IndomieBatchSchedule = { startMinute: 18 * 60, endMinute: 21 * 60, windowMinutes: BATCH_WINDOW_MINUTES }) {
  const p = lagosParts(now); const minutes = p.hour * 60 + p.minute
  return minutes >= schedule.startMinute && minutes < schedule.endMinute
}
export function getIndomieBatchWindow(now = new Date(), schedule: IndomieBatchSchedule = { startMinute: 18 * 60, endMinute: 21 * 60, windowMinutes: BATCH_WINDOW_MINUTES }) {
  if (!isIndomieBatchingActive(now, schedule)) return null
  const p = lagosParts(now); const minuteOfDay = p.hour * 60 + p.minute; const startOfWindow = schedule.startMinute + Math.floor((minuteOfDay - schedule.startMinute) / schedule.windowMinutes) * schedule.windowMinutes
  const start = lagosDate(p, Math.floor(startOfWindow / 60), startOfWindow % 60)
  return { start, end: new Date(start.getTime() + schedule.windowMinutes * 60_000) }
}
export function normalizeBatchDestination(location?: string | null) {
  return getDeliveryDestination(location)?.id || String(location || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
export function normalizeIndomiePickup(store?: string | null) { return String(store || 'indomie').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'indomie' }
export function indomieBatchGroupKey(order: BatchableOrder, windowStart: Date | string) {
  return ['indomie', new Date(windowStart).toISOString(), normalizeIndomiePickup(order.store), normalizeBatchDestination(order.location), getOrderRestriction(order) || 'any', order.isTestOrder ? 'test' : 'live'].join(':')
}
export function areIndomieOrdersCompatible(a: BatchableOrder, b: BatchableOrder) {
  return a.taskType === 'indomie' && b.taskType === 'indomie' && a.status !== 'cancelled' && b.status !== 'cancelled' && !a.taskerId && !b.taskerId && Boolean(a.batchWindowStart && b.batchWindowStart) && indomieBatchGroupKey(a, a.batchWindowStart!) === indomieBatchGroupKey(b, b.batchWindowStart!)
}
export function splitIndomieBatchSizes(count: number) { const result: number[] = []; while (count > 0) { const size = Math.min(BATCH_MAX_ORDERS, count); result.push(size); count -= size } return result }
