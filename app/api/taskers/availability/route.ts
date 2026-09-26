import { NextRequest, NextResponse } from 'next/server'
import { currentTasker, lockTaskerWork, WorkError, workSnapshot } from '@/lib/tasker-work-server'
import { TaskerWorkSession } from '@/models/tasker-work-session'
import { Order } from '@/models/order'

function failure(error: unknown) {
  if (error instanceof WorkError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error('[Tasker availability]', error)
  return NextResponse.json({ error: 'Could not update your work session. Please retry.' }, { status: 500 })
}
export async function GET(request: NextRequest) {
  try {
    const tasker = await currentTasker(request.headers)
    return NextResponse.json(await workSnapshot(String(tasker._id)), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
export async function PATCH(request: NextRequest) {
  try {
    const tasker = await currentTasker(request.headers)
    const { action } = await request.json()
    if (!['check-in', 'check-out'].includes(action)) throw new WorkError('Choose check-in or check-out.', 400)
    const id = String(tasker._id)
    const release = await lockTaskerWork(id)
    try {
      if (action === 'check-in') {
        const current = await workSnapshot(id)
        if (!current.canCheckIn) throw new WorkError(current.blockedReason || 'Check-in unavailable.', 403)
        await TaskerWorkSession.findOneAndUpdate({ taskerId: id, open: true }, { $setOnInsert: { startedAt: new Date() } }, { upsert: true })
      } else {
        if (await Order.exists({ taskerId: id, status: { $in: ['in_progress', 'paid'] } })) throw new WorkError('Finish your active tasks before checking out.')
        await TaskerWorkSession.updateOne({ taskerId: id, open: true }, { $set: { open: false, endedAt: new Date() } })
      }
    } finally { await release() }
    return NextResponse.json(await workSnapshot(id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
