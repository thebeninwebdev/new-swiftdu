import Tasker from '@/models/tasker'
import { Order } from '@/models/order'
import { User } from '@/models/user'
import { TaskerWorkSession } from '@/models/tasker-work-session'
import { canTaskerDeliver } from '@/lib/delivery-policy'
import { lockTaskerWork } from '@/lib/tasker-work-server'
import { MAX_TASKER_ORDER_CAPACITY, getOrderCapacityUnits, getTaskerUsedCapacity, getTaskerRemainingCapacity, canAssignCapacity } from '@/lib/tasker-capacity'

/** The only capacity limit used for live tasker workload. */
export const MAX_TASKER_ACTIVE_ORDERS = MAX_TASKER_ORDER_CAPACITY
export { MAX_TASKER_ORDER_CAPACITY, getOrderCapacityUnits, getTaskerUsedCapacity, getTaskerRemainingCapacity, canAssignCapacity }

export async function getEligibleIndomieTaskers({ location, isTestOrder = false }: { location: string; isTestOrder?: boolean }) {
  // A checked-in live tasker is SwiftDU's existing online signal. Training taskers
  // can only ever be considered for test orders.
  const mode = isTestOrder ? 'training' : 'live'
  const [taskers, openSessions] = await Promise.all([
    Tasker.find({ isVerified: true, isRejected: { $ne: true }, isSettlementSuspended: { $ne: true }, taskerMode: mode }).select('_id userId').lean(),
    TaskerWorkSession.find({ open: true }).select('taskerId').lean(),
  ])
  const online = new Set(openSessions.map(session => String(session.taskerId)))
  const live = taskers.filter(tasker => online.has(String(tasker._id)))
  const users = await User.find({ _id: { $in: live.map(tasker => tasker.userId).filter(Boolean) } }).select('_id gender').lean()
  const genderByUser = new Map(users.map(user => [String(user._id), user.gender]))
  const eligible = live.filter(tasker => canTaskerDeliver({ location }, genderByUser.get(String(tasker.userId))))
  const remaining = await Promise.all(eligible.map(async tasker => ({ tasker, remainingCapacity: await getTaskerRemainingCapacity(String(tasker._id)) })))
  return remaining.filter(item => item.remainingCapacity > 0)
}

export async function getAvailableIndomieCapacity(input: { location: string; isTestOrder?: boolean }) {
  const taskers = await getEligibleIndomieTaskers(input)
  return taskers.reduce((total, item) => total + item.remainingCapacity, 0)
}

/**
 * Serializes allocation with the same lock used by normal task acceptance.  The
 * callback persists the order while the selected tasker's lock is held, so two
 * simultaneous requests cannot reserve a fourth workload slot.
 */
export async function reserveIndomieCapacity<T>(input: { location: string; isTestOrder?: boolean; requiredUnits?: number; save: (taskerId: string) => Promise<T> }) {
  const requiredUnits = Math.max(1, Math.min(MAX_TASKER_ORDER_CAPACITY, input.requiredUnits || 1))
  const candidates = await getEligibleIndomieTaskers(input)
  // Least loaded first gives balanced reservations without weakening eligibility.
  for (const candidate of candidates.sort((a, b) => b.remainingCapacity - a.remainingCapacity)) {
    let release: (() => Promise<void>) | undefined
    let acquired = false
    try {
      release = await lockTaskerWork(String(candidate.tasker._id))
      acquired = true
      const fresh = await Tasker.findById(candidate.tasker._id).select('isVerified isRejected isSettlementSuspended taskerMode userId').lean()
      if (!fresh || !fresh.isVerified || fresh.isRejected || fresh.isSettlementSuspended || fresh.taskerMode !== (input.isTestOrder ? 'training' : 'live')) continue
      if (!await TaskerWorkSession.exists({ taskerId: String(fresh._id), open: true })) continue
      const user = fresh.userId ? await User.findById(fresh.userId).select('gender').lean() : null
      if (!canTaskerDeliver({ location: input.location }, user?.gender)) continue
      if (!await canAssignCapacity(String(fresh._id), requiredUnits)) continue
      return await input.save(String(fresh._id))
    } catch (error) {
      // Another reservation may have won this tasker. Try the next eligible one.
      if (acquired) throw error
    } finally {
      if (release) await release()
    }
  }
  throw new Error('No compatible Live tasker capacity is available for this Indomie run.')
}
