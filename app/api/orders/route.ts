import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/order';
import { auth } from '@/lib/auth';

async function verifyPaystackPayment(reference: string, expectedAmount: number): Promise<boolean> {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();

    // Ensure payment was successful and amount matches (Paystack returns amount in kobo)
    const amountInKobo = Math.round(expectedAmount * 100);
    return (
      data.status === true &&
      data.data?.status === 'success' &&
      data.data?.amount === amountInKobo &&
      data.data?.currency === 'NGN'
    );
  } catch (error) {
    console.error('[Paystack Verify Error]:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const {
      taskType,
      description,
      amount,
      deadlineValue,
      deadlineUnit,
      location,
      store,
      packaging,
      paymentReference,
    } = body;

    // Validation
    if (!taskType || !description || !amount || !deadlineValue || !deadlineUnit || !location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!paymentReference) {
      return NextResponse.json(
        { error: 'Payment reference is required' },
        { status: 400 }
      );
    }

    // Prevent duplicate orders with the same payment reference
    const existingOrder = await Order.findOne({ paymentReference });
    if (existingOrder) {
      return NextResponse.json(
        { error: 'This payment has already been used' },
        { status: 409 }
      );
    }

    // Verify payment with Paystack before creating the order
    const parsedAmount = parseFloat(amount);
let isPaymentValid = true;

// Only verify in production
if (process.env.NODE_ENV === 'production') {
  isPaymentValid = await verifyPaystackPayment(paymentReference, parsedAmount);
}

if (!isPaymentValid) {
  return NextResponse.json(
    { error: 'Payment verification failed. Please contact support.' },
    { status: 402 }
  );
}

    const order = new Order({
      userId: session.user.id,
      taskType,
      description,
      amount: parsedAmount,
      deadlineValue: parseInt(deadlineValue),
      deadlineUnit,
      location,
      store: store || undefined,
      packaging: packaging || undefined,
      paymentReference,
      paymentStatus: 'paid',
      status: 'pending',
    });

    await order.save();

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('[Orders POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await Order.find({ userId: session.user.id }).sort({
      createdAt: -1,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('[Orders GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}