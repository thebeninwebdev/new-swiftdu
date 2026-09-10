import { NextRequest, NextResponse } from 'next/server'
import { transitionCafeInquiry } from '@/lib/cafe-inquiry-server'
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { return await transitionCafeInquiry(request, (await params).id, 'checking') }
  catch (error) { console.error('[Cafe inquiry checking]', error); return NextResponse.json({ error: 'Unable to update cafe request.' }, { status: 500 }) }
}
