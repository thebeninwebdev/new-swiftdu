import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Standalone test order creation has been removed. Turn on Test Order Mode from the EXCO user dashboard, then create a normal order.',
    },
    { status: 410 }
  )
}
