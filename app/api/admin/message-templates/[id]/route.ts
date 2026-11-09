import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getAdminDashboardAccess } from '@/lib/admin-access'
import MessageTemplate from '@/models/message-template'
import { validateTemplateBody } from '@/lib/whatsapp/message-templates'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getAdminDashboardAccess(request.headers)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    await connectDB()

    const template = await MessageTemplate.findById(id)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('[GET /api/admin/message-templates/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getAdminDashboardAccess(request.headers)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    await connectDB()

    const template = await MessageTemplate.findById(id)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      template.title = body.title.trim()
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || !body.description.trim()) {
        return NextResponse.json({ error: 'Description cannot be empty' }, { status: 400 })
      }
      template.description = body.description.trim()
    }

    if (body.body !== undefined) {
      if (typeof body.body !== 'string' || !body.body.trim()) {
        return NextResponse.json({ error: 'Message body cannot be empty' }, { status: 400 })
      }
      const validation = validateTemplateBody(body.body)
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Template body contains invalid or unauthorized variables.',
            details: validation.errors,
          },
          { status: 400 }
        )
      }
      template.body = body.body.trim()
    }

    if (body.category !== undefined) {
      template.category = body.category
    }

    if (Array.isArray(body.orderTypes)) {
      template.orderTypes = body.orderTypes.length > 0 ? body.orderTypes : ['all']
    }

    if (Array.isArray(body.applicableStates)) {
      template.applicableStates = body.applicableStates.length > 0 ? body.applicableStates : ['all']
    }

    if (body.requiresPaymentVerification !== undefined) {
      template.requiresPaymentVerification = Boolean(body.requiresPaymentVerification)
    }

    if (body.paymentType !== undefined) {
      template.paymentType = body.paymentType
    }

    if (typeof body.displayOrder === 'number') {
      template.displayOrder = body.displayOrder
    }

    if (typeof body.isActive === 'boolean') {
      template.isActive = body.isActive
    }

    await template.save()

    return NextResponse.json({ template })
  } catch (error) {
    console.error('[PATCH /api/admin/message-templates/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getAdminDashboardAccess(request.headers)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    await connectDB()

    const template = await MessageTemplate.findByIdAndDelete(id)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, deletedId: id })
  } catch (error) {
    console.error('[DELETE /api/admin/message-templates/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
