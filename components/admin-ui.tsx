import type { ComponentType, ReactNode } from 'react'
import { LoaderCircle, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'brand' | 'info' | 'warning' | 'success' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-violet-50 text-violet-700 ring-violet-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export function AdminPageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-slate-500 sm:text-base">{description}</p></div>{action}</header>
}

export function AdminSection({ title, description, children, className }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={cn('rounded-3xl border border-slate-200/80 bg-white shadow-sm', className)}>{title && <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="font-semibold text-slate-900">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>}{children}</section>
}

export function AdminStatCard({ label, value, detail, icon: Icon, tone = 'brand', className }: { label: string; value: ReactNode; detail?: ReactNode; icon: ComponentType<{ className?: string }>; tone?: Tone; className?: string }) {
  return <div className={cn('rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm', className)}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p></div><div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1', tones[tone])}><Icon className="h-5 w-5" /></div></div>{detail && <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>}</div>
}

export function AdminStatusBadge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn('inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>{children}</span>
}

export function AdminLoadingState({ label = 'Loading…', fullPage = false }: { label?: string; fullPage?: boolean }) {
  return <div className={cn('flex items-center justify-center py-14', fullPage && 'min-h-screen bg-slate-50')}><div className="flex items-center gap-3 text-sm font-medium text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin text-violet-600" />{label}</div></div>
}

export function AdminEmptyState({ title, description, icon: Icon = Inbox }: { title: string; description?: string; icon?: ComponentType<{ className?: string }> }) {
  return <div className="px-5 py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Icon className="h-5 w-5" /></div><h3 className="mt-4 font-semibold text-slate-900">{title}</h3>{description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}</div>
}

export const adminInputClass = 'min-h-11 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-violet-400 focus-visible:ring-violet-200'
export const adminButtonClass = 'min-h-11 rounded-xl font-semibold focus-visible:ring-violet-300'
