'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import {
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ShoppingBag,
  ShieldCheck,
  Star,
  Users,
  X,
} from 'lucide-react'

const adminNavigation = [
  {
    label: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Platform summary',
  },
  {
    label: 'Taskers',
    href: '/admin/taskers',
    icon: Users,
    description: 'Review taskers',
  },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: ShoppingBag,
    description: 'Manage errands',
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    description: 'Manage accounts',
  },
  {
    label: 'Transactions',
    href: '/admin/transactions',
    icon: DollarSign,
    description: 'Track payments',
  },
  {
    label: 'Reviews',
    href: '/admin/reviews',
    icon: Star,
    description: 'Moderate feedback',
  },
  {
    label: 'Support',
    href: '/admin/support',
    icon: MessageSquare,
    description: 'Handle tickets',
  },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/admin') {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push('/login'),
      },
    })
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[60] flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-300/40">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Swiftdu Admin</p>
            <p className="text-xs text-slate-500">Control center</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
          aria-label={isMobileMenuOpen ? 'Close admin menu' : 'Open admin menu'}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-xl transition-transform duration-300 ease-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <Link
            href="/admin"
            onClick={closeMobileMenu}
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/40">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-950">Swiftdu Admin</h1>
              <p className="text-xs text-slate-500">Manage the platform</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {adminNavigation.map((item) => {
            const Icon = item.icon
            const active = isActivePath(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                  active
                    ? 'bg-slate-950 text-white shadow-lg shadow-slate-300/35'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : ''}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className={`text-xs ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                    {item.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="hidden w-72 shrink-0 lg:block" />
    </>
  )
}
