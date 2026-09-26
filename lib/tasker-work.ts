export type WorkStatus = 'offline' | 'available' | 'busy'
export function getWorkStatus(checkedIn: boolean, activeTasks: number): WorkStatus {
  return activeTasks > 0 ? 'busy' : checkedIn ? 'available' : 'offline'
}

export function periodStarts(now = new Date()) {
  // Lagos is UTC+1 throughout the year. Weeks start on Monday.
  const local = new Date(now.getTime() + 3_600_000)
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 3_600_000
  return {
    today: new Date(day),
    week: new Date(day - ((local.getUTCDay() + 6) % 7) * 86_400_000),
    month: new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 3_600_000),
  }
}

export function overlapMilliseconds(start: Date, end: Date | null | undefined, from: Date, now: Date) {
  return Math.max(0, Math.min((end || now).getTime(), now.getTime()) - Math.max(start.getTime(), from.getTime()))
}

export function taskerEarnings(order: { taskerFee?: number; serviceFeeDiscountApplied?: boolean; discountCommissionAmount?: number }) {
  return Number(order.serviceFeeDiscountApplied ? order.discountCommissionAmount || order.taskerFee || 0 : order.taskerFee || 0)
}

export interface WorkSummary { tasks: number; earnings: number; activeMs: number }
export interface WorkSnapshot {
  taskerId: string
  status: WorkStatus
  checkedIn: boolean
  checkedInAt: string | null
  activeTasks: number
  mode: 'training' | 'live'
  canCheckIn: boolean
  blockedReason: string | null
  serverNow: string
  summaries: Record<'today' | 'week' | 'month', WorkSummary>
}
