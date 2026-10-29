import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return new NextResponse(
    'SwiftDU WhatsApp webhook moved to https://sammy.swiftdu.org/whatsapp/webhook',
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json({
    ok: true,
    disabled: true,
    movedTo: 'https://sammy.swiftdu.org/whatsapp/webhook',
  });
}
