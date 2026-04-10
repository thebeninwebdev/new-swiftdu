import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { calculateTaskerStats } from '@/lib/tasker-stats';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const taskerId = req.nextUrl.searchParams.get('taskerId');
    if (!taskerId) {
      return NextResponse.json({ error: 'taskerId is required' }, { status: 400 });
    }

    const stats = await calculateTaskerStats(taskerId);

    return NextResponse.json({
      completedTasks: stats.completedTasks,
      rating: stats.rating,
    });
  } catch (error) {
    console.error('Error fetching tasker stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
