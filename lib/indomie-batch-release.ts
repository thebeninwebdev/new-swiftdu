import { IndomieBatch } from '@/models/indomie-batch'
import { Order } from '@/models/order'
import { BATCH_MAX_ORDERS, getIndomieBatchWindow, indomieBatchGroupKey, normalizeBatchDestination, normalizeIndomiePickup, splitIndomieBatchSizes } from '@/lib/indomie-batching'
import { getOrderRestriction } from '@/lib/delivery-policy'
import { emitOrderUpdated } from '@/lib/socket'
import { getIndomieBatchSettings } from '@/lib/indomie-batch-settings'

/** Idempotent materialization called from tasker/customer reads; no scheduler is required. */
export async function releaseDueIndomieBatches(now = new Date()) {
  // New scheduled orders are reserved against a compatible Live tasker at booking
  // time. At departure they simply enter that tasker's normal task workflow;
  // they are never offered for a second manual batch acceptance.
  const reserved = await Order.find({ taskType: 'indomie', batchingStatus: 'waiting', status: 'pending', taskerId: { $nin: [null, ''] }, batchWindowEnd: { $lte: now } })
  for (const order of reserved) {
    order.status = 'in_progress'
    order.batchingStatus = 'batched'
    order.batchStatus = 'dispatched'
    order.taskerSearchStartedAt = now
    await order.save()
    emitOrderUpdated(order)
  }
  const due = await Order.find({ taskType: 'indomie', batchingStatus: 'waiting', status: 'pending', batchWindowEnd: { $lte: now }, taskerId: { $in: [null, ''] } }).sort({ createdAt: 1 })
  const groups = new Map<string, typeof due>()
  for (const order of due) { if (!order.batchWindowStart) continue; const key = indomieBatchGroupKey(order, order.batchWindowStart); groups.set(key, [...(groups.get(key) || []), order]) }
  for (const [key, orders] of groups) {
    let offset = 0
    for (const size of splitIndomieBatchSizes(orders.length)) {
      const members = orders.slice(offset, offset + size); offset += size
      if (size === 1) {
        const order = members[0]
        const released = await Order.findOneAndUpdate({ _id: order._id, batchingStatus: 'waiting', status: 'pending' }, { $set: { batchingStatus: 'released_single', taskerSearchStartedAt: now } }, { new: true })
        if (released) emitOrderUpdated(released)
        continue
      }
      const first = members[0]
      const batch = await IndomieBatch.create({ windowStart: first.batchWindowStart, windowEnd: first.batchWindowEnd, groupKey: key, destinationKey: normalizeBatchDestination(first.location), destinationLabel: first.location, pickupKey: normalizeIndomiePickup(first.store), taskerGenderRestriction: getOrderRestriction(first) || 'any', orderIds: members.map(x => String(x._id)), orderCount: size, status: 'available', isTestBatch: first.isTestOrder === true, createdInMode: first.createdInMode, availableAt: now })
      const claimed = await Order.updateMany({ _id: { $in: members.map(x => x._id) }, batchingStatus: 'waiting', status: 'pending' }, { $set: { batchId: String(batch._id), batchingStatus: 'batched', taskerSearchStartedAt: now } })
      if (claimed.modifiedCount !== size) { await IndomieBatch.deleteOne({ _id: batch._id }); continue }
      for (const order of members) emitOrderUpdated({ ...order.toObject(), batchId: String(batch._id) })
    }
  }
}
export async function batchingMetadata(taskType: string, now = new Date()) {
  const window = taskType === 'indomie' ? getIndomieBatchWindow(now, await getIndomieBatchSettings()) : null
  return window ? { batchingStatus: 'waiting' as const, batchStatus: 'booked' as const, batchWindowStart: window.start, batchWindowEnd: window.end, scheduledFor: window.end } : { taskerSearchStartedAt: now }
}
