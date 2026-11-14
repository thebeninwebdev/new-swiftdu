import { createHttpClient } from '@ably/pubsub-server'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tasker from '@/models/tasker'
import { getRealtimeCapabilities, getRealtimeChannels } from '@/lib/realtime/capabilities'

export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  let stage = 'session'
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      console.warn('[realtime-token]', { code: 'realtime_authorization_failed', stage, status: 401, reason: 'unauthenticated' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const key = process.env.ABLY_API_KEY
    if (!key) {
      console.error('[realtime-token]', { code: 'realtime_authorization_failed', stage: 'configuration', status: 503, reason: 'ably_key_missing' })
      return NextResponse.json({ error: 'Realtime is not configured.' }, { status: 503 })
    }
    stage = 'identity'
    await connectDB()
    const tasker = await Tasker.findOne({ userId: session.user.id, isVerified: true, isRejected: { $ne: true } }).select('_id taskerMode').lean()
    const identity = { userId: session.user.id, ...(tasker ? { taskerId: String(tasker._id), taskerMode: tasker.taskerMode === 'training' ? 'training' as const : 'live' as const } : {}) }
    stage = 'ably_token_request'
    const client = createHttpClient({ key })
    const tokenRequest = await client.auth.createTokenRequest({ clientId: `swiftdu:${session.user.id}`, capability: JSON.stringify(getRealtimeCapabilities(identity)), ttl: 60 * 60 * 1000 })
    return NextResponse.json({ tokenRequest, channels: getRealtimeChannels(identity) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const candidate = error as { name?: unknown; code?: unknown; statusCode?: unknown }
    const errorCode = Number(candidate?.code ?? candidate?.statusCode)
    console.error('[realtime-token]', {
      code: 'realtime_authorization_failed',
      stage,
      ...(typeof candidate?.name === 'string' ? { errorName: candidate.name } : {}),
      ...(Number.isFinite(errorCode) ? { errorCode } : {}),
    })
    return NextResponse.json({ error: 'Unable to authorize realtime.' }, { status: 503 })
  }
}
