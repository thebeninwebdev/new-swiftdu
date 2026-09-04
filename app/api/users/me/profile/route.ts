import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getProfileCompletion } from '@/lib/profile-completion'
import { isValidBirthday } from '@/lib/profile-completion'
import { User } from '@/models/user'

const GENDERS = new Set(['male', 'female', 'other', 'prefer_not_to_say'])

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined
}

function parseLegacyDate(value: unknown) {
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date > new Date() ? undefined : date
}

function serializeUser(user: {
  _id: { toString(): string }
  name?: string | null
  email?: string | null
  phone?: string | null
  location?: string | null
  defaultLocation?: string | null
  profileImage?: string | null
  profileImagePublicId?: string | null
  gender?: string | null
  dateOfBirth?: Date | string | null
  birthdayDay?: number | null
  birthdayMonth?: number | null
}) {
  const legacyBirthday = user.dateOfBirth ? new Date(user.dateOfBirth) : null
  const profile = {
    id: user._id.toString(),
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    location: user.location || '',
    defaultLocation: user.defaultLocation || user.location || '',
    profileImage: user.profileImage || '',
    profileImagePublicId: user.profileImagePublicId || '',
    gender: user.gender || '',
    birthdayDay: user.birthdayDay || legacyBirthday?.getUTCDate() || null,
    birthdayMonth: user.birthdayMonth || (legacyBirthday ? legacyBirthday.getUTCMonth() + 1 : null),
    // Kept temporarily for older account/settings clients; new onboarding never asks for a year.
    dateOfBirth: legacyBirthday ? legacyBirthday.toISOString().slice(0, 10) : '',
  }

  return {
    user: profile,
    completion: getProfileCompletion(profile),
  }
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
      .select('name email phone location defaultLocation profileImage profileImagePublicId gender dateOfBirth birthdayDay birthdayMonth')
      .lean()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(serializeUser(user))
  } catch (error) {
    console.error('[User Profile GET Error]:', error)
    return NextResponse.json(
      { error: 'Failed to load profile.' },
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

    const body = await request.json()
    const update: Record<string, unknown> = {}

    if ('name' in body) {
      const name = normalizeString(body.name)
      if (!name) {
        return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
      }
      update.name = name
    }

    if ('phone' in body) {
      update.phone = normalizeString(body.phone) || ''
    }

    if ('location' in body) {
      update.location = normalizeString(body.location) || ''
    }

    if ('defaultLocation' in body) {
      const location = normalizeString(body.defaultLocation)
      if (!location) return NextResponse.json({ error: 'Default location is required.' }, { status: 400 })
      // Dual-write during the transition so existing order/admin code remains compatible.
      update.defaultLocation = location
      update.location = location
    }

    if ('profileImage' in body) {
      update.profileImage = normalizeString(body.profileImage) || ''
    }

    if ('profileImagePublicId' in body) {
      update.profileImagePublicId = normalizeString(body.profileImagePublicId) || ''
    }

    if ('gender' in body) {
      const gender = normalizeString(body.gender)
      if (gender && !GENDERS.has(gender)) {
        return NextResponse.json({ error: 'Select a valid gender.' }, { status: 400 })
      }
      update.gender = gender || undefined
    }

    if ('birthdayDay' in body || 'birthdayMonth' in body) {
      const day = body.birthdayDay == null || body.birthdayDay === '' ? null : Number(body.birthdayDay)
      const month = body.birthdayMonth == null || body.birthdayMonth === '' ? null : Number(body.birthdayMonth)
      if (!isValidBirthday(day, month)) return NextResponse.json({ error: 'Enter a valid birthday day and month.' }, { status: 400 })
      update.birthdayDay = day
      update.birthdayMonth = month
    }

    if ('dateOfBirth' in body) {
      const legacyDate = parseLegacyDate(body.dateOfBirth)
      if (legacyDate === undefined) return NextResponse.json({ error: 'Enter a valid birthday.' }, { status: 400 })
      update.dateOfBirth = legacyDate
      if (legacyDate) {
        update.birthdayDay = legacyDate.getUTCDate()
        update.birthdayMonth = legacyDate.getUTCMonth() + 1
      }
    }

    await User.findByIdAndUpdate(session.user.id, { $set: update })

    const user = await User.findById(session.user.id)
      .select('name email phone location defaultLocation profileImage profileImagePublicId gender dateOfBirth birthdayDay birthdayMonth')
      .lean()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(serializeUser(user))
  } catch (error) {
    console.error('[User Profile PATCH Error]:', error)
    return NextResponse.json(
      { error: 'Failed to save profile.' },
      { status: 500 }
    )
  }
}
