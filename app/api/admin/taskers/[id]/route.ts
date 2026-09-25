import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { normalizeExcoRole } from '@/lib/exco-constants'
import Tasker from '@/models/tasker'
import { completeTaskerAccountLink, issueTaskerOnboardingLink } from '@/lib/tasker-onboarding'
import { normalizeEmail } from '@/lib/email-normalization'
import { User } from '@/models/user'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    const excoRole = normalizeExcoRole(
      (session?.user as { excoRole?: string | null } | undefined)?.excoRole
    )

    if (
      !session?.user ||
      (session.user.role !== 'admin' &&
        excoRole !== 'COO' &&
        excoRole !== 'CFO' &&
        excoRole !== 'CTO')
    ) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    await connectDB()

    const { id } = await params
    const { action, bankDetails } = await req.json()

    if (action !== undefined && !['approve', 'reject', 'suspend', 'activate'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve", "reject", "suspend", or "activate".' },
        { status: 400 }
      )
    }

    if (
      action !== undefined &&
      session.user.role !== 'admin' &&
      excoRole !== 'COO'
    ) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const hasBankDetails = bankDetails !== undefined
    let nextBankDetails:
      | { bankName: string; accountNumber: string; accountName: string }
      | null = null

    if (action === undefined && !hasBankDetails) {
      return NextResponse.json(
        { error: 'Provide an approval action or bank details.' },
        { status: 400 }
      )
    }

    if (hasBankDetails) {
      nextBankDetails = {
        bankName: String(bankDetails?.bankName || '').trim(),
        accountNumber: String(bankDetails?.accountNumber || '').trim(),
        accountName: String(bankDetails?.accountName || '').trim(),
      }

      if (
        !nextBankDetails.bankName ||
        !/^\d{10}$/.test(nextBankDetails.accountNumber) ||
        !nextBankDetails.accountName
      ) {
        return NextResponse.json(
          { error: 'Provide a bank name, 10-digit account number, and account name.' },
          { status: 400 }
        )
      }
    }

    const tasker = await Tasker.findById(id).select(
      '+onboardingTokenHash +onboardingTokenExpiresAt +onboardingEmailSentAt +onboardingTokenUsedAt'
    )

    if (!tasker) {
      return NextResponse.json({ error: 'Tasker not found.' }, { status: 404 })
    }

    const wasApproved = tasker.isVerified && !tasker.isRejected

    if (action === 'approve') {
      tasker.isVerified = true
      tasker.isRejected = false
      if (!wasApproved) tasker.taskerMode = 'training'
    } else if (action === 'reject') {
      tasker.isVerified = false
      tasker.isRejected = true
    } else if (action === 'suspend') {
      tasker.isSettlementSuspended = true
      tasker.settlementSuspendedAt = new Date()
    } else if (action === 'activate') {
      tasker.isSettlementSuspended = false
      tasker.settlementSuspendedAt = null
    }

    if (nextBankDetails) {
      tasker.bankDetails = nextBankDetails
    }

    await tasker.save()

    let accountLinked = false
    if (action === 'approve') {
      const email = normalizeEmail(tasker.email)
      const existingUser = email ? await User.findOne({ email }) : null
      if (existingUser && existingUser.role !== 'admin') {
        try {
          await completeTaskerAccountLink(tasker, existingUser.id)
          accountLinked = true
        } catch (linkError) {
          console.error('[Tasker approval account link]', linkError)
          return NextResponse.json({
            error: 'Tasker approved, but the account could not be linked. Check whether this user or application is already linked to another tasker account, then sync again.',
          }, { status: 409 })
        }
      }
    }

    let onboardingEmailSent = false
    let onboardingEmailError = false
    let onboardingEmailReason: string | undefined
    if (action === 'approve') {
        try {
          const delivery = await issueTaskerOnboardingLink(tasker)
          onboardingEmailSent = delivery.sent
          onboardingEmailReason = delivery.reason
          onboardingEmailError = delivery.reason === 'missing-email'
        } catch (emailError) {
          onboardingEmailError = true
          console.error('[PATCH /api/admin/taskers/[id]] approval email failed', emailError)
        }
    }

    return NextResponse.json(
      {
        message:
          action === 'approve'
            ? accountLinked ? 'Tasker approved and user account updated to tasker.' : 'Tasker approved successfully.'
            : action === 'reject'
              ? 'Tasker rejected successfully.'
              : nextBankDetails
                ? 'Tasker bank details updated successfully.'
                : 'Tasker status updated successfully.',
        tasker: {
          id: tasker._id,
          isVerified: tasker.isVerified,
          isRejected: tasker.isRejected,
          taskerMode: tasker.taskerMode,
          isSettlementSuspended: tasker.isSettlementSuspended,
          bankDetails: tasker.bankDetails,
        },
        onboardingEmailSent,
        onboardingEmailError,
        onboardingEmailReason,
        accountLinked,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[PATCH /api/admin/taskers/[id]]', error)
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
