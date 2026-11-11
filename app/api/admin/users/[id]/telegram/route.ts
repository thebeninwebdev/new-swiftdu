import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

import { getAdminDashboardAccess } from '@/lib/admin-access'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user'
import { hasTelegramStaffPrivilege } from '@/lib/sammy/telegram-link-policy'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getAdminDashboardAccess(request.headers)
    if (!access?.isAdmin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    const { id } = await context.params
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    const body = await request.json() as { telegramUserId?: unknown; enabled?: unknown }
    const telegramUserId = String(body.telegramUserId || '').trim()
    if (body.enabled !== false && !/^\d+$/.test(telegramUserId)) {
      return NextResponse.json({ error: 'Telegram numeric user ID is required.' }, { status: 400 })
    }

    await connectDB()
    const user = await User.findById(id).select({ _id: 1, name: 1, role: 1, isExco: 1, excoRole: 1, " excoRole": 1, isSuspended: 1, telegramRevokedAt: 1 })
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    if (user.isSuspended || !hasTelegramStaffPrivilege(user)) {
      return NextResponse.json({ error: 'Only an admin or EXCO account can be approved for Sammy.' }, { status: 400 })
    }
    if (body.enabled === false) {
      await User.updateOne({ _id: user._id }, { $set: { telegramEnabled: false, telegramRevokedAt: new Date() } })
      return NextResponse.json({ approved: false, userId: String(user._id) })
    }
    const duplicate = await User.exists({ _id: { $ne: user._id }, telegramUserId })
    if (duplicate) return NextResponse.json({ error: 'That Telegram user ID is already linked.' }, { status: 409 })
    await User.updateOne(
      { _id: user._id },
      { $set: { telegramUserId, telegramEnabled: true, telegramLinkedAt: new Date() }, $unset: { telegramRevokedAt: 1 } }
    )
    return NextResponse.json({ approved: true, userId: String(user._id), telegramUserId })
  } catch (error) {
    console.error('[PATCH admin user Telegram approval]', error)
    return NextResponse.json({ error: 'Could not update Telegram approval.' }, { status: 500 })
  }
}
