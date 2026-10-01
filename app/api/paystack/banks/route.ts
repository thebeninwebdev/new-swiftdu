import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BankDetailsError, listPaystackBanks } from '@/lib/paystack'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
    return NextResponse.json({ banks: await listPaystackBanks() }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: 'Could not load banks. Please try again.' }, {
      status: error instanceof BankDetailsError ? error.status : 500,
    })
  }
}
