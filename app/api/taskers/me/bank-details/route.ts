import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user'
import Tasker from '@/models/tasker'

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in to update your bank details.' }, { status: 401 })
    }

    const { bankName, accountNumber, accountName } = await request.json() as Record<string, unknown>
    const details = {
      bankName: String(bankName || '').trim(),
      accountNumber: String(accountNumber || '').replace(/\D/g, ''),
      accountName: String(accountName || '').trim(),
    }

    if (!details.bankName || !/^\d{10}$/.test(details.accountNumber) || !details.accountName) {
      return NextResponse.json({ error: 'Enter your bank name, 10-digit account number, and account name.' }, { status: 400 })
    }

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

    tasker.bankDetails = details
    await tasker.save()
    return NextResponse.json({ bankDetails: tasker.bankDetails })
  } catch (error) {
    console.error('[PATCH /api/taskers/me/bank-details]', error)
    return NextResponse.json({ error: 'Could not save your bank details. Please try again.' }, { status: 500 })
  }
}
