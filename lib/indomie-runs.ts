/** The customer-facing Indomie timetable. All dates returned are real UTC dates. */
export const INDOMIE_RUN_START_MINUTE = 18 * 60
export const INDOMIE_RUN_END_MINUTE = 21 * 60
export const INDOMIE_RUN_INTERVAL_MINUTES = 30
export const INDOMIE_BOOKING_CUTOFF_MINUTES = 10
export const INDOMIE_ARRIVAL_MINUTES = { start: 15, end: 30 }

const lagosParts = (date: Date) => {
  const local = new Date(date.getTime() + 60 * 60_000)
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate(), minute: local.getUTCHours() * 60 + local.getUTCMinutes() }
}
const lagosDate = (p: ReturnType<typeof lagosParts>, minute: number) =>
  new Date(Date.UTC(p.year, p.month, p.day, 0, minute - 60, 0, 0))

export function isIndomieRunPeriod(now = new Date()) {
  const p = lagosParts(now)
  return p.minute >= INDOMIE_RUN_START_MINUTE && p.minute <= INDOMIE_RUN_END_MINUTE
}

export function getNextIndomieRun(now = new Date()) {
  const p = lagosParts(now)
  for (let minute = INDOMIE_RUN_START_MINUTE; minute <= INDOMIE_RUN_END_MINUTE; minute += INDOMIE_RUN_INTERVAL_MINUTES) {
    const run = lagosDate(p, minute)
    if (run.getTime() > now.getTime()) return run
  }
  return null
}

export function isRunStillBookable(runAt: Date, now = new Date()) {
  return now.getTime() < runAt.getTime() - INDOMIE_BOOKING_CUTOFF_MINUTES * 60_000
}

export function getNextAvailableIndomieRun(now = new Date()) {
  let run = getNextIndomieRun(now)
  while (run && !isRunStillBookable(run, now)) run = new Date(run.getTime() + INDOMIE_RUN_INTERVAL_MINUTES * 60_000)
  return run && lagosParts(run).minute <= INDOMIE_RUN_END_MINUTE ? run : null
}

export function formatIndomieRunTime(runAt: Date) {
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit' }).format(runAt)
}

export function indomieArrivalWindow(runAt: Date) {
  return { start: new Date(runAt.getTime() + INDOMIE_ARRIVAL_MINUTES.start * 60_000), end: new Date(runAt.getTime() + INDOMIE_ARRIVAL_MINUTES.end * 60_000) }
}
