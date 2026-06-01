import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

import clientPromise from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db()
    const passwordExistsQuery = { $exists: true, $nin: [null, ''] }
    const accountLookupConditions: Record<string, unknown>[] = [
      { userId: session.user.id },
    ]
    const userLookupConditions: Record<string, unknown>[] = [
      { id: session.user.id },
    ]

    if (session.user.email) {
      userLookupConditions.push({ email: session.user.email })
    }

    if (ObjectId.isValid(session.user.id)) {
      const userObjectId = new ObjectId(session.user.id)
      accountLookupConditions.push({ userId: userObjectId })
      userLookupConditions.push({ _id: userObjectId })
    }

    const [credentialAccount, userWithPassword] = await Promise.all([
      db.collection('account').findOne(
        {
          $or: accountLookupConditions,
          providerId: 'credential',
          password: passwordExistsQuery,
        },
        { projection: { _id: 1 } }
      ),
      db.collection('user').findOne(
        {
          $or: userLookupConditions,
          password: passwordExistsQuery,
        },
        { projection: { _id: 1 } }
      ),
    ])

    return NextResponse.json({
      hasPassword: Boolean(credentialAccount || userWithPassword),
    })
  } catch (error) {
    console.error('[Password Status GET Error]:', error)
    return NextResponse.json(
      { error: 'Failed to check password status.' },
      { status: 500 }
    )
  }
}
