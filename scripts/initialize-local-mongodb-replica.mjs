// Local Windows development database only; never reads production credentials.
import { MongoClient } from 'mongodb'

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true', {
    serverSelectionTimeoutMS: 10000,
  })
  try {
    await client.connect()
    const admin = client.db('admin')
    const hello = await admin.command({ hello: 1 })
    if (hello.setName && hello.setName !== 'swiftdu-rs') {
      throw new Error('A different replica set already exists; no changes made.')
    }
    if (!hello.setName) {
      await admin.command({ replSetInitiate: {
        _id: 'swiftdu-rs', members: [{ _id: 0, host: 'localhost:27017' }],
      } })
    }
    const deadline = Date.now() + 30000
    while (!(await admin.command({ hello: 1 })).isWritablePrimary) {
      if (Date.now() >= deadline) throw new Error('Timed out waiting for the local replica set primary.')
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    // A read in a transaction reproduces the original failure without modifying app data.
    const session = client.startSession()
    try {
      await session.withTransaction(async () => {
        await client.db('swiftdu_transaction_check').collection('probe').findOne({}, { session })
      })
    } finally {
      await session.endSession()
    }
    console.log('Local MongoDB replica set swiftdu-rs is primary. Transaction check passed.')
  } finally {
    await client.close()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
