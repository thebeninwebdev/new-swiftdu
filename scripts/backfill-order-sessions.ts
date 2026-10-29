import { connectDB } from '@/lib/db'
import { AcademicSession } from '@/models/academic-session'
import { Order } from '@/models/order'
import type { AnyBulkWriteOperation } from 'mongoose'
import type { IOrder } from '@/models/order'

const apply = process.argv.includes('--apply')
const requestedBatchSize = Number(process.argv.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] || 500)
const batchSize = Number.isInteger(requestedBatchSize)
  ? Math.min(2_000, Math.max(1, requestedBatchSize))
  : 500

async function main() {
  await connectDB()
  const sessions = await AcademicSession.find()
    .select('_id name startDate endDate')
    .sort({ startDate: 1 })
    .lean()

  const counts = { scanned: 0, matched: 0, updated: 0, ambiguous: 0, unmatched: 0 }
  let operations: Array<AnyBulkWriteOperation<IOrder>> = []

  async function flush() {
    if (!operations.length) return
    if (apply) {
      const result = await Order.bulkWrite(operations, { ordered: false })
      counts.updated += result.modifiedCount
    }
    operations = []
  }

  const cursor = Order.find({ $or: [{ sessionId: { $exists: false } }, { sessionId: null }] })
    .select('_id createdAt')
    .lean()
    .cursor()

  for await (const order of cursor) {
    counts.scanned += 1
    const matches = sessions.filter(
      (session) => order.createdAt >= session.startDate && order.createdAt <= session.endDate
    )
    if (matches.length === 0) {
      counts.unmatched += 1
      continue
    }
    if (matches.length > 1) {
      counts.ambiguous += 1
      continue
    }
    counts.matched += 1
    const session = matches[0]
    operations.push({
      updateOne: {
        filter: { _id: order._id, $or: [{ sessionId: { $exists: false } }, { sessionId: null }] },
        update: { $set: { sessionId: session._id, sessionName: session.name } },
      },
    })
    if (operations.length >= batchSize) await flush()
  }
  await flush()

  console.info('[backfill-order-sessions]', {
    mode: apply ? 'apply' : 'dry-run',
    batchSize,
    ...counts,
    wouldUpdate: apply ? undefined : counts.matched,
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[backfill-order-sessions] failed', error instanceof Error ? error.message : error)
    process.exit(1)
  })
