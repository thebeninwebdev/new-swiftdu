'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export type AdminWorkspaceTab = { value: string; label: string }

export function AdminWorkspaceTabs({ tabs }: { tabs: AdminWorkspaceTab[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = searchParams.get('tab') || tabs[0]?.value

  return (
    <nav aria-label="Workspace sections" className="mb-6 overflow-x-auto pb-1">
      <div className="flex w-max min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`${pathname}?tab=${tab.value}`}
            aria-current={active === tab.value ? 'page' : undefined}
            className={`min-h-10 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              active === tab.value ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
