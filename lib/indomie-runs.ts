import { getLagosDateParts, lagosDateAtMinute } from '@/lib/operations-settings'
import { DEFAULT_INDOMIE_BATCH_SETTINGS, type IndomieBatchSettingsValue } from '@/lib/indomie-batch-settings'

export const INDOMIE_ARRIVAL_MINUTES = { start: 15, end: 30 }

export function isIndomieRunPeriod(now = new Date(), settings: IndomieBatchSettingsValue = DEFAULT_INDOMIE_BATCH_SETTINGS) {
  const minute = getLagosDateParts(now).minute
  return minute >= settings.startMinute && minute < settings.endMinute
}

export function getNextIndomieRun(now = new Date(), settings: IndomieBatchSettingsValue = DEFAULT_INDOMIE_BATCH_SETTINGS) {
  for (let minute = settings.startMinute; minute <= settings.endMinute; minute += settings.runIntervalMinutes) {
    const run = lagosDateAtMinute(now, minute)
    if (run.getTime() > now.getTime()) return run
  }
  return null
}

export function isRunStillBookable(runAt: Date, now = new Date(), settings: IndomieBatchSettingsValue = DEFAULT_INDOMIE_BATCH_SETTINGS) {
  const runMinute = getLagosDateParts(runAt).minute
  return runMinute >= settings.startMinute && runMinute <= settings.endMinute && now.getTime() < runAt.getTime() - settings.bookingCutoffMinutes * 60_000
}

export function getNextAvailableIndomieRun(now = new Date(), settings: IndomieBatchSettingsValue = DEFAULT_INDOMIE_BATCH_SETTINGS) {
  let run = getNextIndomieRun(now, settings)
  while (run && !isRunStillBookable(run, now, settings)) run = new Date(run.getTime() + settings.runIntervalMinutes * 60_000)
  return run && getLagosDateParts(run).minute <= settings.endMinute ? run : null
}

export function formatIndomieRunTime(runAt: Date) {
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit', hour12: true }).format(runAt)
}

export function indomieArrivalWindow(runAt: Date) {
  return { start: new Date(runAt.getTime() + INDOMIE_ARRIVAL_MINUTES.start * 60_000), end: new Date(runAt.getTime() + INDOMIE_ARRIVAL_MINUTES.end * 60_000) }
}
