import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'PushEngage now manages push subscriptions.' },
    { status: 410 }
  )
}
