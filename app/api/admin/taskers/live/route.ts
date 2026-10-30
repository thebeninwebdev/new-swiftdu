import { NextRequest, NextResponse } from 'next/server'
import { getAdminDashboardAccess } from '@/lib/admin-access'
import { getAdminTaskerWorkOverview } from '@/lib/admin-tasker-work'
import { connectDB } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    if (!await getAdminDashboardAccess(request.headers)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    await connectDB()
    return NextResponse.json(await getAdminTaskerWorkOverview(), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[GET /api/admin/taskers/live]', error)
    return NextResponse.json({ error: 'Unable to load live tasker status.' }, { status: 500 })
  }
}
