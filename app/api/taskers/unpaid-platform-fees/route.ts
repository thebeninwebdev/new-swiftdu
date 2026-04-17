import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  })

  if (!session?.user?.taskerId) {
    return NextResponse.json({ orders: [] })
  }

  return NextResponse.json({ orders: [] })
}
