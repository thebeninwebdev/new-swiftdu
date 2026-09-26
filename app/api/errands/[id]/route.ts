import { NextRequest, NextResponse } from 'next/server'
import { currentTasker, WorkError } from '@/lib/tasker-work-server'
import { Order } from '@/models/order'
import { getTaskerOrderModeFilter } from '@/lib/test-orders'
import { TASKER_SEARCH_TIMEOUT_MS } from '@/lib/order-tracking'

// Preview exposes task instructions, never customer identity/contact or payment credentials.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tasker = await currentTasker(request.headers)
    if (!tasker.isVerified || tasker.isRejected) throw new WorkError('Your tasker account needs approval.', 403)
    const { id } = await params
    const order = await Order.findOne({ _id: id, status: 'pending', createdAt: { $gt: new Date(Date.now() - TASKER_SEARCH_TIMEOUT_MS) }, ...getTaskerOrderModeFilter(tasker) })
      .select('taskType description amount commission taskerFee platformFee totalAmount store location packaging restaurantPeopleCount restaurantTakeawayCount restaurantPackagingFee cafeInquiry cafeInquiryStatus cafeInquiryDetailsSubmitted indomiePacks eggCount noteSize numberOfPages printingServiceType printingNeedsEditing copyNotesType copyNotesPages deadline dueDate deadlineDate deadlineValue deadlineUnit serviceFeeDiscountApplied discountCommissionAmount status createdAt isTestOrder')
      .lean()
    if (!order) throw new WorkError('This task is no longer available. Choose another task.', 409)
    return NextResponse.json(order, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof WorkError ? error.message : 'Could not load this task.' }, { status: error instanceof WorkError ? error.status : 500 })
  }
}
