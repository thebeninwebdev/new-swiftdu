'use client'

import {useMemo, useState, useEffect} from 'react'
import {useRouter, usePathname} from 'next/navigation'
import Image from 'next/image'
import { createAvatar } from '@dicebear/core'
import * as adventurerNeutral from '@dicebear/adventurer-neutral'
import { authClient } from '@/lib/auth-client'
import {LogOut, PlusCircle, ListTodo, User, Bell, UserPlus, Star, BriefcaseBusiness, Shirt} from 'lucide-react'


// Navigation items configuration
const navigationItems = [
  {
    label: 'Book a Task',
    href: '/dashboard',
    icon: PlusCircle,
    description: 'Post a new errand'
  },
  {
    label: 'My Tasks',
    href: '/dashboard/tasks',
    icon: ListTodo,
    description: 'View your errands'
  },
  {
    label: 'Notifications',
    href: '/dashboard/notifications',
    icon: Bell,
    description: 'Payments and reviews',
    notification: true,
  },
  {
    label: 'Reviews',
    href: '/dashboard/reviews',
    icon: Star,
    description: 'Rate completed tasks'
  },
  {
    label: 'Account',
    href: '/dashboard/account',
    icon: User,
    description: 'Profile settings'
  }
]

interface DashboardOrder {
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  hasPaid?: boolean
  taskerId?: string | null
  isDeclinedTask?: boolean
}

interface ExcoDashboardAccess {
  excoRole: string
  label: string
  dashboardPath: string
}

interface HeaderProfile {
  name: string
  email: string
  profileImage: string
}

export default function DashboardMenu() {
  const { data: session } = authClient.useSession()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasNotification, setHasNotification] = useState(false)
  const [excoDashboard, setExcoDashboard] = useState<ExcoDashboardAccess | null>(null)
  const [headerProfile, setHeaderProfile] = useState<HeaderProfile | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const sessionUserId = session?.user?.id
  const userName = headerProfile?.name || session?.user?.name || 'SwiftDU user'
  const userEmail = headerProfile?.email || session?.user?.email || ''
  const userEmailName = userEmail.split('@')[0] || ''
  const savedProfileImage = headerProfile?.profileImage || session?.user?.profileImage || ''
  const avatarSeed = [
    session?.user?.id,
    session?.user?.email,
    session?.user?.name,
  ]
    .filter(Boolean)
    .join(':') || 'swiftdu-user'
  const generatedAvatar = useMemo(
    () =>
      createAvatar(adventurerNeutral, {
        seed: avatarSeed,
        size: 96,
        radius: 50,
        backgroundColor: ['e0f2fe', 'eef2ff', 'ecfeff'],
        backgroundType: ['gradientLinear'],
      }).toDataUri(),
    [avatarSeed]
  )
  const userAvatar = savedProfileImage || generatedAvatar
  const isTasker = session?.user.role === 'tasker'
  const taskerAction = isTasker
    ? {
        href: '/tasker-dashboard',
        title: 'Open Tasker Dashboard',
        description: 'Switch to your tasker workspace and manage errands.',
        mobileDescription: 'Go to your tasker workspace',
      }
    : {
        href: '/tasker-signup',
        title: 'Become a Tasker',
        description: 'Apply to earn from errands while keeping your user account.',
        mobileDescription: 'Open the tasker signup page',
      }

  // Notification check: any active order that needs attention
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const [activeRes, reviewsRes] = await Promise.all([
          fetch('/api/orders?status=pending,in_progress,paid&limit=12'),
          fetch('/api/orders?status=completed&needsReview=true'),
        ])

        const activeOrders: DashboardOrder[] = activeRes.ok
          ? await activeRes.json()
          : []
        const pendingReviews: Array<{ _id: string }> = reviewsRes.ok
          ? await reviewsRes.json()
          : []

        const hasOutstandingActiveOrder = activeOrders.some(
          (order) =>
            order.isDeclinedTask ||
            (order.status !== 'pending' && !!order.taskerId && !order.hasPaid)
        )

        setHasNotification(hasOutstandingActiveOrder || pendingReviews.length > 0)
      } catch {
        setHasNotification(false)
      }
    }
    fetchNotifications()
  }, [])

  useEffect(() => {
    if (!sessionUserId) return

    let isMounted = true

    async function fetchHeaderProfile() {
      try {
        const response = await fetch('/api/users/me/profile', { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json()
        if (isMounted) {
          setHeaderProfile({
            name: payload.user?.name || '',
            email: payload.user?.email || '',
            profileImage: payload.user?.profileImage || '',
          })
        }
      } catch {
        if (isMounted) {
          setHeaderProfile(null)
        }
      }
    }

    void fetchHeaderProfile()
    window.addEventListener('swiftdu-profile-updated', fetchHeaderProfile)

    return () => {
      isMounted = false
      window.removeEventListener('swiftdu-profile-updated', fetchHeaderProfile)
    }
  }, [sessionUserId])

  useEffect(() => {
    if (!sessionUserId) return

    async function fetchExcoDashboard() {
      try {
        const response = await fetch('/api/exco/me', { cache: 'no-store' })
        if (!response.ok) return

        const data = (await response.json()) as Partial<ExcoDashboardAccess>
        if (data.excoRole && data.label && data.dashboardPath) {
          setExcoDashboard({
            excoRole: data.excoRole,
            label: data.label,
            dashboardPath: data.dashboardPath,
          })
        } else {
          setExcoDashboard(null)
        }
      } catch {
        setExcoDashboard(null)
      }
    }

    void fetchExcoDashboard()
  }, [sessionUserId])

  useEffect(() => {
    if (!isMobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileMenuOpen])

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => router.push('/login') }
    })
  }

  const handleNavigation = (href: string) => {
    if (href !== pathname) {
      router.push(href)
    }
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 lg:flex">
        {/* Logo Area */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-lg shadow-indigo-500/20 dark:border-slate-800 dark:bg-slate-900">
              <Image
                src={userAvatar}
                alt={`${userName} avatar`}
                width={44}
                height={44}
                unoptimized
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-white">{userName}</h1>
              <p className="truncate text-xs text-slate-500">User Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            const isNotification = item.notification
            return (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                  isActive
                    ? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className="relative">
                  <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : ''}`} />
                  {isNotification && hasNotification && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                    </span>
                  )}
                </span>
                <div className="text-left">
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className={`text-xs ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {item.description}
                  </p>
                </div>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
              </button>
            )
          })}
        </nav>

        <div className="px-4 pb-4">
          <button
            onClick={() => handleNavigation(taskerAction.href)}
            className="w-full rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 p-4 text-left text-white shadow-lg shadow-emerald-500/20 transition-transform duration-300 hover:scale-[1.01]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-white/20 p-2">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{taskerAction.title}</p>
                <p className="mt-1 text-xs text-emerald-50">
                  {taskerAction.description}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleNavigation('/dry-cleaner-signup/signup')}
            className="mt-3 w-full rounded-2xl bg-linear-to-r from-cyan-500 to-blue-500 p-4 text-left text-white shadow-lg shadow-cyan-500/20 transition-transform duration-300 hover:scale-[1.01]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-white/20 p-2">
                <Shirt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Sign up as Dry Cleaner</p>
                <p className="mt-1 text-xs text-cyan-50">
                  Register your laundry business for approval.
                </p>
              </div>
            </div>
          </button>

          {excoDashboard ? (
            <button
              onClick={() => handleNavigation(excoDashboard.dashboardPath)}
              className="mt-3 w-full rounded-2xl bg-linear-to-r from-amber-500 to-sky-500 p-4 text-left text-white shadow-lg shadow-amber-500/20 transition-transform duration-300 hover:scale-[1.01]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-white/20 p-2">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{excoDashboard.excoRole} Dashboard</p>
                  <p className="mt-1 text-xs text-amber-50">
                    Open your executive workspace.
                  </p>
                </div>
              </div>
            </button>
          ) : null}
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-sm font-medium"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>
      <div className="hidden w-72 shrink-0 lg:block" aria-hidden="true" />
    
          {/* Mobile Header */}
          <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200/70 bg-linear-to-br from-slate-50 via-white to-slate-100 px-4 backdrop-blur-xl dark:border-slate-800/70 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 lg:hidden">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-md outline-none transition hover:ring-2 hover:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900"
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMobileMenuOpen}
              >
                <Image
                  src={userAvatar}
                  alt={`${userName} avatar`}
                  width={36}
                  height={36}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNavigation('/dashboard/notifications')}
                className="relative rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Open notifications"
              >
                <Bell className="h-5 w-5" />
                {hasNotification ? (
                  <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600"></span>
                  </span>
                ) : null}
              </button>
            </div>
          </header>
    
          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-70 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
              <div 
                className="absolute bottom-0 left-0 top-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-300 dark:bg-slate-900 overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-5 mt-5">
                  <div className="flex flex-col items-left gap-3">
                    <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-md dark:border-slate-800 dark:bg-slate-900 ml-1">
                      <Image
                        src={userAvatar}
                        alt={`${userName} avatar`}
                        width={80}
                        height={80}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900 dark:text-white text-3xl">{userName}</p>
                      {userEmailName ? (
                        <p className="truncate text-slate-500 dark:text-slate-400">@{userEmailName}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <nav className="flex-1 space-y-2 p-4 pb-6">
                  {navigationItems.map((item) => {
                    const isActive = pathname === item.href
                    const Icon = item.icon
                    
                    return (
                      <button
                        key={item.href}
                        onClick={() => handleNavigation(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                          isActive 
                            ? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white' 
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    )
                  })}

                  <div className="pt-2">
                    <button
                      onClick={() => handleNavigation(taskerAction.href)}
                      className="w-full rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 px-4 py-3 text-left text-white shadow-lg shadow-emerald-500/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-white/20 p-2">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{taskerAction.title}</p>
                          <p className="text-xs text-emerald-50">{taskerAction.mobileDescription}</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => handleNavigation('/dry-cleaner-signup/signup')}
                      className="w-full rounded-xl bg-linear-to-r from-cyan-500 to-blue-500 px-4 py-3 text-left text-white shadow-lg shadow-cyan-500/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-white/20 p-2">
                          <Shirt className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">Sign up as Dry Cleaner</p>
                          <p className="text-xs text-cyan-50">Register your laundry business</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {excoDashboard ? (
                    <div className="pt-2">
                      <button
                        onClick={() => handleNavigation(excoDashboard.dashboardPath)}
                        className="w-full rounded-xl bg-linear-to-r from-amber-500 to-sky-500 px-4 py-3 text-left text-white shadow-lg shadow-amber-500/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-white/20 p-2">
                            <BriefcaseBusiness className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">{excoDashboard.excoRole} Dashboard</p>
                            <p className="text-xs text-amber-50">Open your executive workspace</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  ) : null}
                  
                  <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
                    <button 
                      onClick={signOut}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium">Sign Out</span>
                    </button>
                  </div>
                </nav>
              </div>
            </div>
          )}</>
  )
}
