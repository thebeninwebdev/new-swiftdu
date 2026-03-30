import { Order } from '@/models/order';
import {connectDB} from '@/lib/db';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  await connectDB();
    const session = await auth.api.getSession({
    headers: req.headers,
  });
  
  if (!session || !session.user || !session.user.taskerId) {
    return NextResponse.json({ orders: [] });
  }
  const taskerId = session.user.taskerId;
  const unpaidOrders = await Order.find({ taskerId, taskerHasPaid: false });
  return NextResponse.json({ orders: unpaidOrders });
}
