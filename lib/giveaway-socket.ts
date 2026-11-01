import type { Server as SocketIOServer, Socket } from 'socket.io'
import { finalizeSpin, getGiveaway, serializeGiveaway, startSpin, updateGiveaway, verifyGiveawaySocketToken } from '@/lib/giveaway'
import { RESULT_REVEAL_DELAY } from '@/lib/giveaway-wheel-math'

const ROOM = 'giveaway:swiftdu-week-1'
const adminActions: Record<string, string> = { 'giveaway:admin-start': 'start', 'giveaway:admin-finish': 'finish', 'giveaway:admin-set-mode': 'set-mode', 'giveaway:admin-set-prize': 'set-prize', 'giveaway:admin-remove-contestant': 'remove', 'giveaway:admin-restore-contestant': 'restore', 'giveaway:admin-reset': 'reset', 'giveaway:admin-update-contestants': 'update-contestants' }

export function installGiveawaySocket(io: SocketIOServer) {
  io.of('/giveaway').use((socket, next) => { const token = verifyGiveawaySocketToken(socket.handshake.auth?.token); socket.data.isAdmin = Boolean(token?.isAdmin); socket.data.userId = token?.userId; next() })
  const namespace = io.of('/giveaway')
  const broadcast = async () => namespace.to(ROOM).emit('giveaway:state', serializeGiveaway(await getGiveaway()))
  namespace.on('connection', async (socket: Socket) => {
    socket.join(ROOM)
    let state = await getGiveaway()
    if (state.spin && Date.now() >= state.spin.startedAt + state.spin.duration + RESULT_REVEAL_DELAY) { await finalizeSpin(state); state = await getGiveaway(); await broadcast() }
    socket.emit('giveaway:state', serializeGiveaway(state))
    socket.emit('giveaway:presence', namespace.adapter.rooms.get(ROOM)?.size ?? 1)
    socket.on('disconnect', () => { namespace.to(ROOM).emit('giveaway:presence', namespace.adapter.rooms.get(ROOM)?.size ?? 0) })
    socket.on('giveaway:join', () => socket.emit('giveaway:state', serializeGiveaway(state)))
    socket.on('giveaway:admin-spin', async (_payload: unknown, ack?: (result: unknown) => void) => {
      if (!socket.data.isAdmin) return ack?.({ ok: false, error: 'You are not authorized to control this giveaway.' })
      try { const result = await startSpin(); namespace.to(ROOM).emit('giveaway:spin-started', result.spin); await broadcast(); ack?.({ ok: true }); setTimeout(async () => { const current = await getGiveaway(); if (current.spin?.id === result.spin.id) { await finalizeSpin(current); await broadcast(); namespace.to(ROOM).emit('giveaway:spin-result', serializeGiveaway(await getGiveaway())) } }, result.spin.duration + RESULT_REVEAL_DELAY); } catch (error) { ack?.({ ok: false, error: error instanceof Error ? error.message : 'Unable to spin.' }) }
    })
    for (const [event, action] of Object.entries(adminActions)) socket.on(event, async (payload: unknown, ack?: (result: unknown) => void) => {
      if (!socket.data.isAdmin) return ack?.({ ok: false, error: 'You are not authorized to control this giveaway.' })
      try { const nextState = await updateGiveaway(action, (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>); namespace.to(ROOM).emit('giveaway:state', nextState); namespace.to(ROOM).emit(action === 'reset' ? 'giveaway:reset' : 'giveaway:state', nextState); ack?.({ ok: true, state: nextState }) } catch (error) { ack?.({ ok: false, error: error instanceof Error ? error.message : 'Unable to update giveaway.' }) }
    })
  })
}

export default installGiveawaySocket
