import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import mongoose from 'mongoose'

const indexName = 'userId_1_idempotencyKey_1'

async function main() {
  await connectDB()
  const indexes = await Order.collection.indexes()
  const current = indexes.find((index) => index.name === indexName)
  const partialFilterExpression = { idempotencyKey: { $type: 'string' } }
  const alreadyMigrated = current?.unique === true &&
    JSON.stringify(current.partialFilterExpression) === JSON.stringify(partialFilterExpression)

  if (!alreadyMigrated) {
    if (current) await Order.collection.dropIndex(indexName)
    await Order.collection.createIndex(
      { userId: 1, idempotencyKey: 1 },
      { name: indexName, unique: true, partialFilterExpression }
    )
  }

  console.info('[migrate-order-idempotency-index]', { changed: !alreadyMigrated })
  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error('[migrate-order-idempotency-index] failed', error instanceof Error ? error.message : error)
  await mongoose.disconnect()
  process.exitCode = 1
})