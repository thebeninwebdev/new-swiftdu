import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user'

function parseDateOfBirth(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  if (Number.isNaN(date.getTime()) || date > today) {
    return null
  }

  return date
}

export async function GET(request: NextRequest) {
  try {
    await connectDB()

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await User.findById(session.user.id)
      .select('dateOfBirth')
      .lean()

    return NextResponse.json({
      dateOfBirth: user?.dateOfBirth
        ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
        : null,
    })
  } catch (error) {
    console.error('[Date of Birth GET Error]:', error)
    return NextResponse.json(
      { error: 'Failed to load date of birth.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB()

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { dateOfBirth?: unknown }
    const dateOfBirth = parseDateOfBirth(body.dateOfBirth)

    if (!dateOfBirth) {
      return NextResponse.json(
        { error: 'Enter a valid date of birth.' },
        { status: 400 }
      )
    }

    await User.findByIdAndUpdate(session.user.id, {
      $set: { dateOfBirth },
    })

    return NextResponse.json({
      dateOfBirth: dateOfBirth.toISOString().slice(0, 10),
    })
  } catch (error) {
    console.error('[Date of Birth PATCH Error]:', error)
    return NextResponse.json(
      { error: 'Failed to save date of birth.' },
      { status: 500 }
    )
  }
}
