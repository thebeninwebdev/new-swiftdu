import { connectDB } from '@/lib/db';
import Support from '@/models/support';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const taskerId = req.nextUrl.searchParams.get('taskerId');
    const status = req.nextUrl.searchParams.get('status');
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');

    if (!taskerId) {
      return NextResponse.json(
        { error: 'taskerId is required' },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { taskerId };

    if (status) {
      query.status = status;
    }

    const tickets = await Support.find(query)
      .skip(skip)
      .limit(limit)
      .populate('orderId', 'taskType amount')
      .sort({ createdAt: -1 });

    const total = await Support.countDocuments(query);

    return NextResponse.json({
      tickets,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch support tickets' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { taskerId, orderId, title, description, category, priority } =
      await req.json();

    // Validate input
    if (!taskerId || !title || !description || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (title.trim().length < 5) {
      return NextResponse.json(
        { error: 'Title must be at least 5 characters' },
        { status: 400 }
      );
    }

    if (description.trim().length < 20) {
      return NextResponse.json(
        { error: 'Description must be at least 20 characters' },
        { status: 400 }
      );
    }

    const support = new Support({
      taskerId,
      orderId: orderId || null,
      title,
      description,
      category,
      priority: priority || 'medium',
      status: 'open',
    });

    await support.save();

    return NextResponse.json(support, { status: 201 });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create support ticket' },
      { status: 500 }
    );
  }
}
