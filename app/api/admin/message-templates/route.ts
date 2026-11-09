import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getAdminDashboardAccess } from '@/lib/admin-access'
import MessageTemplate from '@/models/message-template'
import { validateTemplateBody } from '@/lib/whatsapp/message-templates'
import { seedDefaultTemplatesIfEmpty } from '@/lib/whatsapp/message-templates-server'

export async function GET(request: NextRequest) {
  try {
    const access = await getAdminDashboardAccess(request.headers)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()
    await seedDefaultTemplatesIfEmpty()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const active = searchParams.get('active')
    const orderType = searchParams.get('orderType')

    const filter: Record<string, any> = {}
    if (category && category !== 'all') {
      filter.category = category
    }
    if (active === 'true') {
      filter.isActive = true
    } else if (active === 'false') {
      filter.isActive = false
    }
    if (orderType && orderType !== 'all') {
      filter.orderTypes = { $in: ['all', orderType] }
    }

    const templates = await MessageTemplate.find(filter)
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean()

    return NextResponse.json({ templates }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[GET /api/admin/message-templates]', error)
    return NextResponse.json(
      { error: 'Failed to fetch message templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getAdminDashboardAccess(request.headers)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json().catch(() => ({}))
    const {
      title,
      description,
      category = 'general',
      body: templateBody,
      orderTypes = ['all'],
      applicableStates = ['all'],
      requiresPaymentVerification = false,
      paymentType = 'none',
      displayOrder,
      isActive = true,
    } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    if (!templateBody || typeof templateBody !== 'string' || !templateBody.trim()) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
    }

    // Validate variables in template body
    const validation = validateTemplateBody(templateBody)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Template body contains invalid or unauthorized variables.',
          details: validation.errors,
        },
        { status: 400 }
      )
    }

    // Determine default display order if not provided
    let calculatedOrder = Number(displayOrder)
    if (isNaN(calculatedOrder)) {
      const highest = await MessageTemplate.findOne().sort({ displayOrder: -1 }).select('displayOrder')
      calculatedOrder = (highest?.displayOrder || 0) + 1
    }

    const template = await MessageTemplate.create({
      title: title.trim(),
      description: description.trim(),
      category,
      body: templateBody.trim(),
      orderTypes: Array.isArray(orderTypes) && orderTypes.length > 0 ? orderTypes : ['all'],
      applicableStates: Array.isArray(applicableStates) && applicableStates.length > 0 ? applicableStates : ['all'],
      requiresPaymentVerification: Boolean(requiresPaymentVerification),
      paymentType,
      displayOrder: calculatedOrder,
      isActive: Boolean(isActive),
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/message-templates]', error)
    return NextResponse.json(
      { error: 'Failed to create message template' },
      { status: 500 }
    )
  }
}
