import { NextRequest, NextResponse } from 'next/server';

import { connectDB } from '@/lib/db';
import { emitOrderUpdated } from '@/lib/socket';
import { Order } from '@/models/order';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();

    const { token } = await params;
    const order = await Order.findOne({ trackingToken: token, source: 'whatsapp' });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.taskerId) {
      return NextResponse.json(
        { error: 'A tasker must accept this order before you can confirm payment.' },
        { status: 400 }
      );
    }

    if (order.status === 'cancelled' || order.status === 'completed') {
      return NextResponse.json({ error: 'This order is no longer active.' }, { status: 400 });
    }

    if (order.isDeclinedTask) {
      return NextResponse.json(
        {
          error:
            order.declinedMessage ||
            'This transfer is under review. SwiftDU support will contact you.',
        },
        { status: 400 }
      );
    }

    if (order.cafeInquiry && !order.cafeInquiryFeePaid) {
      order.cafeInquiryFeePaid = true;
      order.paymentProvider = 'manual_transfer';
      order.paymentStatus = 'unpaid';
      order.paymentVerifiedAt = new Date();
      order.customerTransferredAt = new Date();
      order.paymentFailureReason = undefined;
      await order.save();

      emitOrderUpdated(order);

      return NextResponse.json({ ok: true });
    }

    if (order.hasPaid && order.paymentStatus === 'paid') {
      return NextResponse.json({ ok: true });
    }

    order.hasPaid = true;
    order.isDeclinedTask = false;
    order.declinedAt = undefined;
    order.declinedReason = undefined;
    order.declinedMessage = undefined;
    order.declinedByTaskerAt = undefined;
    order.paymentProvider = 'manual_transfer';
    order.paymentStatus = 'paid';
    order.paymentVerifiedAt = new Date();
    order.customerTransferredAt = new Date();
    order.paidAt = new Date();
    order.paymentFailureReason = undefined;
    await order.save();

    emitOrderUpdated(order);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[POST /api/public/orders/[token]/confirm-transfer]', error);
    return NextResponse.json({ error: 'Failed to confirm transfer.' }, { status: 500 });
  }
}
