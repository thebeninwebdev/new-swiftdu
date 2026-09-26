import { randomUUID } from 'node:crypto'
import Tasker from '@/models/tasker'
import { User } from '@/models/user'
import { Order } from '@/models/order'
import { TaskerWorkSession } from '@/models/tasker-work-session'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getTaskerMode } from '@/lib/test-orders'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'
import { getWorkStatus, overlapMilliseconds, periodStarts, type WorkSnapshot, type WorkSummary } from '@/lib/tasker-work'
import { calculateTaskerPeriodStats } from '@/lib/tasker-stats'

export class WorkError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

export async function currentTasker(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session?.user?.id) throw new WorkError('Sign in to continue.', 401)
  await connectDB()
  const user = await User.findById(session.user.id).select('role')
  if (user?.role !== 'tasker') throw new WorkError('A tasker account is required.', 403)
  const tasker = await Tasker.findOne({ userId: session.user.id })
  if (!tasker) throw new WorkError('Complete your tasker onboarding first.', 403)
  return tasker
}

// Acceptance and checkout must serialize on the same tasker, across server instances.
export async function lockTaskerWork(taskerId: string) {
  const token = randomUUID()
  const result = await Tasker.updateOne({ _id: taskerId, $or: [
    { workMutationToken: { $exists: false } }, { workMutationExpiresAt: { $lte: new Date() } },
  ] }, { $set: { workMutationToken: token, workMutationExpiresAt: new Date(Date.now() + 60_000) } })
  if (!result.modifiedCount) throw new WorkError('Another work update is in progress. Please retry.')
  return async () => { await Tasker.updateOne({ _id: taskerId, workMutationToken: token }, { $unset: { workMutationToken: 1, workMutationExpiresAt: 1 } }) }
}

export async function workSnapshot(taskerId: string): Promise<WorkSnapshot> {
  await syncTaskerSettlementStatus(taskerId)
  const tasker = await Tasker.findById(taskerId).orFail()
  const now = new Date()
  const starts = periodStarts(now)
  const earliest = new Date(Math.min(starts.month.getTime(), starts.week.getTime()))
  const [open, activeTasks, sessions, periods] = await Promise.all([
    TaskerWorkSession.findOne({ taskerId, open: true }).lean(),
    Order.countDocuments({ taskerId, status: { $in: ['in_progress', 'paid'] } }),
    TaskerWorkSession.find({ taskerId, startedAt: { $lte: now }, $or: [{ endedAt: { $gte: earliest } }, { open: true }] }).lean(),
    calculateTaskerPeriodStats(taskerId, starts),
  ])
  const summaries = {} as Record<keyof typeof starts, WorkSummary>
  for (const period of ['today', 'week', 'month'] as const) {
    summaries[period] = { ...periods[period], activeMs: sessions.reduce((total, item) => total + overlapMilliseconds(new Date(item.startedAt), item.endedAt ? new Date(item.endedAt) : null, starts[period], now), 0) }
  }
  const blockedReason = !tasker.isVerified || tasker.isRejected ? 'Your account needs approval before you can check in.' : tasker.isSettlementSuspended ? 'Settle your overdue platform fees before checking in.' : null
  return { taskerId, status: getWorkStatus(Boolean(open), activeTasks), checkedIn: Boolean(open), checkedInAt: open ? new Date(open.startedAt).toISOString() : null, activeTasks, mode: getTaskerMode(tasker), canCheckIn: !blockedReason, blockedReason, serverNow: now.toISOString(), summaries }
}
