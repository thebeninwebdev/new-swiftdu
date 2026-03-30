import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';
import { auth } from '@/lib/auth'; 

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // Get the session
const session = await auth.api.getSession({
  headers: request.headers,
});

    if (!session || !session.user || session.user.role === "user" ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const user = await User.findById(id);

    if (!user) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }

    return NextResponse.json({
        name:user.name,
        phone: user.phone,
        email: user.email
    });
    
  } catch (error) {
    console.error('[Users GET by ID Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}