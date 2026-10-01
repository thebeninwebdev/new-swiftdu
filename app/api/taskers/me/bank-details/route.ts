import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user'
import Tasker from '@/models/tasker'
import { BankDetailsError, parseBankAccount, resolvePaystackBankAccount } from '@/lib/paystack'

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in to update your bank details.' }, { status: 401 })
    }

    const input = parseBankAccount(await request.json().catch(() => null))

    await connectDB()
    const user = await User.findById(session.user.id).select('role taskerId').lean()
    if (!user || user.role !== 'tasker') {
      return NextResponse.json({ error: 'Only taskers can update bank details.' }, { status: 403 })
    }

    let tasker = await Tasker.findOne({ userId: user._id })
    if (!tasker && user.taskerId && Types.ObjectId.isValid(String(user.taskerId))) {
      tasker = await Tasker.findOne({ _id: user.taskerId, $or: [{ userId: user._id }, { userId: null }] })
    }
    if (!tasker) {
      return NextResponse.json({ error: 'Tasker profile not found.' }, { status: 404 })
    }

    tasker.bankDetails = await resolvePaystackBankAccount(input)
    await tasker.save()
    return NextResponse.json({ bankDetails: tasker.bankDetails })
  } catch (error) {
    if (error instanceof BankDetailsError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not save your bank details. Please try again.' }, { status: 500 })
  }
}
