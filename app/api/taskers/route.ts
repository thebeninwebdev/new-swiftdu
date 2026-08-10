import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { calculateTaskerStats } from '@/lib/tasker-stats'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'
import Tasker from "@/models/tasker"
import { getTaskerMode } from '@/lib/test-orders'
import { sendTransactionalEmail } from '@/lib/email'
import TaskerApplicationConfirmationEmail from '@/emails/taskerApplicationConfirmationEmail'
import { createElement } from 'react'
import { auth } from '@/lib/auth'
import { isValidEmail, normalizeEmail } from '@/lib/email-normalization'
import { User } from '@/models/user'

// ─── POST /api/taskers ────────────────────────────────────────────────────────
// Creates a new tasker profile and updates the user's role to 'tasker'.
// Guards against duplicate userId and duplicate phone number.

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const session = await auth.api.getSession({ headers: req.headers })
    const userId = session?.user?.id || null

    const {
      firstName,
      lastName,
      email,
      phone,
      location,
      studentId,
      level,
      availability,
      motivation,
      motivationOther,
      profileImage,
      profileImagePublicId,
    } = body

    // ── Required field validation ──────────────────────────────────────────

    const normalizedEmail = normalizeEmail(email)
    const normalizedFirstName = String(firstName || '').trim()
    const normalizedLastName = String(lastName || '').trim()
    const normalizedFullName = `${normalizedFirstName} ${normalizedLastName}`.trim()

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !isValidEmail(normalizedEmail) ||
      !phone ||
      !location ||
      !studentId ||
      !level ||
      !motivation
    ) {
      return NextResponse.json(
        { error: 'Complete all required contact, student, and work preference fields.' },
        { status: 400 }
      )
    }

    if (!Array.isArray(availability) || availability.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one time when you can usually work.' },
        { status: 400 }
      )
    }

    if (motivation === 'Other' && !String(motivationOther || '').trim()) {
      return NextResponse.json(
        { error: 'Tell us why you want to become a SwiftDU tasker.' },
        { status: 400 }
      )
    }

    // ── Phone format validation (Nigerian numbers) ─────────────────────────

    if (!/^(\+234|0)[789][01]\d{8}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Must be a valid Nigerian number.' },
        { status: 400 }
      )
    }

    // ── Duplicate checks ───────────────────────────────────────────────────

    const [existingByUser, existingByPhone, existingByEmail, matchingUser] = await Promise.all([
      userId ? Tasker.findOne({ userId }) : null,
      Tasker.findOne({ phone }),
      Tasker.findOne({ email: normalizedEmail }),
      User.findOne({ email: normalizedEmail }).select('role taskerId').lean(),
    ])

    if (existingByUser) {
      return NextResponse.json(
        { error: 'A tasker profile already exists for this account.' },
        { status: 409 }
      )
    }

    if (existingByPhone) {
      return NextResponse.json(
        { error: 'This phone number is already registered to another tasker.' },
        { status: 409 }
      )
    }

    if (existingByEmail) {
      return NextResponse.json(
        { error: 'An application has already been submitted with this email address.' },
        { status: 409 }
      )
    }

    if (matchingUser?.role === 'tasker' || matchingUser?.taskerId) {
      return NextResponse.json(
        { error: 'This email already belongs to an active SwiftDU Tasker account.' },
        { status: 409 }
      )
    }

    // ── Create tasker ──────────────────────────────────────────────────────

    const tasker = await Tasker.create({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      fullName: normalizedFullName,
      email: normalizedEmail,
      phone,
      location,
      studentId,
      level: String(level).trim(),
      availability: availability.map((item: unknown) => String(item).trim()).filter(Boolean),
      motivation: String(motivation).trim(),
      ...(motivation === 'Other' && {
        motivationOther: String(motivationOther).trim(),
      }),
      ...(profileImage && { profileImage }),
      ...(profileImagePublicId && { profileImagePublicId }),
      bankDetails: {
        bankName: '',
        accountNumber: '',
        accountName: '',
      },
      isVerified: false,
      taskerMode: 'training',
      rating: 0,
      completedTasks: 0,
    })

    // ── Update user role and assign taskerId ──────────────────────────────

    let confirmationEmailSent = false
    try {
      await sendTransactionalEmail({
        to: normalizedEmail,
        subject: 'We received your SwiftDU tasker application',
        react: createElement(TaskerApplicationConfirmationEmail, {
          name: normalizedFirstName,
        }),
        tags: [
          { name: 'email_type', value: 'tasker_application_confirmation' },
          { name: 'auth_flow', value: 'tasker_application' },
        ],
      })
      confirmationEmailSent = true
    } catch (emailError) {
      console.error('[POST /api/taskers] confirmation email failed', emailError)
    }

    return NextResponse.json(
      {
        message: 'Tasker profile created successfully.',
        confirmationEmailSent,
        tasker: {
          id: tasker._id,
          userId: tasker.userId,
          phone: tasker.phone,
          location: tasker.location,
          isVerified: tasker.isVerified,
          createdAt: tasker.createdAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/taskers]', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}

// ─── GET /api/taskers?userId=... ──────────────────────────────────────────────
// Fetches a tasker profile by taskerId.
// Returns live-computed stats so rating and completed task counts stay accurate.

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const taskerId = searchParams.get('taskerId')
    const basic = searchParams.get('basic') === 'true'

    if (!taskerId) {
      return NextResponse.json(
        { error: 'taskerId query parameter is required.' },
        { status: 400 }
      )
    }

    const tasker = await Tasker.findById(taskerId).lean()

    if (!tasker) {
      return NextResponse.json(
        { error: 'Tasker profile not found.' },
        { status: 404 }
      )
    }

    if (basic) {
      return NextResponse.json(
        {
          tasker: {
            ...tasker,
            taskerMode: getTaskerMode(tasker),
            completedTasks: tasker.completedTasks || 0,
            rating: tasker.rating || 0,
          },
        },
        { status: 200 }
      )
    }

    await syncTaskerSettlementStatus(taskerId)

    const stats = await calculateTaskerStats(taskerId)

    return NextResponse.json(
      {
        tasker: {
          ...tasker,
          taskerMode: getTaskerMode(tasker),
          completedTasks: stats.completedTasks,
          rating: stats.rating,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[GET /api/taskers]', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}
