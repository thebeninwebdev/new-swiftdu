import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Support from '@/models/support'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const { action } = await req.json()
    const { id } = await context.params

    if (!['start', 'resolve', 'close'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updateData: any = {
      updatedAt: new Date(),
      status:
        action === 'start'
          ? 'in_progress'
          : action === 'resolve'
          ? 'resolved'
          : 'closed'
    }

    const ticket = await Support.findByIdAndUpdate(id, updateData, { new: true })

    if (!ticket) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 })
    }

    return NextResponse.json(ticket)

  } catch (error) {
    console.error('[PATCH /api/admin/support/[id]]', error)
    return NextResponse.json({ error: 'Failed to update support ticket' }, { status: 500 })
  }
}