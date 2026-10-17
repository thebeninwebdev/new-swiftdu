import { Order } from '@/models/order'

export const MAX_TASKER_ORDER_CAPACITY = 3

export function getOrderCapacityUnits(order: { taskType?: string; indomieSlotCount?: number | null }) {
  return order.taskType === 'indomie' ? Math.max(1, Math.min(MAX_TASKER_ORDER_CAPACITY, Number(order.indomieSlotCount || 1))) : 1
}

const ACTIVE_ASSIGNMENTS = { $in: ['in_progress', 'paid'] }
export async function getTaskerUsedCapacity(taskerId: string) {
  const orders = await Order.find({ taskerId, $or: [{ status: ACTIVE_ASSIGNMENTS }, { taskType: 'indomie', indomieRunAt: { $gte: new Date() }, status: 'pending' }] }).select('taskType indomieSlotCount').lean()
  return orders.reduce((total, order) => total + getOrderCapacityUnits(order), 0)
}
export async function getTaskerRemainingCapacity(taskerId: string) {
  return Math.max(0, MAX_TASKER_ORDER_CAPACITY - await getTaskerUsedCapacity(taskerId))
}
export async function canAssignCapacity(taskerId: string, requiredUnits = 1) {
  return (await getTaskerRemainingCapacity(taskerId)) >= requiredUnits
}
