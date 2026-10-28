import Ably from 'ably'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tasker from '@/models/tasker'
import { getRealtimeCapabilities, getRealtimeChannels } from '@/lib/realtime/capabilities'

export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const key = process.env.ABLY_API_KEY
  if (!key) return NextResponse.json({ error: 'Realtime is not configured.' }, { status: 503 })
  await connectDB()
  const tasker = await Tasker.findOne({ userId: session.user.id, isVerified: true, isRejected: { $ne: true } }).select('_id taskerMode').lean()
  const identity = { userId: session.user.id, ...(tasker ? { taskerId: String(tasker._id), taskerMode: tasker.taskerMode === 'training' ? 'training' as const : 'live' as const } : {}) }
  const client = new Ably.Rest(key)
  const tokenRequest = await client.auth.createTokenRequest({ clientId: `swiftdu:${session.user.id}`, capability: JSON.stringify(getRealtimeCapabilities(identity)), ttl: 60 * 60 * 1000 })
  return NextResponse.json({ tokenRequest, channels: getRealtimeChannels(identity) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
