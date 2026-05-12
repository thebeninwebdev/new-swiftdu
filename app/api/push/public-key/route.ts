import { NextResponse } from 'next/server'

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()

  if (!publicKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { publicKey },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    }
  )
}
