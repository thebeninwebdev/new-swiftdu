import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BankDetailsError, resolvePaystackBankAccount } from '@/lib/paystack'

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
    const body: unknown = await request.json().catch(() => null)
    const details = await resolvePaystackBankAccount(body)
    return NextResponse.json({ success: true, accountName: details.accountName }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof BankDetailsError ? error.message : 'Could not verify your account. Please try again.' }, {
      status: error instanceof BankDetailsError ? error.status : 500,
    })
  }
}
