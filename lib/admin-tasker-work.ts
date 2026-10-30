import Tasker from '@/models/tasker'
import { User } from '@/models/user'
import { Order } from '@/models/order'
import { TaskerWorkSession } from '@/models/tasker-work-session'
import { getTaskerMode, type TaskerMode } from '@/lib/test-orders'
import { getWorkStatus, LONG_WORK_SESSION_MS, TASKER_BUSY_ORDER_STATUSES, type WorkStatus } from '@/lib/tasker-work'

export interface AdminTaskerActiveTask {
  id: string
  type: string
  status: 'in_progress' | 'paid'
}

export interface AdminTaskerWorkStatus {
  taskerId: string
  name: string
  phone: string
  email: string
  profileImage: string | null
  mode: TaskerMode
  checkedIn: boolean
  status: WorkStatus
  checkedInAt: string | null
  lastCheckedOutAt: string | null
  activeDurationMs: number
  activeTask: AdminTaskerActiveTask | null
  activeTasks: number
  longSession: boolean
}

export interface AdminTaskerWorkOverview {
  serverNow: string
  summary: { total: number; checkedIn: number; available: number; busy: number; offline: number }
  taskers: AdminTaskerWorkStatus[]
}

type TaskerRow = {
  _id: unknown
  userId?: unknown
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  phone?: string
  profileImage?: string
  taskerMode?: string
  isVerified?: boolean
}
type UserRow = { _id: unknown; name?: string; email?: string; profileImage?: string }
type SessionRow = { taskerId: string; startedAt: Date | string }
type ClosedSessionRow = { _id: string; endedAt: Date | string }
type OrderRow = { _id: unknown; taskerId?: string; taskType?: string; status: 'in_progress' | 'paid' }

export function buildAdminTaskerWorkOverview(input: {
  taskers: TaskerRow[]
  users: UserRow[]
  openSessions: SessionRow[]
  latestClosedSessions: ClosedSessionRow[]
  activeOrders: OrderRow[]
  now?: Date
}): AdminTaskerWorkOverview {
  const now = input.now || new Date()
  const users = new Map(input.users.map((user) => [String(user._id), user]))
  const openSessions = new Map(input.openSessions.map((session) => [String(session.taskerId), session]))
  const latestClosed = new Map(input.latestClosedSessions.map((session) => [String(session._id), session]))
  const orders = new Map<string, OrderRow[]>()
  for (const order of input.activeOrders) {
    if (!order.taskerId) continue
    const existing = orders.get(String(order.taskerId)) || []
    existing.push(order)
    orders.set(String(order.taskerId), existing)
  }

  const taskers = input.taskers.map((tasker): AdminTaskerWorkStatus => {
    const taskerId = String(tasker._id)
    const user = tasker.userId ? users.get(String(tasker.userId)) : undefined
    const session = openSessions.get(taskerId)
    const activeOrders = orders.get(taskerId) || []
    const checkedInAt = session ? new Date(session.startedAt) : null
    const activeDurationMs = checkedInAt ? Math.max(0, now.getTime() - checkedInAt.getTime()) : 0
    const firstName = [tasker.firstName, tasker.lastName].filter(Boolean).join(' ')
    const activeTask = activeOrders[0]
    return {
      taskerId,
      name: user?.name || tasker.fullName || firstName || 'Tasker',
      phone: tasker.phone || '',
      email: user?.email || tasker.email || '',
      profileImage: tasker.profileImage || user?.profileImage || null,
      mode: getTaskerMode(tasker),
      checkedIn: Boolean(session),
      status: getWorkStatus(Boolean(session), activeOrders.length),
      checkedInAt: checkedInAt?.toISOString() || null,
      lastCheckedOutAt: latestClosed.get(taskerId)?.endedAt ? new Date(latestClosed.get(taskerId)!.endedAt).toISOString() : null,
      activeDurationMs,
      activeTask: activeTask ? { id: String(activeTask._id), type: activeTask.taskType || 'task', status: activeTask.status } : null,
      activeTasks: activeOrders.length,
      longSession: activeDurationMs > LONG_WORK_SESSION_MS,
    }
  }).sort((left, right) => {
    const rank = { busy: 0, available: 1, offline: 2 }
    return rank[left.status] - rank[right.status] || left.name.localeCompare(right.name)
  })

  return {
    serverNow: now.toISOString(),
    summary: {
      total: taskers.length,
      checkedIn: taskers.filter((tasker) => tasker.checkedIn).length,
      available: taskers.filter((tasker) => tasker.status === 'available').length,
      busy: taskers.filter((tasker) => tasker.status === 'busy').length,
      offline: taskers.filter((tasker) => tasker.status === 'offline').length,
    },
    taskers,
  }
}

export async function getAdminTaskerWorkOverview(now = new Date()): Promise<AdminTaskerWorkOverview> {
  const taskers = await Tasker.find({ isVerified: true, isRejected: { $ne: true } })
    .select('_id userId firstName lastName fullName email phone profileImage taskerMode isVerified')
    .sort({ createdAt: -1 })
    .lean<TaskerRow[]>()
  const taskerIds = taskers.map((tasker) => String(tasker._id))
  if (!taskerIds.length) return buildAdminTaskerWorkOverview({ taskers, users: [], openSessions: [], latestClosedSessions: [], activeOrders: [], now })

  const userIds = taskers.flatMap((tasker) => tasker.userId ? [tasker.userId] : [])
  const [users, openSessions, latestClosedSessions, activeOrders] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('_id name email profileImage').lean<UserRow[]>(),
    TaskerWorkSession.find({ taskerId: { $in: taskerIds }, open: true }).select('taskerId startedAt').lean<SessionRow[]>(),
    TaskerWorkSession.aggregate<ClosedSessionRow>([
      { $match: { taskerId: { $in: taskerIds }, open: false, endedAt: { $exists: true } } },
      { $sort: { endedAt: -1 } },
      { $group: { _id: '$taskerId', endedAt: { $first: '$endedAt' } } },
    ]),
    Order.find({ taskerId: { $in: taskerIds }, status: { $in: [...TASKER_BUSY_ORDER_STATUSES] } })
      .select('_id taskerId taskType status acceptedAt createdAt')
      .sort({ acceptedAt: -1, createdAt: -1 })
      .lean<OrderRow[]>(),
  ])
  return buildAdminTaskerWorkOverview({ taskers, users, openSessions, latestClosedSessions, activeOrders, now })
}
