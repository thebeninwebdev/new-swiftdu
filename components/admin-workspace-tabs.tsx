'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { buildAdminWorkspaceTabHref, resolveAdminWorkspaceTab, type AdminWorkspace } from '@/lib/admin-workspaces'

export type AdminWorkspaceTab = { value: string; label: string; resetParams?: readonly string[] }

export function useAdminWorkspaceTab(workspace: AdminWorkspace) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const candidate = searchParams.get('tab')
  const active = resolveAdminWorkspaceTab(workspace, candidate)

  useEffect(() => {
    if (!candidate || candidate === active) return
    router.replace(buildAdminWorkspaceTabHref({ pathname, search: searchParams.toString(), tab: active }), { scroll: false })
  }, [active, candidate, pathname, router, searchParams])

  return active
}

export function AdminWorkspaceTabs({ workspace, tabs }: { workspace: AdminWorkspace; tabs: AdminWorkspaceTab[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = resolveAdminWorkspaceTab(workspace, searchParams.get('tab'))

  return (
    <nav aria-label="Workspace sections" className="mb-6 overflow-x-auto pb-1">
      <div className="flex w-max min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={buildAdminWorkspaceTabHref({ pathname, search: searchParams.toString(), tab: tab.value, reset: tab.resetParams })}
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
