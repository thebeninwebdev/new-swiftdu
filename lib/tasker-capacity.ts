import { Order } from '@/models/order'

export const MAX_TASKER_ORDER_CAPACITY = 3

export function getOrderCapacityUnits(order: { taskType?: string; indomieSlotCount?: number | null }) {
  return order.taskType === 'indomie' ? Math.max(1, Math.min(MAX_TASKER_ORDER_CAPACITY, Number(order.indomieSlotCount || 1))) : 1
}

const ACTIVE_ASSIGNMENTS = { $in: ['in_progress', 'paid'] }
export async function getTaskerUsedCapacity(taskerId: string, isTestOrder = false) {
  const modeFilter = isTestOrder ? { isTestOrder: true } : { $or: [{ isTestOrder: false }, { isTestOrder: { $exists: false } }] }
  const orders = await Order.find({
    taskerId,
    $and: [
      modeFilter,
      { $or: [{ status: ACTIVE_ASSIGNMENTS }, { taskType: 'indomie', indomieRunAt: { $gte: new Date() }, status: 'pending' }] },
    ],
  }).select('taskType indomieSlotCount').lean()
  return orders.reduce((total, order) => total + getOrderCapacityUnits(order), 0)
}
export async function getTaskerRemainingCapacity(taskerId: string, isTestOrder = false) {
  return Math.max(0, MAX_TASKER_ORDER_CAPACITY - await getTaskerUsedCapacity(taskerId, isTestOrder))
}
export async function canAssignCapacity(taskerId: string, requiredUnits = 1, isTestOrder = false) {
  return (await getTaskerRemainingCapacity(taskerId, isTestOrder)) >= requiredUnits
}
