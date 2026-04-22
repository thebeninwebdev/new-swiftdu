import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Customer checkout now happens by direct transfer to the assigned tasker. Flutterwave customer payments are no longer used.',
    },
    { status: 410 }
  )
}
