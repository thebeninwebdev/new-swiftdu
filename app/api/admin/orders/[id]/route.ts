import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import { emitOrderUpdated } from '@/lib/socket'

// ─── PATCH /api/admin/orders/[id] ───────────────────────────────────────────
// Update order status (cancel, complete).
// Restricted to admin role only.

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin auth check
    // const session = await authClient.getSession()
    // const user = session?.data?.user
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    // }

    await connectDB()

    const { id } = await context.params;
    const { action } = await req.json()

    if (!['cancel', 'complete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    const updateData: any = {
      updatedAt: new Date()
    }

    if (action === 'cancel') {
      updateData.status = 'cancelled'
    } else if (action === 'complete') {
      updateData.status = 'completed'
    }

    const order = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    emitOrderUpdated(order)

    return NextResponse.json(order)

  } catch (error) {
    console.error('[PATCH /api/admin/orders/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}
