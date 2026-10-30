'use client'

import dynamic from 'next/dynamic'
import Image, { type StaticImageData } from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, Droplets, FileText, Loader2, ShoppingBag, Store, type LucideIcon } from 'lucide-react'
import { useTaskerEligibility } from '@/hooks/use-tasker-eligibility'
import { formatNextOperationalOpening, getCustomerOperationsState, isCustomerOrderingUnavailable, type CustomerOperationsStatus } from '@/lib/operations-display'
import taskFoodImage from '@/public/dashboard/tasks/task-food.webp'
import taskStoreShoppingImage from '@/public/dashboard/tasks/task-store-shopping.webp'
import taskPrintingImage from '@/public/dashboard/tasks/task-printing.webp'
import taskWaterImage from '@/public/dashboard/tasks/task-water.webp'

const DashboardOrderWizard = dynamic(() => import('@/components/dashboard-order-wizard'), {
  ssr: false,
  loading: () => <div className="flex min-h-[60dvh] items-center justify-center gap-3 text-sm font-semibold text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-violet-600" />Opening booking…</div>,
})

type ActiveOrder = { _id: string; taskType: string; status: string; isDeclinedTask?: boolean; taskerId?: string | null; hasPaid?: boolean }
type Service = { value: string; label: string; description: string; icon: LucideIcon; image: StaticImageData }
const services: Service[] = [
  { value: 'restaurant', label: 'Restaurant Food', description: 'Food & meals', icon: ShoppingBag, image: taskFoodImage },
  { value: 'shopping', label: 'Store Shopping', description: 'Groceries', icon: Store, image: taskStoreShoppingImage },
  { value: 'printing', label: 'Printing Services', description: 'Documents', icon: FileText, image: taskPrintingImage },
  { value: 'water', label: 'Bag of Water', description: 'Per bag', icon: Droplets, image: taskWaterImage },
]

export function DashboardLanding({ userName, initialTrainingMode }: { userName: string; initialTrainingMode: boolean }) {
  const router = useRouter()
  const canApplyAsTasker = useTaskerEligibility()
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [operations, setOperations] = useState<CustomerOperationsStatus | null>(null)
  const [criticalReady, setCriticalReady] = useState(false)
  const [criticalFailed, setCriticalFailed] = useState(false)
  const [trainingMode, setTrainingMode] = useState(initialTrainingMode)

  useEffect(() => {
    const updateMode = (event: Event) => {
      setTrainingMode((event as CustomEvent<{ testOrderMode?: boolean }>).detail?.testOrderMode === true)
    }
    window.addEventListener('swiftdu-exco-order-mode-changed', updateMode)
    return () => window.removeEventListener('swiftdu-exco-order-mode-changed', updateMode)
  }, [])

  useEffect(() => {
    let active = true
    const load = () => void Promise.all([
      fetch('/api/orders?current=true', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch('/api/operations/status', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()),
    ]).then(([order, status]) => {
      if (!active) return
      setActiveOrder(order || null); setOperations(status); setCriticalFailed(false)
      performance.mark?.('dashboard-critical-ready')
    }).catch(() => { if (active) setCriticalFailed(true) }).finally(() => { if (active) setCriticalReady(true) })
    const refreshVisible = () => { if (document.visibilityState === 'visible') load() }
    load()
    const interval = window.setInterval(refreshVisible, 60_000)
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', refreshVisible)
    performance.mark?.('dashboard-shell-rendered')
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', refreshVisible) }
  }, [])

  useEffect(() => {
    if (!activeOrder?._id) return
    let disposed = false
    let release: (() => void) | undefined
    const refreshOrder = () => void fetch('/api/orders?current=true', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((order) => { if (!disposed) setActiveOrder(order || null) }).catch(() => undefined)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refreshOrder() }, 5_000)
    void import('@/lib/client-socket').then(({ acquireSharedSocket, releaseSharedSocket }) => {
      if (disposed) return
      const socket = acquireSharedSocket()
      const update = () => refreshOrder()
      socket.on('order:updated', update)
      release = () => { socket.off('order:updated', update); releaseSharedSocket(socket) }
    })
    return () => { disposed = true; window.clearInterval(timer); release?.() }
  }, [activeOrder?._id])

  if (selectedService) return <DashboardOrderWizard initialTaskType={selectedService} onClose={() => setSelectedService(null)} />

  const operationsState = operations ? getCustomerOperationsState(operations) : null
  const unavailable = isCustomerOrderingUnavailable(operations, trainingMode)
  const openService = (service: string) => {
    if (!criticalReady) return
    if (activeOrder) { router.push(`/dashboard/tasks/${activeOrder._id}`); return }
    if (!unavailable) setSelectedService(service)
  }

  return <main className="min-h-screen px-4 py-4 md:px-8 md:py-8">
    <div className="mx-auto max-w-4xl">
      {activeOrder ? <div className="mb-5 rounded-3xl border border-indigo-200 bg-linear-to-r from-indigo-50 via-white to-cyan-50 p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">Latest active order</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold text-slate-950">Your {activeOrder.taskType.replaceAll('_', ' ')} order is still active</h2><p className="mt-1 text-sm text-slate-600">Open tracking to continue with payment and delivery updates.</p></div><button onClick={() => router.push(`/dashboard/tasks/${activeOrder._id}`)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white">Open Tracker<ArrowRight className="ml-2 h-4 w-4" /></button></div></div> : null}
      {unavailable && operations ? <div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><Clock3 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">{operationsState === 'paused' ? 'SwiftDU is temporarily paused' : 'SwiftDU is closed right now'}</p><p className="mt-1 text-sm">{operationsState === 'paused' ? 'New orders are unavailable. Existing orders continue normally.' : `Ordering opens ${formatNextOperationalOpening(operations.nextOpeningAt, operations.openingTime)}.`}</p></div></div> : null}

      <section className="overflow-hidden rounded-[2rem] border border-indigo-100 bg-white shadow-[0_28px_80px_-36px_rgba(79,70,229,0.3)]">
        <div className="bg-linear-to-r from-[#f7f5ff] to-[#f4f7ff] px-5 py-6 text-center sm:px-8">
          <div className="mx-auto h-[130px] w-[130px] sm:h-[140px] sm:w-[140px] dashboard-swifty-idle">
            {/* Swifty is the landing LCP asset; expose it directly in initial HTML. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot/idle.webp" alt="Swifty welcoming you" width="140" height="140" fetchPriority="high" className="h-full w-full object-contain" />
          </div>
          <p className="mx-auto mt-2 w-fit rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-violet-800 shadow-sm">Hi {userName.split(' ')[0]}, what can I help you with?</p>
        </div>
        <div className="p-4 sm:p-8">
          <h1 className="text-2xl font-black text-slate-950">Choose a service</h1><p className="mt-1 text-sm text-slate-500">Select the errand you need help with.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">{services.map((service) => { const Icon = service.icon; return <button key={service.value} type="button" disabled={!criticalReady || criticalFailed || Boolean(activeOrder) || unavailable} onClick={() => openService(service.value)} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md disabled:cursor-wait disabled:opacity-70"><div className="relative aspect-[16/9] overflow-hidden bg-slate-100"><Image src={service.image} alt="" fill sizes="(max-width: 640px) 45vw, 340px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" /></div><div className="flex items-start gap-3 p-3 sm:p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Icon className="h-4 w-4" /></span><span><strong className="block text-sm text-slate-950 sm:text-base">{service.label}</strong><span className="mt-0.5 block text-xs text-slate-500 sm:text-sm">{service.description}</span></span></div></button> })}</div>
          {!criticalReady ? <p role="status" className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking your current orders and availability…</p> : null}
          {criticalFailed ? <p role="alert" className="mt-4 text-center text-sm text-amber-700">We couldn’t verify ordering availability. Refresh to try again.</p> : null}
        </div>
      </section>
      {canApplyAsTasker ? <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-indigo-200 bg-white/80 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold text-slate-950">Earn by helping on campus</h2><p className="mt-1 text-sm text-slate-600">Become a SwiftDU tasker and earn by helping other students.</p></div><a href="/tasker-signup/signup" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">Apply to be a tasker</a></section> : null}
    </div>
  </main>
}
