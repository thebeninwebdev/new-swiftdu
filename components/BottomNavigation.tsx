'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell, CircleUserRound, Clock3, Headphones, Home, ListTodo, LogOut, Menu, Power, UserRound, X, type LucideIcon } from 'lucide-react'
import { useTaskerWork } from '@/components/tasker/WorkProvider'
import { authClient } from '@/lib/auth-client'

const spring = { type: 'spring' as const, stiffness: 390, damping: 32, mass: 0.82 }
type NavId = 'home' | 'tasks' | 'work' | 'history' | 'more'
type NavItem = { id: NavId; label: string; href?: string; icon: LucideIcon }
const navigation: NavItem[] = [
  { id: 'home', label: 'Home', href: '/tasker-dashboard', icon: Home },
  { id: 'tasks', label: 'Tasks', href: '/tasker-dashboard?accepted=true', icon: ListTodo },
  { id: 'work', label: 'Check In', icon: Power },
  { id: 'history', label: 'History', href: '/tasker-dashboard/history', icon: Clock3 },
  { id: 'more', label: 'More', icon: Menu },
]
const moreNavigation = [
  { label: 'Profile', href: '/tasker-dashboard/profile', icon: CircleUserRound },
  { label: 'Notifications', href: '/tasker-dashboard/notifications', icon: Bell },
  { label: 'Support', href: '/tasker-dashboard/support', icon: Headphones },
  { label: 'User dashboard', href: '/dashboard', icon: UserRound },
]

function notchPath(index: number, width = 500, height = 86) {
  const center = width * ((index + 0.5) / 5)
  const radius = 36
  const left = center - radius
  const right = center + radius
  const curve = radius * 0.55228475
  // A pair of Bézier curves forms a true circular dip for the floating button.
  return `M 24 0 H ${left} C ${left} ${curve} ${center - curve} ${radius} ${center} ${radius} C ${center + curve} ${radius} ${right} ${curve} ${right} 0 H ${width - 24} Q ${width} 0 ${width} 24 V ${height - 24} Q ${width} ${height} ${width - 24} ${height} H 24 Q 0 ${height} 0 ${height - 24} V 24 Q 0 0 24 0 Z`
}

export default function TaskerBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const work = useTaskerWork()
  const [moreOpen, setMoreOpen] = useState(false)
  const checkedIn = work.data?.checkedIn === true
  const accepted = searchParams.get('accepted') === 'true'
  const routeActive = (pathname.startsWith('/tasker-dashboard/history') ? 'history' : pathname.startsWith('/tasker-dashboard/profile') || pathname.startsWith('/tasker-dashboard/notifications') || pathname.startsWith('/tasker-dashboard/support') ? 'more' : pathname === '/tasker-dashboard' && accepted ? 'tasks' : 'home') as NavId
  const active: NavId = moreOpen ? 'more' : routeActive
  const index = navigation.findIndex(item => item.id === active)
  const transition = reduceMotion ? { duration: 0 } : spring
  if (/^\/tasker-dashboard\/[a-f\d]{24}$/i.test(pathname)) return null
  const checkIn = () => { if (work.loading || work.saving) return; setMoreOpen(false); if (checkedIn || work.data?.status === 'busy') work.requestCheckout(); else void work.checkIn() }
  const logout = async () => { await authClient.signOut(); setMoreOpen(false); router.push('/auth') }
  return <>
    <AnimatePresence>{moreOpen && <><motion.button aria-label="Close menu" onClick={() => setMoreOpen(false)} className="fixed inset-0 z-[60] bg-slate-950/25 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.div className="fixed inset-x-3 bottom-[calc(86px+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950 lg:hidden" initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }} transition={transition}><div className="flex items-center justify-between px-3 py-2"><div><p className="font-semibold">More</p><p className="text-xs text-slate-500">Your Tasker account</p></div><button type="button" onClick={() => setMoreOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"><X className="h-4 w-4" /></button></div><div className="mt-2 grid grid-cols-2 gap-2">{moreNavigation.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-14 items-center gap-3 rounded-2xl bg-slate-50 px-4 text-sm font-medium dark:bg-slate-900"><Icon className="h-5 w-5" />{item.label}</Link> })}</div><button type="button" onClick={logout} className="mt-2 flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-sm font-medium text-red-600"><LogOut className="h-5 w-5" />Sign out</button></motion.div></>}</AnimatePresence>
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}><div className="relative mx-auto h-[96px] w-full max-w-[500px] px-2"><svg viewBox="0 0 500 86" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-2 bottom-1 h-[86px] w-[calc(100%-16px)] drop-shadow-[0_8px_18px_rgba(15,23,42,0.16)]"><motion.path initial={false} animate={{ d: notchPath(index) }} transition={transition} fill="currentColor" className="text-white dark:text-slate-950" /></svg><nav aria-label="Tasker navigation" className="pointer-events-auto absolute inset-x-2 bottom-1 grid h-[86px] grid-cols-5"><motion.span aria-hidden="true" className={`pointer-events-none absolute top-[-17px] h-[58px] w-[58px] rounded-full bg-gradient-to-br shadow-[0_8px_22px_rgba(124,58,237,0.32)] ${active === 'work' && checkedIn ? 'from-emerald-500 to-emerald-600 shadow-emerald-500/30' : 'from-indigo-600 to-purple-600'}`} animate={{ left: `calc(${(index * 20) + 10}% - 29px)` }} transition={transition} />{navigation.map(item => item.id === 'work' ? <NavButton key={item.id} item={{ ...item, label: work.data?.status === 'busy' ? 'Working' : checkedIn ? 'Check out' : 'Check In' }} active={active === item.id} checkedIn={checkedIn} disabled={work.loading || work.saving || !work.data} onClick={checkIn} /> : item.id === 'more' ? <NavButton key={item.id} item={item} active={active === item.id} onClick={() => setMoreOpen(value => !value)} /> : <NavLink key={item.id} item={item} active={active === item.id} onClick={() => setMoreOpen(false)} />)}</nav></div></div>
  </>
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) { const Icon = item.icon; return <Link href={item.href!} onClick={onClick} aria-current={active ? 'page' : undefined} className="relative flex min-h-[44px] min-w-0 items-center justify-center"><motion.span className="absolute inset-x-0 z-10 mx-auto flex h-[58px] w-[58px] items-center justify-center" initial={false} animate={{ top: active ? -17 : 19 }} transition={spring}><Icon className={active ? 'h-[22px] w-[22px] text-white' : 'h-[22px] w-[22px] text-slate-500 dark:text-slate-400'} strokeWidth={active ? 2.4 : 2} /><motion.span animate={{ opacity: active ? 0 : 1, y: active ? 6 : 0 }} transition={{ duration: .18 }} className="absolute left-1/2 top-[44px] -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-slate-500 dark:text-slate-400">{item.label}</motion.span></motion.span></Link> }
function NavButton({ item, active, checkedIn = false, onClick, disabled = false }: { item: NavItem; active: boolean; checkedIn?: boolean; onClick: () => void; disabled?: boolean }) { const Icon = item.icon; const work = item.id === 'work'; return <button type="button" onClick={onClick} disabled={disabled} aria-pressed={work ? checkedIn : undefined} className="relative flex min-h-[44px] min-w-0 items-center justify-center"><motion.span className="absolute inset-x-0 z-10 mx-auto flex h-[58px] w-[58px] items-center justify-center" initial={false} animate={{ top: active ? -17 : 19 }} transition={spring}><Icon className={active ? 'h-[22px] w-[22px] text-white' : work && checkedIn ? 'h-[22px] w-[22px] text-emerald-600' : 'h-[22px] w-[22px] text-slate-500 dark:text-slate-400'} strokeWidth={active ? 2.4 : 2} /><motion.span animate={{ opacity: active ? 0 : 1, y: active ? 6 : 0 }} transition={{ duration: .18 }} className={work && checkedIn ? 'absolute left-1/2 top-[44px] -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-emerald-600' : 'absolute left-1/2 top-[44px] -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-slate-500 dark:text-slate-400'}>{item.label}</motion.span></motion.span></button> }
