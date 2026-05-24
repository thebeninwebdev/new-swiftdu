import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { maskWhatsAppPhone } from '@/lib/whatsapp/registration';
import { sendWhatsAppWelcomeMenu } from '@/lib/whatsapp/send-message';
import { User } from '@/models/user';
import { WhatsAppRegistration } from '@/models/whatsapp-registration';

export const runtime = 'nodejs';

async function findRegistration(token: string) {
  return WhatsAppRegistration.findOne({ token }).lean();
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Registration token is required.' }, { status: 400 });
    }

    await connectDB();

    const registration = await findRegistration(token);

    if (!registration) {
      return NextResponse.json({ error: 'This WhatsApp registration link is invalid.' }, { status: 404 });
    }

    return NextResponse.json({
      phone: maskWhatsAppPhone(registration.phone),
      status: registration.status,
    });
  } catch (error) {
    console.error('[WhatsApp Registration GET Error]:', error);
    return NextResponse.json({ error: 'Failed to load WhatsApp registration.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Log in to your SwiftDU account before linking WhatsApp.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'Registration token is required.' }, { status: 400 });
    }

    await connectDB();

    const [registration, user] = await Promise.all([
      WhatsAppRegistration.findOne({ token }),
      User.findById(session.user.id).select('_id name email isSuspended').lean(),
    ]);

    if (!registration) {
      return NextResponse.json({ error: 'This WhatsApp registration link is invalid.' }, { status: 404 });
    }

    if (!user || user.isSuspended) {
      return NextResponse.json({ error: 'Your SwiftDU account cannot link WhatsApp right now.' }, { status: 403 });
    }

    const wasAlreadyLinkedToUser =
      registration.status === 'linked' && registration.userId === session.user.id;

    await WhatsAppRegistration.updateMany(
      {
        userId: session.user.id,
        _id: { $ne: registration._id },
      },
      {
        $set: { status: 'pending' },
        $unset: { userId: '', linkedAt: '' },
      }
    );

    registration.userId = session.user.id;
    registration.status = 'linked';
    registration.linkedAt = new Date();
    await registration.save();

    if (!wasAlreadyLinkedToUser) {
      try {
        await sendWhatsAppWelcomeMenu(registration.phone, user.name || registration.name);
      } catch (error) {
        console.error('[WhatsApp Registration Welcome Send Error]:', error);
      }
    }

    return NextResponse.json({
      ok: true,
      phone: maskWhatsAppPhone(registration.phone),
      status: registration.status,
    });
  } catch (error) {
    console.error('[WhatsApp Registration POST Error]:', error);
    return NextResponse.json({ error: 'Failed to link WhatsApp.' }, { status: 500 });
  }
}
