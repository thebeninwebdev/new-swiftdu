import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import {
  getAutomaticOverdueSettlementQuery,
  getNonPayableSettlementRepairQuery,
  normalizeNonPayableSettlementOrders,
  syncTaskerSettlementStatus,
} from '@/lib/tasker-settlement'
import { Order } from '@/models/order'
import Tasker from '@/models/tasker'

const execute = process.argv.includes('--execute')
const preservedAdminTaskerIds = process.argv
  .filter(argument => argument.startsWith('--preserve-admin='))
  .flatMap(argument => argument.slice('--preserve-admin='.length).split(','))
  .map(value => value.trim())
  .filter(Boolean)

if (preservedAdminTaskerIds.some(id => !mongoose.isValidObjectId(id))) {
  throw new Error('Every --preserve-admin value must be a valid tasker ObjectId.')
}

async function main() {
  await connectDB()

  const invalidOrders = await Order.find(getNonPayableSettlementRepairQuery())
    .select('_id taskerId platformFee platformFeeWaivedForFastCompletion settlementStatus')
    .lean()
  const suspendedTaskers = await Tasker.find({ isSettlementSuspended: true })
    .select('_id isSettlementAdminSuspended isAutomaticSettlementSuspended')
    .lean()
  const ambiguousLegacySuspensions = suspendedTaskers
    .filter(tasker =>
      tasker.isSettlementAdminSuspended === undefined &&
      tasker.isAutomaticSettlementSuspended === undefined
    )
    .map(tasker => String(tasker._id))
  const taskerIds = new Set(
    [...invalidOrders.map(order => order.taskerId), ...suspendedTaskers.map(tasker => String(tasker._id))]
      .filter((id): id is string => Boolean(id))
  )

  const proposedReinstatements: string[] = []
  for (const tasker of suspendedTaskers) {
    if (tasker.isSettlementAdminSuspended) continue
    const taskerId = String(tasker._id)
    if (await Order.countDocuments(getAutomaticOverdueSettlementQuery(taskerId)) === 0) {
      proposedReinstatements.push(taskerId)
    }
  }

  console.info('[Settlement reconciliation]', {
    mode: execute ? 'execute' : 'dry-run',
    invalidOrderCount: invalidOrders.length,
    invalidOrders: invalidOrders.map(order => ({
      orderId: String(order._id),
      taskerId: order.taskerId || null,
      platformFee: Number(order.platformFee || 0),
      waived: order.platformFeeWaivedForFastCompletion === true,
      settlementStatus: order.settlementStatus,
    })),
    proposedReinstatementCount: proposedReinstatements.length,
    proposedReinstatementTaskerIds: proposedReinstatements,
    ambiguousLegacySuspensionCount: ambiguousLegacySuspensions.length,
    ambiguousLegacySuspensionTaskerIds: ambiguousLegacySuspensions,
    preservedAdminTaskerIds,
  })

  if (!execute) {
    console.info('Dry run only. Review this report, then rerun with --execute to apply.')
    return
  }

  if (preservedAdminTaskerIds.length > 0) {
    await Tasker.updateMany(
      { _id: { $in: preservedAdminTaskerIds } },
      {
        $set: {
          isSettlementAdminSuspended: true,
          settlementAdminSuspendedAt: new Date(),
          isSettlementSuspended: true,
        },
      }
    )
  }

  const normalized = await normalizeNonPayableSettlementOrders()
  let reinstatedTaskers = 0
  for (const taskerId of taskerIds) {
    const before = await Tasker.findById(taskerId).select('isSettlementSuspended').lean()
    const after = await syncTaskerSettlementStatus(taskerId)
    if (before?.isSettlementSuspended && !after.isSettlementSuspended) reinstatedTaskers += 1
  }

  console.info('[Settlement reconciliation complete]', {
    correctedOrders: normalized.modifiedCount,
    reconciledTaskers: taskerIds.size,
    reinstatedTaskers,
  })
}

main()
  .catch(error => {
    console.error('[Settlement reconciliation failed]', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
