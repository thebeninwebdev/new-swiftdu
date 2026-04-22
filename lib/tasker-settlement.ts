import { getSettlementDueAt } from '@/lib/order-finance'
import { Order } from '@/models/order'
import Tasker from '@/models/tasker'

const OUTSTANDING_SETTLEMENT_STATUSES = [
  'not_due',
  'pending',
  'initialized',
  'failed',
  'overdue',
] as const

async function backfillSettlementMetadata(taskerId: string) {
  const orders = await Order.find({
    taskerId,
    status: 'completed',
    taskerHasPaid: false,
    $or: [
      { settlementDueAt: { $exists: false } },
      { settlementDueAt: null },
      { settlementStatus: { $exists: false } },
      { settlementStatus: 'not_due' },
    ],
  })

  if (orders.length === 0) {
    return
  }

  const now = new Date()

  for (const order of orders) {
    const dueAt = getSettlementDueAt(
      order.completedAt || order.updatedAt || order.createdAt || now
    )

    order.settlementDueAt = dueAt
    order.settlementStatus = dueAt.getTime() <= now.getTime() ? 'overdue' : 'pending'
    await order.save()
  }
}

export async function syncTaskerSettlementStatus(taskerId: string) {
  await backfillSettlementMetadata(taskerId)

  const now = new Date()
  const overdueQuery = {
    taskerId,
    status: 'completed',
    taskerHasPaid: false,
    settlementDueAt: { $lte: now },
  }

  await Order.updateMany(overdueQuery, {
    $set: {
      settlementStatus: 'overdue',
    },
  })

  const overdueCount = await Order.countDocuments(overdueQuery)
  const isSettlementSuspended = overdueCount > 0

  await Tasker.findByIdAndUpdate(taskerId, {
    isSettlementSuspended,
    settlementSuspendedAt: isSettlementSuspended ? now : null,
  })

  return {
    overdueCount,
    isSettlementSuspended,
  }
}

export async function getOutstandingSettlementOrders(taskerId: string) {
  await syncTaskerSettlementStatus(taskerId)

  return Order.find({
    taskerId,
    status: 'completed',
    taskerHasPaid: false,
    settlementStatus: { $in: [...OUTSTANDING_SETTLEMENT_STATUSES] },
  })
    .sort({ settlementDueAt: 1, completedAt: -1, createdAt: -1 })
    .lean()
}
