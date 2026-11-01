import { randomInt, randomUUID, createHmac, timingSafeEqual } from 'node:crypto'
import { connectDB } from '@/lib/db'
import { Giveaway, type GiveawayMode, type IGiveaway } from '@/models/giveaway'
import { RESULT_REVEAL_DELAY, spinDuration, targetRotation } from '@/lib/giveaway-wheel-math'

export const GIVEAWAY_ID = 'swiftdu-week-1'
export const DEFAULT_PRIZES = [1500, 2500, 4000]
export type GiveawayPublicState = ReturnType<typeof serializeGiveaway>

function normalize(doc: IGiveaway) { return doc }
export async function getGiveaway() {
  await connectDB()
  let giveaway = await Giveaway.findOne({ giveawayId: GIVEAWAY_ID })
  if (!giveaway) giveaway = await Giveaway.create({ giveawayId: GIVEAWAY_ID, slug: 'week-1', title: 'SwiftDU Week 1 Giveaway', prizes: DEFAULT_PRIZES, currentPrize: DEFAULT_PRIZES[0] })
  return normalize(giveaway)
}
export function serializeGiveaway(doc: IGiveaway) {
  const contestants = doc.contestants.map((c) => ({ id: c.id, name: c.name, active: c.active }))
  const activeContestantIds = contestants.filter((c) => c.active).map((c) => c.id)
  return { id: doc.giveawayId, title: doc.title, status: doc.status, mode: doc.mode, contestants, activeContestantIds, eliminatedContestantIds: contestants.filter((c) => !c.active).map((c) => c.id), prizes: doc.prizes, winners: doc.winners, eliminations: doc.eliminations, currentPrize: doc.currentPrize, currentRound: doc.currentRound, wheelRotation: doc.wheelRotation ?? 0, lastResult: doc.lastResult, spin: doc.spin }
}
function assertMode(mode: unknown): asserts mode is GiveawayMode { if (mode !== 'winner' && mode !== 'elimination') throw new Error('Invalid game mode.') }
function active(doc: IGiveaway) { return doc.contestants.filter((c) => c.active) }
export async function updateGiveaway(action: string, payload: Record<string, unknown> = {}) {
  const doc = await getGiveaway()
  if (doc.spin && Date.now() >= doc.spin.startedAt + doc.spin.duration + RESULT_REVEAL_DELAY) await finalizeSpin(doc)
  if (action === 'start') { if (!doc.contestants.length) throw new Error('Add contestants before starting.'); doc.status = 'live' }
  else if (action === 'finish') doc.status = 'finished'
  else if (action === 'set-mode') { if (doc.status === 'spinning') throw new Error('A spin is already in progress.'); assertMode(payload.mode); doc.mode = payload.mode }
  else if (action === 'set-prize') { const amount = Number(payload.amount); if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000) throw new Error('Enter a valid prize amount.'); const index = Number(payload.index); if (!Number.isInteger(index) || index < 0 || index > 20) throw new Error('Invalid prize.'); doc.prizes[index] = amount; doc.currentPrize = amount }
  else if (action === 'update-contestants') { if (doc.status !== 'waiting') throw new Error('Contestants can only be edited before the giveaway starts.'); const names = Array.isArray(payload.names) ? payload.names : []; const clean = [...new Set(names.filter((n): n is string => typeof n === 'string').map((n) => n.trim()).filter(Boolean))].slice(0, 20); if (!clean.length) throw new Error('Add at least one contestant.'); doc.contestants = clean.map((name) => ({ id: randomUUID(), name: name.slice(0, 80), active: true })) }
  else if (action === 'remove' || action === 'restore') { if (doc.status === 'spinning') throw new Error('Wait for the spin to finish.'); const id = String(payload.contestantId || ''); const contestant = doc.contestants.find((c) => c.id === id); if (!contestant) throw new Error('Contestant not found.'); contestant.active = action === 'restore' }
  else if (action === 'reset') { doc.status = 'waiting'; doc.mode = 'winner'; doc.contestants.forEach((c) => { c.active = true }); doc.winners = []; doc.eliminations = []; doc.currentRound = 0; doc.wheelRotation = 0; doc.currentPrize = doc.prizes[0] ?? null; doc.spin = null; doc.lastResult = null }
  else throw new Error('Unknown giveaway action.')
  await doc.save(); return serializeGiveaway(doc)
}
export async function startSpin() {
  const doc = await getGiveaway()
  if (doc.spin || doc.status === 'spinning') throw new Error('A spin is already in progress.')
  if (doc.status !== 'live') throw new Error('Start the giveaway first.')
  const eligible = active(doc); if (eligible.length < 2) throw new Error('The final remaining contestant receives the grand prize automatically.')
  const index = randomInt(0, eligible.length)
  const prizeMode = doc.mode === 'winner' || eligible.length <= 3
  const prize = prizeMode ? (doc.prizes[doc.winners.length] ?? null) : null
  const duration = spinDuration(doc.mode, eligible.length, prize)
  const startRotation = doc.wheelRotation ?? 0
  const finalRotation = targetRotation(startRotation, index, eligible.length)
  doc.currentRound += 1
  const spin = { id: randomUUID(), winnerId: eligible[index].id, startedAt: Date.now(), duration, startRotation, targetRotation: finalRotation, contestantIndex: index, contestantCount: eligible.length }
  doc.status = 'spinning'; doc.spin = spin; await doc.save(); return { state: serializeGiveaway(doc), spin }
}
export async function finalizeSpin(doc?: IGiveaway) {
  const giveaway = doc ?? await getGiveaway(); if (!giveaway.spin) return serializeGiveaway(giveaway)
  const selected = giveaway.contestants.find((c) => c.id === giveaway.spin!.winnerId); if (!selected) throw new Error('Selected contestant no longer exists.')
  const prizeMode = giveaway.mode === 'winner' || active(giveaway).length <= 3
  const prize = prizeMode ? (giveaway.prizes[giveaway.winners.length] ?? null) : null
  selected.active = false
  giveaway.lastResult = { contestantId: selected.id, name: selected.name, prize, outcome: prizeMode ? 'winner' : 'eliminated', round: giveaway.currentRound }
  if (prizeMode) giveaway.winners.push({ contestantId: selected.id, name: selected.name, prize, round: giveaway.currentRound })
  else giveaway.eliminations.push({ contestantId: selected.id, name: selected.name, round: giveaway.currentRound, at: new Date() })
  giveaway.wheelRotation = giveaway.spin.targetRotation
  giveaway.spin = null; giveaway.currentPrize = giveaway.prizes[giveaway.winners.length] ?? null
  if (!active(giveaway).length || (prizeMode && giveaway.winners.length >= giveaway.prizes.length)) giveaway.status = 'finished'; else giveaway.status = 'live'
  // Last Swifter Standing's grand prize is automatic, never a browser-selected spin.
  if (giveaway.mode === 'elimination' && giveaway.winners.length === giveaway.prizes.length - 1 && active(giveaway).length === 1) { const final = active(giveaway)[0]; final.active = false; giveaway.winners.push({ contestantId: final.id, name: final.name, prize: giveaway.prizes[giveaway.winners.length] ?? null, round: giveaway.currentRound + 1 }); giveaway.currentPrize = null; giveaway.status = 'finished' }
  await giveaway.save(); return serializeGiveaway(giveaway)
}
function getGiveawaySocketSecret() {
  // Better Auth already requires a server-only high-entropy secret. Reusing it
  // locally prevents an omitted optional giveaway variable from downgrading an
  // authorized admin to a public socket. Deployments should still set the
  // dedicated value so it can be rotated independently.
  return process.env.GIVEAWAY_SOCKET_SECRET || process.env.BETTER_AUTH_SECRET
}
export function issueGiveawaySocketToken(userId: string, isAdmin: boolean) { const value = `${userId}.${isAdmin ? 'admin' : 'viewer'}.${Date.now()}`; const secret = getGiveawaySocketSecret(); if (!secret) throw new Error('Configure GIVEAWAY_SOCKET_SECRET or BETTER_AUTH_SECRET.'); const sig = createHmac('sha256', secret).update(value).digest('hex'); return `${value}.${sig}` }
export function verifyGiveawaySocketToken(token: unknown) { const secret = getGiveawaySocketSecret(); if (!secret || typeof token !== 'string') return null; const parts = token.split('.'); if (parts.length !== 4) return null; const [userId, role, timestamp, sig] = parts; const value = `${userId}.${role}.${timestamp}`; if (Date.now() - Number(timestamp) > 5 * 60 * 1000) return null; const expected = createHmac('sha256', secret).update(value).digest('hex'); if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; return { userId, isAdmin: role === 'admin' } }
