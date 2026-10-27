import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { expireStaleUnmatchedOrders } from '@/lib/order-search-expiry'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectDB()
    return NextResponse.json(await expireStaleUnmatchedOrders())
  } catch (error) {
    console.error('[Order expiry cleanup error]:', error)
    return NextResponse.json({ error: 'Unable to expire stale orders' }, { status: 500 })
  }
}
