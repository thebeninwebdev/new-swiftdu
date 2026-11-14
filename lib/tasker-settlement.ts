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
const NON_TEST_ORDER_MATCH = {
  $or: [{ isTestOrder: false }, { isTestOrder: { $exists: false } }],
}
const NON_WAIVED_PLATFORM_FEE_MATCH = {
  $or: [
    { platformFeeWaivedForFastCompletion: false },
    { platformFeeWaivedForFastCompletion: { $exists: false } },
  ],
}
const NO_VERIFIED_SETTLEMENT_MATCH = {
  taskerHasPaid: { $ne: true },
  settlementStatus: { $ne: 'paid' },
  $or: [
    { settlementPaidAt: { $exists: false } },
    { settlementPaidAt: null },
  ],
}

export function getNonPayableSettlementRepairQuery(taskerId?: string) {
  return {
    ...(taskerId ? { taskerId } : {}),
    ...NO_VERIFIED_SETTLEMENT_MATCH,
    $and: [{
      $or: [
        { platformFee: { $lte: 0 } },
        { platformFee: { $exists: false } },
        { platformFee: null },
        { platformFeeWaivedForFastCompletion: true },
      ],
    }, {
      $or: [
        { settlementStatus: { $ne: 'not_due' } },
        { settlementDueAt: { $exists: true, $ne: null } },
        { settlementFailureReason: { $exists: true, $ne: null } },
        { settlementReference: { $exists: true, $ne: null } },
        { settlementAccessCode: { $exists: true, $ne: null } },
        { settlementCheckoutUrl: { $exists: true, $ne: null } },
        { settlementTransactionId: { $exists: true, $ne: null } },
        { settlementInitializedAt: { $exists: true, $ne: null } },
      ],
    }],
  }
}

export async function normalizeNonPayableSettlementOrders(taskerId?: string) {
  return Order.updateMany(getNonPayableSettlementRepairQuery(taskerId), {
    $set: { settlementStatus: 'not_due' },
    $unset: {
      settlementDueAt: 1,
      settlementFailureReason: 1,
      settlementProvider: 1,
      settlementReference: 1,
      settlementAccessCode: 1,
      settlementCheckoutUrl: 1,
      settlementTransactionId: 1,
      settlementInitializedAt: 1,
    },
  })
}

export function getAutomaticOverdueSettlementQuery(taskerId: string, now = new Date()) {
  return {
    taskerId,
    status: 'completed' as const,
    platformFee: { $gt: 0 },
    ...NO_VERIFIED_SETTLEMENT_MATCH,
    settlementDueAt: { $lte: now },
    $and: [NON_TEST_ORDER_MATCH, NON_WAIVED_PLATFORM_FEE_MATCH],
  }
}

async function backfillSettlementMetadata(taskerId: string) {
  const orders = await Order.find({
    taskerId,
    status: 'completed',
    platformFee: { $gt: 0 },
    ...NO_VERIFIED_SETTLEMENT_MATCH,
    $and: [
      NON_TEST_ORDER_MATCH,
      NON_WAIVED_PLATFORM_FEE_MATCH,
      {
        $or: [
          { settlementDueAt: { $exists: false } },
          { settlementDueAt: null },
          { settlementStatus: { $exists: false } },
          { settlementStatus: 'not_due' },
        ],
      },
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
  await normalizeNonPayableSettlementOrders(taskerId)
  await Order.updateMany(
    {
      taskerId,
      status: 'completed',
      platformFee: { $gt: 0 },
      taskerHasPaid: { $ne: true },
      settlementStatus: 'paid',
      $and: [NON_TEST_ORDER_MATCH, NON_WAIVED_PLATFORM_FEE_MATCH],
    },
    {
      $set: {
        taskerHasPaid: true,
      },
      $unset: {
        settlementFailureReason: 1,
      },
    }
  )

  await backfillSettlementMetadata(taskerId)

  const now = new Date()
  const overdueQuery = getAutomaticOverdueSettlementQuery(taskerId, now)

  await Order.updateMany(overdueQuery, {
    $set: {
      settlementStatus: 'overdue',
    },
  })

  const overdueCount = await Order.countDocuments(overdueQuery)
  const isSettlementSuspended = overdueCount > 0

  await Tasker.findByIdAndUpdate(taskerId, [{
      $set: {
        isAutomaticSettlementSuspended: isSettlementSuspended,
        automaticSettlementSuspendedAt: isSettlementSuspended
          ? { $ifNull: ['$automaticSettlementSuspendedAt', now] }
          : null,
        isSettlementSuspended: {
          $or: [isSettlementSuspended, { $eq: ['$isSettlementAdminSuspended', true] }],
        },
        settlementSuspendedAt: {
          $cond: [
            { $or: [isSettlementSuspended, { $eq: ['$isSettlementAdminSuspended', true] }] },
            { $ifNull: ['$settlementSuspendedAt', now] },
            null,
          ],
        },
      },
    }],
    { updatePipeline: true }
  )

  const tasker = await Tasker.findById(taskerId)
    .select('isSettlementSuspended isAutomaticSettlementSuspended isSettlementAdminSuspended')
    .lean()

  return {
    overdueCount,
    isSettlementSuspended: Boolean(tasker?.isSettlementSuspended),
    isAutomaticSettlementSuspended: Boolean(tasker?.isAutomaticSettlementSuspended),
    isSettlementAdminSuspended: Boolean(tasker?.isSettlementAdminSuspended),
  }
}

export async function getOutstandingSettlementOrders(taskerId: string) {
  await syncTaskerSettlementStatus(taskerId)

  return Order.find({
    taskerId,
    status: 'completed',
    platformFee: { $gt: 0 },
    ...NO_VERIFIED_SETTLEMENT_MATCH,
    settlementStatus: { $in: [...OUTSTANDING_SETTLEMENT_STATUSES] },
    $and: [NON_TEST_ORDER_MATCH, NON_WAIVED_PLATFORM_FEE_MATCH],
  })
    .sort({ settlementDueAt: 1, completedAt: -1, createdAt: -1 })
    .lean()
}

/** Training settlements are visible only while training and are never synced
 * into overdue counts or suspension state. */
export async function getOutstandingTrainingSettlementOrders(taskerId: string) {
  return Order.find({
    taskerId,
    status: 'completed',
    isTestOrder: true,
    platformFee: { $gt: 0 },
    ...NO_VERIFIED_SETTLEMENT_MATCH,
    settlementStatus: { $in: [...OUTSTANDING_SETTLEMENT_STATUSES] },
    $and: [NON_WAIVED_PLATFORM_FEE_MATCH],
  })
    .sort({ completedAt: -1, createdAt: -1 })
    .lean()
}
