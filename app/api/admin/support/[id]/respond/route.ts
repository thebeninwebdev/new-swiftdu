import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Support from '@/models/support'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const { response } = await req.json()
    const { id } = await context.params

    if (!response || !response.trim()) {
      return NextResponse.json(
        { error: 'Response message is required' },
        { status: 400 }
      )
    }

    const ticket = await Support.findByIdAndUpdate(
      id,
      {
        adminResponse: response.trim(),
        adminRespondedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    )

    if (!ticket) {
      return NextResponse.json(
        { error: 'Support ticket not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(ticket)

  } catch (error) {
    console.error('[POST /api/admin/support/[id]/respond]', error)
    return NextResponse.json(
      { error: 'Failed to send response' },
      { status: 500 }
    )
  }
}