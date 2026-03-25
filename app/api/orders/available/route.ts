import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import {Order} from "@/models/order"
import {auth} from '@/lib/auth'; 

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Get the session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all pending tasks that don't belong to the current user
    const availableTasks = await Order.find({
      status: 'pending',
      // userId: { $ne: session.user.id }, // Exclude user's own tasks
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(availableTasks);
  } catch (error) {
    console.error('[Available Tasks GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available tasks' },
      { status: 500 }
    );
  }
}
