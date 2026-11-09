import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getAdminDashboardAccess } from '@/lib/admin-access'
import MessageTemplate from '@/models/message-template'

export async function POST(request: NextRequest) {
  try {
    const access = await getAdminDashboardAccess(request.headers)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()
    const body = await request.json().catch(() => ({}))

    // Supports { templateIds: string[] } where array order dictates displayOrder
    // OR { items: { id: string, displayOrder: number }[] }
    if (Array.isArray(body.templateIds)) {
      const updates = body.templateIds.map((id: string, index: number) =>
        MessageTemplate.findByIdAndUpdate(id, { displayOrder: index + 1 })
      )
      await Promise.all(updates)
    } else if (Array.isArray(body.items)) {
      const updates = body.items.map((item: { id: string; displayOrder: number }) =>
        MessageTemplate.findByIdAndUpdate(item.id, { displayOrder: item.displayOrder })
      )
      await Promise.all(updates)
    } else {
      return NextResponse.json(
        { error: 'Provide templateIds array or items array with id and displayOrder.' },
        { status: 400 }
      )
    }

    const templates = await MessageTemplate.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean()

    return NextResponse.json({ ok: true, templates })
  } catch (error) {
    console.error('[POST /api/admin/message-templates/reorder]', error)
    return NextResponse.json(
      { error: 'Failed to reorder templates' },
      { status: 500 }
    )
  }
}
