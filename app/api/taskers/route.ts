import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Tasker from "@/models/tasker"
import {User} from "@/models/user"

// ─── POST /api/taskers ────────────────────────────────────────────────────────
// Creates a new tasker profile and updates the user's role to 'tasker'.
// Guards against duplicate userId and duplicate phone number.

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()

    const {
      userId,
      phone,
      location,
      studentId,
      profileImage,
      profileImagePublicId,
      bankDetails,
    } = body

    // ── Required field validation ──────────────────────────────────────────

    if (!userId || !phone || !location || !studentId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, phone, location, studentId' },
        { status: 400 }
      )
    }

    if (
      !bankDetails?.bankName ||
      !bankDetails?.accountNumber ||
      !bankDetails?.accountName
    ) {
      return NextResponse.json(
        { error: 'Missing required bank details: bankName, accountNumber, accountName' },
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

    // ── Account number validation (10-digit NUBAN) ─────────────────────────

    if (!/^\d{10}$/.test(bankDetails.accountNumber)) {
      return NextResponse.json(
        { error: 'Account number must be exactly 10 digits.' },
        { status: 400 }
      )
    }

    // ── Duplicate checks ───────────────────────────────────────────────────

    const [existingByUser, existingByPhone] = await Promise.all([
      Tasker.findOne({ userId }),
      Tasker.findOne({ phone }),
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

    // ── Create tasker ──────────────────────────────────────────────────────

    const tasker = await Tasker.create({
      userId,
      phone,
      location,
      studentId,
      ...(profileImage && { profileImage }),
      ...(profileImagePublicId && { profileImagePublicId }),
      bankDetails: {
        bankName: bankDetails.bankName.trim(),
        accountNumber: bankDetails.accountNumber.trim(),
        accountName: bankDetails.accountName.trim(),
      },
      isVerified: false,
      rating: 0,
      completedTasks: 0,
    })

    // ── Update user role and assign taskerId ──────────────────────────────

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        role: 'tasker', 
        taskerId: tasker._id 
      },
      { new: true }
    )

    if (!updatedUser) {
      return NextResponse.json(
        { error: `Failed to update user with tasker role. User not found: ${userId}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: 'Tasker profile created successfully.',
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
// Fetches a tasker profile by userId.
// Useful for checking if the current user is already a tasker.

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const taskerId = searchParams.get('taskerId')

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

    return NextResponse.json({ tasker }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/taskers]', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}