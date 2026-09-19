import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { expireUnmatchedOrder } from '@/lib/order-search-expiry'
import { Order } from '@/models/order'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { id } = await params
    const order = await expireUnmatchedOrder(id, session.user.id)

    if (order) {
      return NextResponse.json(order)
    }

    const current = await Order.findById(id)
    if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (current.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Assignment, manual cancellation, and requests younger than seven minutes
    // all leave the order untouched. The current record tells the client what won.
    return NextResponse.json(current, { status: 409 })
  } catch (error) {
    console.error('[Order search timeout error]:', error)
    return NextResponse.json({ error: 'Unable to check search timeout' }, { status: 500 })
  }
}
