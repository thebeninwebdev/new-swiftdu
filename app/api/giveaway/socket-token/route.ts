import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getAdminDashboardAccess } from '@/lib/admin-access'
import { issueGiveawaySocketToken } from '@/lib/giveaway'

export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ token: null })
  const access = await getAdminDashboardAccess(request.headers)
  try { return NextResponse.json({ token: issueGiveawaySocketToken(session.user.id, Boolean(access)) }, { headers: { 'Cache-Control': 'private, no-store' } }) }
  catch { return NextResponse.json({ error: 'Giveaway realtime is not configured.' }, { status: 503 }) }
}
