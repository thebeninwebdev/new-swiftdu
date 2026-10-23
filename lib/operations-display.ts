export const OPERATIONS_DISPLAY_TIMEZONE = 'Africa/Lagos'

export type CustomerOperationsStatus = {
  enabled: boolean
  open: boolean
  openingTime: string
  closingTime: string
  nextOpeningAt: string
}

export type CustomerOperationsState = 'paused' | 'closed' | 'open'

export function getCustomerOperationsState(status: Pick<CustomerOperationsStatus, 'enabled' | 'open'>): CustomerOperationsState {
  if (!status.enabled) return 'paused'
  if (!status.open) return 'closed'
  return 'open'
}

export function isCustomerOrderingUnavailable(status: Pick<CustomerOperationsStatus, 'enabled' | 'open'> | null, trainingMode: boolean) {
  return !trainingMode && status !== null && getCustomerOperationsState(status) !== 'open'
}

export function formatOperationalTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return value

  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function lagosDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONS_DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatNextOperationalOpening(nextOpeningAt: string, fallbackOpeningTime: string, now = new Date()) {
  const nextOpening = new Date(nextOpeningAt)
  if (Number.isNaN(nextOpening.getTime())) return formatOperationalTime(fallbackOpeningTime)

  const time = new Intl.DateTimeFormat('en-NG', {
    timeZone: OPERATIONS_DISPLAY_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(nextOpening)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000)

  if (lagosDateKey(nextOpening) === lagosDateKey(now)) return time
  if (lagosDateKey(nextOpening) === lagosDateKey(tomorrow)) return `tomorrow at ${time}`
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: OPERATIONS_DISPLAY_TIMEZONE,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(nextOpening)
}
