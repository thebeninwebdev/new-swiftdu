import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { auth } from '@/lib/auth'
import { Order } from '@/models/order'
import { User } from '@/models/user'
import Tasker from '@/models/tasker'
import {
  MessageTemplate,
  IMessageTemplate,
} from '@/models/message-template'
import {
  renderTemplate,
  isTemplateApplicable,
  type MessageContext,
} from '@/lib/whatsapp/message-templates'
import { seedDefaultTemplatesIfEmpty } from '@/lib/whatsapp/message-templates-server'
import { getAdminDashboardAccess } from '@/lib/admin-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await connectDB()

    const order = await Order.findById(id)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check authorization: Admin OR assigned Tasker
    const adminAccess = await getAdminDashboardAccess(request.headers)
    let isAuthorized = Boolean(adminAccess)
    let currentTasker: any = null

    if (!isAuthorized) {
      // Find tasker profile for the current user
      currentTasker = await Tasker.findOne({
        $or: [
          { userId: session.user.id },
          ...(session.user.taskerId ? [{ _id: session.user.taskerId }] : []),
        ],
      })

      if (!currentTasker) {
        return NextResponse.json(
          { error: 'You must be an approved tasker to access customer messaging.' },
          { status: 403 }
        )
      }

      if (currentTasker.isSettlementSuspended) {
        return NextResponse.json(
          { error: 'Your tasker account is suspended for overdue settlements.' },
          { status: 403 }
        )
      }

      const taskerIdStr = currentTasker._id.toString()
      const isAssigned =
        order.taskerId === taskerIdStr ||
        (session.user.taskerId && order.taskerId === session.user.taskerId)

      if (!isAssigned) {
        return NextResponse.json(
          { error: 'You are not assigned to contact the customer for this order.' },
          { status: 403 }
        )
      }

      isAuthorized = true
    }

    if (!currentTasker && session.user.taskerId) {
      currentTasker = await Tasker.findById(session.user.taskerId)
    }

    // Fetch customer details securely
    let customerName = order.customerName || 'Customer'
    let customerPhone = order.customerPhone || ''

    if (order.userId) {
      const customerUser = await User.findById(order.userId).select('name phone')
      if (customerUser) {
        customerName = customerUser.name || customerName
        customerPhone = customerUser.phone || customerPhone
      }
    }

    // Determine verified amounts
    const isCafeInquiry = Boolean(order.cafeInquiry)
    const hasPaid = Boolean(order.hasPaid || order.paymentStatus === 'paid')
    const cafeInquiryFeePaid = Boolean(order.cafeInquiryFeePaid)

    let verifiedServiceFee: number | null = null
    let verifiedItemTotal: number | null = null
    let verifiedOutstandingAmount: number | null = null

    if (isCafeInquiry) {
      // Cafe inquiry fee
      const feeCandidate = order.serviceFee || order.commission || 0
      if (feeCandidate > 0) {
        verifiedServiceFee = feeCandidate
      }

      // Food items cost (if submitted / selected)
      const foodAmount = Number(order.amount || 0)
      if (foodAmount > 0) {
        verifiedItemTotal = foodAmount
      }
    } else {
      // Normal order
      if (!hasPaid) {
        const total = Number(order.totalAmount || (order.amount + (order.commission || 0)) || 0)
        if (total > 0) {
          verifiedOutstandingAmount = total
        }
      }
    }

    const taskerDisplayName =
      currentTasker?.fullName ||
      currentTasker?.firstName ||
      session.user.name ||
      'your SwiftDU tasker'

    const orderNumber = order._id.toString().slice(-6).toUpperCase()
    const deliveryLocation = [
      order.location,
      order.roomNumber ? `Room ${order.roomNumber}` : '',
    ]
      .filter(Boolean)
      .join(' - ')

    const storeDisplayName =
      order.store === 'tasker_choose' ? 'Any store' : order.store || 'the store'

    const context: MessageContext = {
      customerName,
      taskerName: taskerDisplayName,
      orderNumber,
      taskType: order.taskType,
      isCafeInquiry,
      cafeInquiryStatus: order.cafeInquiryStatus,
      orderStatus: order.status,
      hasPaid,
      cafeInquiryFeePaid,
      serviceFee: verifiedServiceFee,
      itemTotal: verifiedItemTotal,
      outstandingAmount: verifiedOutstandingAmount,
      deliveryLocation,
      storeName: storeDisplayName,
    }

    // Retrieve active templates from DB (or seed if empty)
    await seedDefaultTemplatesIfEmpty()
    const rawTemplates = await MessageTemplate.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean<IMessageTemplate[]>()

    // Filter applicable templates and render message bodies
    const applicableTemplates = rawTemplates
      .filter((tmpl) => isTemplateApplicable(tmpl, context))
      .map((tmpl) => ({
        id: (tmpl as any)._id.toString(),
        title: tmpl.title,
        description: tmpl.description,
        category: tmpl.category,
        body: tmpl.body,
        renderedMessage: renderTemplate(tmpl.body, context),
        displayOrder: tmpl.displayOrder,
        requiresPaymentVerification: tmpl.requiresPaymentVerification,
        paymentType: tmpl.paymentType,
      }))

    const taskerPreference = currentTasker?.whatsappAppPreference || 'ask_every_time'

    return NextResponse.json({
      order: {
        id: order._id.toString(),
        orderNumber,
        taskType: order.taskType,
        isCafeInquiry,
        orderStatus: order.status,
        cafeInquiryStatus: order.cafeInquiryStatus,
        hasPaid,
        cafeInquiryFeePaid,
        deliveryLocation,
        storeName: storeDisplayName,
        amounts: {
          serviceFee: verifiedServiceFee,
          itemTotal: verifiedItemTotal,
          outstandingAmount: verifiedOutstandingAmount,
        },
      },
      customer: {
        name: customerName,
        phone: customerPhone,
      },
      tasker: {
        name: taskerDisplayName,
        preference: taskerPreference,
      },
      templates: applicableTemplates,
    })
  } catch (error) {
    console.error('[GET /api/orders/[id]/messaging-context]', error)
    return NextResponse.json(
      { error: 'Failed to load messaging context.' },
      { status: 500 }
    )
  }
}
