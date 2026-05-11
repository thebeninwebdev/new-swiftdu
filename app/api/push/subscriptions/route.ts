import { NextResponse } from 'next/server'

function pushEngageResponse() {
  return NextResponse.json(
    { error: 'PushEngage now manages push subscriptions.' },
    { status: 410 }
  )
}

export async function POST() {
  return pushEngageResponse()
}

export async function DELETE() {
  return pushEngageResponse()
}
