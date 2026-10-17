import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { auth } from '@/lib/auth'
import { IndomieBatch } from '@/models/indomie-batch'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connectDB(); const session = await auth.api.getSession({ headers: request.headers }); if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params; const { orderId } = await request.json()
  const batch = await IndomieBatch.findOne({ _id: id, acceptedBy: session.user.id, status: 'in_progress', orderIds: orderId })
  if (!batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 })
  const picked = [...new Set([...batch.pickedUpOrderIds, String(orderId)])]; batch.pickedUpOrderIds = picked
  if (picked.length === batch.orderCount) batch.pickupCompletedAt = new Date()
  await batch.save(); return NextResponse.json(batch)
}
