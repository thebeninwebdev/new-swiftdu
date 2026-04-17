import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Taskers no longer pay platform fees from the app. Customer checkout is collected through Flutterwave and settlements are handled internally.',
    },
    { status: 410 }
  )
}
