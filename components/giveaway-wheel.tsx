'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, CircleHelp, Loader2, RotateCcw, Settings2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Lottie } from 'lottie-react'
import { confettiAnimation } from '@/lib/confetti-lottie'

type Socket = { on: (event: string, handler: (...args: unknown[]) => void) => void; emit: (event: string, payload?: unknown, ack?: (result: unknown) => void) => void; disconnect: () => void }
declare global { interface Window { io?: (url: string, options?: Record<string, unknown>) => Socket } }

type Contestant = { id: string; name: string; active: boolean }
type Spin = { id: string; winnerId: string; startedAt: number; duration: number; startRotation: number; targetRotation: number; contestantIndex: number; contestantCount: number }
type State = { id: string; title: string; status: 'waiting'|'live'|'spinning'|'finished'; mode: 'winner'|'elimination'; contestants: Contestant[]; activeContestantIds: string[]; eliminatedContestantIds: string[]; prizes: number[]; winners: { contestantId: string; name: string; prize: number|null; round: number }[]; eliminations: { contestantId: string; name: string; round: number }[]; currentPrize: number|null; currentRound: number; wheelRotation: number; lastResult: { contestantId: string; name: string; prize: number|null; outcome: 'eliminated'|'winner'; round: number }|null; spin: Spin|null }
const colors = ['#7c3aed', '#f59e0b', '#0f766e', '#ec4899', '#2563eb', '#e11d48', '#0891b2', '#ca8a04']
const money = (amount: number|null) => amount == null ? '—' : `₦${amount.toLocaleString('en-NG')}`
const SLICE_HOLD_DURATION = 2200
const SLICE_EXIT_DURATION = 1400
const endpoint = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '')
function sectorPath(index: number, count: number) { const a = (index / count) * Math.PI * 2 - Math.PI / 2; const b = ((index + 1) / count) * Math.PI * 2 - Math.PI / 2; const x1 = 50 + 46 * Math.cos(a); const y1 = 50 + 46 * Math.sin(a); const x2 = 50 + 46 * Math.cos(b); const y2 = 50 + 46 * Math.sin(b); return `M50 50 L${x1} ${y1} A46 46 0 0 1 ${x2} ${y2} Z` }

// A continuous-velocity curve: quick acceleration, sustained speed, long
// deceleration, then a deliberate crawl through the final few segments.
function spinProgress(progress: number) {
  const points = [0, .17, .56, .89, 1]
  const values = [0, .10, .62, .96, 1]
  const slopes = [0, 1.3, 1.3, .32, 0]
  const clamped = Math.max(0, Math.min(1, progress))
  let index = points.length - 2
  for (let candidate = 0; candidate < points.length - 1; candidate += 1) {
    if (clamped <= points[candidate + 1]) { index = candidate; break }
  }
  const span = points[index + 1] - points[index]
  const t = (clamped - points[index]) / span
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * values[index]
    + (t3 - 2 * t2 + t) * span * slopes[index]
    + (-2 * t3 + 3 * t2) * values[index + 1]
    + (t3 - t2) * span * slopes[index + 1]
}

function sliceExitStyle(index: number, count: number, exiting: boolean, reduced: boolean) {
  const angle = (index + .5) * Math.PI * 2 / count - Math.PI / 2
  const x = 15 * Math.cos(angle)
  const y = 15 * Math.sin(angle)
  return {
    filter: exiting ? 'drop-shadow(0 3px 3px rgb(30 27 75 / .45))' : undefined,
    opacity: exiting ? .18 : 1,
    transform: exiting ? `translate(${x}px, ${y}px) scale(.98)` : 'translate(0, 0) scale(1)',
    transformOrigin: '50px 50px',
    transition: reduced ? 'none' : `transform ${SLICE_EXIT_DURATION}ms cubic-bezier(.2,.8,.2,1), opacity ${SLICE_EXIT_DURATION}ms ease-in`,
  }
}

function SpinningWheel({ state, active: currentActive, reduced }: { state: State; active: Contestant[]; reduced: boolean }) {
  const wheelRef = useRef<SVGGElement>(null)
  const pointerRef = useRef<HTMLDivElement>(null)
  const lastSpinRef = useRef<Spin|null>(null)
  const pendingRemovalIdRef = useRef<string|null>(null)
  const currentActiveRef = useRef(currentActive)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const animationFrameRef = useRef<number|null>(null)
  const [displayed, setDisplayed] = useState(currentActive)
  const [exitingId, setExitingId] = useState<string|null>(null)
  useEffect(() => { currentActiveRef.current = currentActive }, [currentActive])
  // Socket state is external input: preserve its previous contestant geometry
  // until the selected slice has visibly left the wheel.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const wheel = wheelRef.current
    if (!wheel) return
    if (animationFrameRef.current != null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    wheel.style.transition = 'none'

    if (!state.spin) {
      wheel.style.transform = `rotate(${state.wheelRotation ?? 0}deg)`
      return
    }

    const spin = state.spin
    lastSpinRef.current = spin
    const startRotation = spin.startRotation ?? state.wheelRotation ?? 0
    const elapsedAtRender = Date.now() - spin.startedAt
    if (elapsedAtRender >= spin.duration) {
      wheel.style.transform = `rotate(${spin.targetRotation}deg)`
      return
    }

    let lastBoundary: number|null = null
    let lastTickAt = 0
    const segmentAngle = 360 / spin.contestantCount
    const reducedStart = performance.now()
    const reducedTarget = startRotation + (((spin.targetRotation - startRotation) % 360) + 360) % 360
    const animate = (now: number) => {
      const elapsed = reduced ? now - reducedStart : Date.now() - spin.startedAt
      const duration = reduced ? 650 : spin.duration
      const progress = Math.max(0, Math.min(1, elapsed / duration))
      const eased = reduced ? 1 - Math.pow(1 - progress, 3) : spinProgress(progress)
      const target = reduced ? reducedTarget : spin.targetRotation
      const rotation = startRotation + (target - startRotation) * eased
      wheel.style.transform = `rotate(${rotation}deg)`

      if (!reduced && progress > .08) {
        const boundary = Math.floor(rotation / segmentAngle)
        if (lastBoundary != null && boundary !== lastBoundary && now - lastTickAt >= 85) {
          pointerRef.current?.animate(
            [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(0deg)' }],
            { duration: 90, easing: 'ease-out' },
          )
          lastTickAt = now
        }
        lastBoundary = boundary
      }

      if (progress < 1) animationFrameRef.current = requestAnimationFrame(animate)
      else {
        wheel.style.transform = `rotate(${reduced ? reducedTarget : spin.targetRotation}deg)`
        animationFrameRef.current = null
      }
    }
    animationFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationFrameRef.current != null) cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [reduced, state.spin, state.wheelRotation])

  useEffect(() => {
    if (state.spin) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
      pendingRemovalIdRef.current = null
      setExitingId(null)
      setDisplayed(currentActive)
      return
    }

    const removedId = state.lastResult?.contestantId
    const shouldPullSlice = lastSpinRef.current?.winnerId === removedId
      && displayed.some((contestant) => contestant.id === removedId)
      && !currentActive.some((contestant) => contestant.id === removedId)

    if (shouldPullSlice && removedId) {
      lastSpinRef.current = null
      pendingRemovalIdRef.current = removedId
      exitTimerRef.current = setTimeout(() => {
        setExitingId(removedId)
        exitTimerRef.current = setTimeout(() => {
          setDisplayed(currentActiveRef.current)
          setExitingId(null)
          pendingRemovalIdRef.current = null
          exitTimerRef.current = null
        }, reduced ? 300 : SLICE_EXIT_DURATION)
      }, reduced ? 700 : SLICE_HOLD_DURATION)
      return
    }

    if (!exitingId && !pendingRemovalIdRef.current) setDisplayed(currentActive)
  }, [currentActive, displayed, exitingId, reduced, state.lastResult?.contestantId, state.spin])

  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
  }, [])

  const active = displayed
  const count = Math.max(active.length, 1)
  return <div className="relative mx-auto aspect-square w-full max-w-[420px] p-3 sm:p-5"><div className="absolute left-1/2 top-0 z-10 -translate-x-1/2"><div ref={pointerRef} style={{ transformOrigin: '50% 0' }} className="h-0 w-0 border-x-[14px] border-t-0 border-b-[26px] border-x-transparent border-b-violet-950 drop-shadow-md" /></div><div className={`rounded-full bg-violet-950 p-2 transition-shadow duration-500 ${state.spin ? 'shadow-[0_24px_70px_-16px_rgba(76,29,149,.85)]' : 'shadow-[0_20px_50px_-18px_rgba(76,29,149,.7)]'}`}><svg viewBox="0 0 100 100" className="h-full w-full overflow-visible rounded-full" aria-label="Giveaway wheel"><g ref={wheelRef} style={{ transformOrigin: '50% 50%', willChange: state.spin ? 'transform' : 'auto' }}><circle cx="50" cy="50" r="48" fill="#fff" />{active.map((contestant, index) => { const angle = (index + .5) * 360 / count; return <g key={contestant.id} aria-label={contestant.id === exitingId ? `${contestant.name} selected` : undefined} style={sliceExitStyle(index, count, contestant.id === exitingId, reduced)}><path d={sectorPath(index, count)} fill={colors[index % colors.length]} stroke="#fff" strokeWidth=".6" /><text x="50" y="11" fill="white" fontSize={count > 10 ? 3 : count > 7 ? 3.6 : 4.5} fontWeight="700" textAnchor="middle" transform={`rotate(${angle} 50 50)`}>{contestant.name.length > 14 ? `${contestant.name.slice(0, 13)}…` : contestant.name}</text></g> })}</g><circle cx="50" cy="50" r="8" fill="#fff" /><circle cx="50" cy="50" r="5" fill="#f59e0b" /></svg></div></div>
}

function WinnersCelebrationLayout({ winners: originalWinners }: { winners: State['winners'] }) {
  const winners = [...originalWinners].sort((first, second) => (second.prize ?? 0) - (first.prize ?? 0))
  const confetti = ['transparent']
  return <div className={'relative mx-auto my-8 max-w-2xl overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-violet-50 px-5 py-10 text-center shadow-[0_24px_70px_-35px_rgba(124,58,237,.45)] sm:px-8'}><div aria-hidden={true} className={'pointer-events-none absolute inset-0'}>{Array.from({ length: 24 }, (_, index) => <span key={index} className={'absolute h-2.5 w-1.5 rounded-sm motion-safe:animate-pulse'} style={{ backgroundColor: confetti[index % confetti.length], left: String(4 + (index * 17) % 92) + '%', top: String(5 + (index * 29) % 78) + '%', rotate: String((index * 37) % 180) + 'deg', animationDelay: String((index % 8) * 120) + 'ms' }} />)}</div><div className={'relative'}><Sparkles className={'mx-auto h-10 w-10 text-amber-500'} aria-hidden={true} /><p className={'mt-3 text-xs font-extrabold uppercase tracking-[.24em] text-amber-700'}>Giveaway complete</p><h2 className={'mt-2 text-3xl font-black tracking-tight text-violet-950 sm:text-4xl'}>Meet our three winners</h2><div className={'mt-7 grid gap-3 sm:grid-cols-3'}>{winners.slice(0, 3).map((winner, index) => <div key={winner.contestantId} className={'rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur'}><span className={'mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-800'}>{index + 1}</span><p className={'mt-2 truncate text-lg font-extrabold text-violet-950'} title={winner.name}>{winner.name}</p><p className={'mt-1 text-sm font-bold text-amber-700'}>{money(winner.prize)}</p></div>)}</div></div></div>
}

function WinnersCelebration({ winners, reduced }: { winners: State['winners']; reduced: boolean }) {
  return <div className={'relative mx-auto -mt-8 max-w-2xl'}><Lottie src={confettiAnimation} autoplay={!reduced} loop={!reduced} aria-hidden={true} className={'h-full w-full'} style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }} /><WinnersCelebrationLayout winners={winners} /></div>
}

function Wheel(props: { state: State; active: Contestant[]; reduced: boolean }) {
  return props.state.winners.length >= 3
    ? <WinnersCelebration winners={props.state.winners} reduced={props.reduced} />
    : <SpinningWheel {...props} />
}

async function token() { const response = await fetch('/api/giveaway/socket-token', { cache: 'no-store' }); if (!response.ok) return undefined; return (await response.json()).token as string|undefined }
async function loadSocketClient() { if (window.io) return window.io; await new Promise<void>((resolve, reject) => { const existing = document.querySelector('script[data-giveaway-socket]'); if (existing) { existing.addEventListener('load', () => resolve()); existing.addEventListener('error', () => reject(new Error('Unable to load realtime client.'))); return } const script = document.createElement('script'); script.src = `${endpoint}/socket.io/socket.io.js`; script.async = true; script.dataset.giveawaySocket = 'true'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Unable to load realtime client.')); document.head.appendChild(script) }); return window.io }
export function GiveawayExperience({ admin = false }: { admin?: boolean }) {
  const [state, setState] = useState<State|null>(null); const [connected, setConnected] = useState(false); const [watching, setWatching] = useState(0); const [error, setError] = useState(''); const [names, setNames] = useState(''); const [help, setHelp] = useState(false); const [socket, setSocket] = useState<Socket|null>(null); const [grandPrizeReveal, setGrandPrizeReveal] = useState<State['lastResult']>(null)
  const load = useCallback(async () => { const createSocket = await loadSocketClient(); if (!createSocket) throw new Error('Realtime client unavailable.'); const authToken = admin ? await token() : undefined; const next = createSocket(`${endpoint}/giveaway`, { auth: authToken ? { token: authToken } : {}, transports: ['websocket', 'polling'], reconnection: true }); setSocket(next); next.on('connect', () => setConnected(true)); next.on('disconnect', () => setConnected(false)); next.on('connect_error', () => setConnected(false)); next.on('giveaway:state', (value: unknown) => setState(value as State)); next.on('giveaway:spin-result', (value: unknown) => setState(value as State)); next.on('giveaway:presence', (value: unknown) => setWatching(Number(value) || 0)); return () => { next.disconnect() } }, [admin])
  // The socket is an external subscription; its callbacks intentionally update React state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { let cleanup: (() => void)|undefined; void load().then((fn) => { cleanup = fn }); return () => cleanup?.() }, [load])
  const active = useMemo(() => state?.contestants.filter((c) => c.active) ?? [], [state]); const eliminated = useMemo(() => state?.contestants.filter((c) => !c.active) ?? [], [state]); const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const automaticGrandPrize = useMemo(() => { if (!state || state.mode !== 'elimination' || state.status !== 'finished') return null; const result = state.winners.find((entry) => entry.round === state.currentRound + 1); return result ? { contestantId: result.contestantId, name: result.name, prize: result.prize, outcome: 'winner' as const, round: result.round } : null }, [state])
  useEffect(() => { const timer = setTimeout(() => setGrandPrizeReveal(automaticGrandPrize), automaticGrandPrize ? (reduced ? 1000 : SLICE_HOLD_DURATION + SLICE_EXIT_DURATION + 300) : 0); return () => clearTimeout(timer) }, [automaticGrandPrize, reduced])
  const adminAction = (event: string, payload: unknown = {}) => new Promise<void>((resolve) => { if (!socket) return resolve(); socket.emit(event, payload, (value: unknown) => { const result = value as { ok: boolean; error?: string }; if (!result?.ok) setError(result?.error || 'Unable to update giveaway.'); else setError(''); resolve() }) })
  if (!state) return <main className="flex min-h-screen items-center justify-center bg-[#faf8ff] text-violet-950"><Loader2 className="animate-spin" /> <span className="ml-2">Connecting to the live draw…</span></main>
  const winner = state.winners.length >= 3 ? null : grandPrizeReveal ?? state.lastResult; const isElimination = state.mode === 'elimination' && active.length > 3
  return <main className={admin ? 'min-h-screen bg-slate-50 px-4 py-6 sm:px-8 lg:px-10' : 'min-h-screen overflow-hidden bg-[#faf8ff] px-4 pb-14 pt-6 text-violet-950 sm:px-6'}><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.24em] text-violet-600">SwiftDU · live event</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-4xl">{state.title}</h1></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}><span>●</span>{connected ? 'Live' : 'Reconnecting…'}</span></header><div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><section className="rounded-[2rem] border border-violet-100 bg-white p-4 shadow-[0_20px_70px_-45px_rgba(76,29,149,.55)] sm:p-8"><div className="text-center"><span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-amber-800">Week 1 giveaway</span><p className="mt-4 text-sm font-semibold text-slate-500">{state.status === 'waiting' ? 'Draw starts soon' : state.status === 'finished' ? 'That’s a wrap 💜' : isElimination ? 'ELIMINATION ROUND' : state.currentPrize ? 'CURRENT PRIZE' : 'THE FINAL 3'}</p><h2 className="mt-1 text-2xl font-extrabold text-violet-950 sm:text-3xl">{state.status === 'spinning' ? 'THE WHEEL IS SPINNING' : isElimination ? "Don't let the wheel land on you 👀" : state.currentPrize ? money(state.currentPrize) : '🏆 THE FINAL 3'}</h2>{state.status === 'waiting' && <p className="mt-2 text-sm text-slate-500">{active.length} Swifters. {Math.min(3, state.prizes.length)} winners. One wheel.</p>}</div><Wheel state={state} active={active} reduced={reduced} />{state.status === 'spinning' && <p className="text-center text-sm font-bold text-violet-700" role="status">The result is locked in. Watch the wheel…</p>}{winner && state.status !== 'spinning' && <div className={`mx-auto max-w-md rounded-3xl p-5 text-center ${winner.outcome === 'eliminated' ? 'bg-rose-50 text-rose-950' : 'bg-amber-50 text-amber-950'}`}><p className="text-lg font-extrabold">{winner.outcome === 'eliminated' ? `${winner.name} HAS BEEN ELIMINATED 😭` : `🎉 ${winner.name} WINS ${money(winner.prize)}`}</p><p className="mt-1 text-sm">{winner.outcome === 'eliminated' ? `${active.length} Swifters remain` : 'Congratulations!'}</p></div>}</section><aside className="space-y-5"><Card className="border-violet-100 p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-500">In the draw</p><p className="mt-1 text-3xl font-extrabold text-violet-950">{active.length} <span className="text-sm font-semibold text-slate-500">Swifters</span></p></div><div className="rounded-2xl bg-violet-100 p-3 text-violet-700"><Sparkles /></div></div><div className="mt-4 flex flex-wrap gap-2">{active.map((c) => <span key={c.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{c.name}</span>)}</div>{watching > 1 && <p className="mt-4 text-xs font-semibold text-slate-500">{watching} watching live</p>}</Card><Card className="border-violet-100 p-5"><h3 className="font-extrabold text-violet-950">Winners</h3>{state.prizes.map((prize, index) => <div key={`${prize}-${index}`} className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm"><span>{['🥉','🥈','🥇'][index] || '🏆'} {state.winners[index]?.name || 'Waiting…'}</span><b>{money(state.winners[index]?.prize ?? prize)}</b></div>)}</Card><button type="button" onClick={() => setHelp((v) => !v)} className="flex w-full items-center justify-between rounded-2xl border border-violet-100 bg-white p-4 text-left text-sm font-bold text-violet-900"><span className="flex items-center gap-2"><CircleHelp className="h-4 w-4" />How winners are selected</span>{help ? <ChevronUp /> : <ChevronDown />}</button>{help && <p className="-mt-3 rounded-b-2xl border border-t-0 border-violet-100 bg-white p-4 pt-5 text-xs leading-5 text-slate-600">Every active Swifter has an equal chance. The winning position is selected securely by the SwiftDU server before the wheel animation begins. The wheel only displays the result.</p>}</aside></div>{eliminated.length > 0 && <section className="mt-5 rounded-3xl border border-rose-100 bg-white p-5"><h3 className="font-extrabold text-violet-950">Eliminated</h3><div className="mt-3 flex flex-wrap gap-2">{eliminated.map((c, i) => <span key={c.id} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">{state.eliminations[i]?.round || i + 1}th — {c.name}</span>)}</div></section>}{admin && <AdminControls state={state} names={names} setNames={setNames} action={adminAction} error={error} />}</div></main>
}

function AdminControls({ state, names, setNames, action, error }: { state: State; names: string; setNames: (v: string) => void; action: (event: string, payload?: unknown) => Promise<void>; error: string }) { const [confirm, setConfirm] = useState(false); return <section className="mt-5 grid gap-5 lg:grid-cols-2"><Card className="p-5"><div className="flex items-center gap-2"><Settings2 className="text-violet-600" /><h2 className="font-extrabold">Control room</h2></div>{error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}<div className="mt-4 grid grid-cols-2 gap-2"><Button disabled={state.status === 'spinning' || state.status === 'waiting'} onClick={() => void action('giveaway:admin-spin')} className="col-span-2 h-14 bg-violet-700 text-base hover:bg-violet-800">{state.status === 'spinning' ? 'Spinning…' : 'SPIN THE WHEEL 🎡'}</Button><Button variant="outline" onClick={() => void action('giveaway:admin-start')} disabled={state.status !== 'waiting'}>Start Giveaway</Button><Button variant="outline" onClick={() => void action('giveaway:admin-finish')} disabled={state.status === 'finished'}>Finish Giveaway</Button></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><label className="text-sm font-bold">Game mode<select value={state.mode} onChange={(e) => void action('giveaway:admin-set-mode', { mode: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="elimination">Last Swifter Standing</option><option value="winner">Winner Draw</option></select></label><label className="text-sm font-bold">Current prize<select value={state.currentPrize ?? ''} onChange={(e) => void action('giveaway:admin-set-prize', { amount: Number(e.target.value), index: state.winners.length })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="1500">₦1,500</option><option value="2500">₦2,500</option><option value="4000">₦4,000</option></select></label></div><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold">Contestants (one per line)</p><textarea value={names} onChange={(e) => setNames(e.target.value)} placeholder="Precious&#10;David&#10;Sarah" className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" disabled={state.status !== 'waiting'} /><Button variant="outline" className="mt-2" disabled={state.status !== 'waiting' || !names.trim()} onClick={() => void action('giveaway:admin-update-contestants', { names: names.split('\n') })}>Save contestants</Button></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-slate-500">Danger zone</span>{confirm ? <span className="flex gap-2"><Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="destructive" onClick={() => { setConfirm(false); void action('giveaway:admin-reset') }}>Reset Giveaway</Button></span> : <Button variant="outline" onClick={() => setConfirm(true)}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button>}</div></Card><Card className="p-5"><h2 className="font-extrabold">Contestant recovery</h2><div className="mt-3 space-y-2">{state.contestants.map((contestant) => <div key={contestant.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3"><span className={`text-sm font-semibold ${contestant.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{contestant.name}</span><Button size="sm" variant="outline" onClick={() => void action(`giveaway:admin-${contestant.active ? 'remove' : 'restore'}-contestant`, { contestantId: contestant.id })}>{contestant.active ? 'Remove' : 'Restore'}</Button></div>)}</div></Card></section> }
