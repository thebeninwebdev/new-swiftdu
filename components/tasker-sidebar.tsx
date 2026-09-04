'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Star,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'
import { acquireSharedSocket, fetchWithSocketPause, releaseSharedSocket } from '@/lib/client-socket'
import { useIdleEffect } from '@/hooks/use-idle-effect'

interface UnpaidOrder {
  _id: string
  platformFee: number
  description: string
  status: string
  settlementStatus: 'not_due' | 'pending' | 'initialized' | 'paid' | 'failed' | 'overdue'
  settlementDueAt?: string
  completedAt?: string
}

interface UserType {
  name?: string | null
  email?: string | null
  image?: string | null
  rating?: number
  completedTasks?: number
  taskerId?: string
}

interface TaskerProfileType {
  profileImage?: string
  isSettlementSuspended?: boolean
}

const TASKER_NOTIFICATION_TOAST_ID = 'tasker-dashboard-notification'

const formatDueDate = (date?: string) =>
  date
    ? new Date(date).toLocaleString('en-NG', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'soon'

const navigation = [
  {
    name: 'Dashboard',
    href: '/tasker-dashboard',
    icon: LayoutDashboard,
    description: 'Overview and active tasks',
  },
  {
    name: 'Available Errands',
    href: '/tasker-dashboard?accepted=true',
    icon: ListTodo,
    description: 'Find errands',
  },
  {
    name: 'History',
    href: '/tasker-dashboard/history',
    icon: ListTodo,
    description: 'Completed errands',
  },
  {
    name: 'Support',
    href: '/tasker-dashboard/support',
    icon: MessageSquare,
    description: 'Get help',
  },
]

const secondaryNavigation = [
  {
    name: 'Profile Settings',
    href: '/tasker-dashboard/profile',
    icon: Settings,
    description: 'Profile settings',
  },
  {
    name: 'Notifications',
    href: '/tasker-dashboard/notifications',
    icon: Bell,
    description: 'Settlement alerts',
  },
]

export default function TaskerSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<UserType | undefined>()
  const [taskerProfile, setTaskerProfile] = useState<TaskerProfileType | undefined>()
  const [taskerStats, setTaskerStats] = useState({ completedTasks: 0, rating: 0 })
  const [unpaidOrders, setUnpaidOrders] = useState<UnpaidOrder[]>([])
  const [dismissedNotificationId, setDismissedNotificationId] = useState<string | null>(null)
  const [isMobileTitleTransparent, setIsMobileTitleTransparent] = useState(false)

  const fetchTaskerStats = useCallback(async (taskerId: string) => {
    try {
      const statsRes = await fetchWithSocketPause(`/api/taskers/stats?taskerId=${taskerId}`)
      if (!statsRes.ok) return

      const stats = await statsRes.json()
      setTaskerStats({
        completedTasks: stats.completedTasks || 0,
        rating: stats.rating || 0,
      })
    } catch {
      // Ignore transient sidebar stat refresh failures.
    }
  }, [])

  const fetchUnpaidOrders = useCallback(async () => {
    try {
      const unpaidRes = await fetchWithSocketPause('/api/taskers/unpaid-platform-fees')
      if (!unpaidRes.ok) return

      const { orders } = await unpaidRes.json()
      setUnpaidOrders(orders || [])
    } catch {
      // Ignore transient notification refresh failures.
    }
  }, [])

  useIdleEffect(() => {
    const fetchTaskerProfileAndStats = async () => {
      try {
        const { data } = await authClient.getSession()

        if (!data?.user) {
          toast.error('No user session found')
          return
        }

        const taskerId =
          data.user.taskerId === null || data.user.taskerId === undefined
            ? undefined
            : String(data.user.taskerId)

        setUser({
          ...data.user,
          taskerId,
        })

        if (!taskerId) return

        const taskerRes = await fetchWithSocketPause(`/api/taskers?taskerId=${taskerId}&basic=true`)
        if (!taskerRes.ok) {
          toast.error('Failed to load tasker profile')
          return
        }

        const { tasker } = await taskerRes.json()
        setTaskerProfile(tasker)

        await Promise.all([fetchTaskerStats(taskerId), fetchUnpaidOrders()])
      } catch {
        toast.error('Failed to load tasker dashboard details')
      }
    }

    void fetchTaskerProfileAndStats()
  }, [fetchTaskerStats, fetchUnpaidOrders])

  useEffect(() => {
    if (!user?.taskerId) return

    const socket = acquireSharedSocket()
    const handleTaskUpdate = () => {
      void fetchUnpaidOrders()
      void fetchTaskerStats(user.taskerId as string)
    }

    socket.on('tasks:updated', handleTaskUpdate)

    return () => {
      socket.off('tasks:updated', handleTaskUpdate)
      releaseSharedSocket(socket)
    }
  }, [fetchTaskerStats, fetchUnpaidOrders, user?.taskerId])

  const hasDismissedNotification =
    !!dismissedNotificationId &&
    unpaidOrders.some((order) => order._id === dismissedNotificationId)

  const activeNotification =
    unpaidOrders.find(
      (order) => !hasDismissedNotification || order._id !== dismissedNotificationId
    ) || null

  useEffect(() => {
    toast.dismiss(TASKER_NOTIFICATION_TOAST_ID)

    if (!activeNotification) return

    toast.custom(
      () => (
        <div className="w-[min(92vw,24rem)] rounded-[1.75rem] border border-amber-200 bg-white p-4 shadow-2xl shadow-amber-100 dark:border-amber-900 dark:bg-slate-950 dark:shadow-none">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                    Notification
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    Settlement reminder
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDismissedNotificationId(activeNotification._id)
                    toast.dismiss(TASKER_NOTIFICATION_TOAST_ID)
                  }}
                  className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Pay{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  NGN {activeNotification.platformFee.toLocaleString('en-NG')}
                </span>{' '}
                to SwiftDU for{' '}
                <span className="font-medium text-slate-900 dark:text-white">
                  {activeNotification.description}
                </span>
                .{' '}
                {activeNotification.settlementStatus === 'overdue'
                  ? 'This settlement is overdue.'
                  : `Due ${formatDueDate(activeNotification.settlementDueAt)}.`}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/tasker-dashboard/payment/${activeNotification._id}`}
                  onClick={() => toast.dismiss(TASKER_NOTIFICATION_TOAST_ID)}
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-600"
                >
                  Pay now
                </Link>
                <Link
                  href="/tasker-dashboard/notifications"
                  onClick={() => toast.dismiss(TASKER_NOTIFICATION_TOAST_ID)}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  View all
                </Link>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        id: TASKER_NOTIFICATION_TOAST_ID,
        duration: Infinity,
      }
    )

    return () => {
      toast.dismiss(TASKER_NOTIFICATION_TOAST_ID)
    }
  }, [activeNotification])

  useEffect(() => {
    if (!isMobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    const updateMobileTitleVisibility = () => {
      setIsMobileTitleTransparent(window.scrollY > 12)
    }

    updateMobileTitleVisibility()
    window.addEventListener('scroll', updateMobileTitleVisibility, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateMobileTitleVisibility)
    }
  }, [])

  const handleLogout = async () => {
    await authClient.signOut()
    toast.dismiss(TASKER_NOTIFICATION_TOAST_ID)
    router.push('/auth')
  }

  const notificationCount = unpaidOrders.length
  const userName = user?.name || 'Tasker'
  const userEmailName = user?.email?.split('@')[0] || ''
  const isNavigationActive = (href: string) =>
    href === '/tasker-dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  const handleNavigation = (href: string) => {
    router.push(href)
    setIsMobileMenuOpen(false)
  }

  const NavButton = ({
    item,
    mobile = false,
  }: {
    item: (typeof navigation)[number] | (typeof secondaryNavigation)[number]
    mobile?: boolean
  }) => {
    const Icon = item.icon
    const isActive = isNavigationActive(item.href)
    const isNotifications = item.href === '/tasker-dashboard/notifications'

    return (
      <button
        type="button"
        onClick={() => handleNavigation(item.href)}
        className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-300 ${
          isActive
            ? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <span className="relative">
          <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
          {isNotifications && notificationCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.name}</p>
          {!mobile ? (
            <p className={`truncate text-xs ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
              {item.description}
            </p>
          ) : null}
        </div>
        {isNotifications && notificationCount > 0 ? (
          <span
            className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
              isActive ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        ) : null}
        {isActive && !isNotifications ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </button>
    )
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-20 bg-transparent lg:hidden">
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((previous) => !previous)}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 shadow-lg shadow-slate-900/10 outline-none transition-all duration-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5 transition-transform duration-300" />
            ) : (
              <span className="flex w-6 flex-col items-center gap-1.5" aria-hidden="true">
                <span className="h-0.5 w-4 rounded-full bg-current" />
                <span className="h-0.5 w-6 rounded-full bg-current" />
                <span className="h-0.5 w-3.5 rounded-full bg-current" />
              </span>
            )}
          </button>
        </div>
        <p
          className={`absolute left-20 right-20 top-1/2 -translate-y-1/2 truncate text-center text-base text-slate-950 transition-opacity duration-200 dark:text-white ${
            isMobileTitleTransparent ? 'opacity-0' : 'opacity-100'
          }`}
        >
          Tasker Dashboard
        </p>
      </div>

      {isMobileMenuOpen ? (
        <div
          className="fixed inset-0 z-70 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 top-0 flex w-72 max-w-[85vw] animate-in flex-col overflow-y-auto bg-white shadow-2xl slide-in-from-left duration-300 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mt-5 p-5">
              <div className="min-w-0">
                <p className="truncate text-3xl font-bold text-slate-900 dark:text-white">{userName}</p>
                {userEmailName ? (
                  <p className="truncate text-slate-500 dark:text-slate-400">@{userEmailName}</p>
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {taskerStats.rating.toFixed(1)}
                </span>
                <span>{taskerStats.completedTasks} tasks</span>
                <span
                  className={`ml-auto rounded-full px-2 py-1 font-semibold ${
                    taskerProfile?.isSettlementSuspended
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  {taskerProfile?.isSettlementSuspended ? 'Settlement hold' : 'Online'}
                </span>
              </div>
            </div>

            <nav className="flex-1 space-y-2 p-4 pb-6">
              {[...navigation, ...secondaryNavigation].map((item) => (
                <NavButton key={item.name} item={item} mobile />
              ))}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleNavigation('/dashboard')}
                  className="w-full rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 px-4 py-3 text-left text-white shadow-lg shadow-emerald-500/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white/20 p-2">
                      <ArrowLeft className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">User Dashboard</p>
                      <p className="text-xs text-emerald-50">Switch to your user account</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      ) : null}

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 lg:flex">
        <div className="border-b border-slate-200 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              <Menu className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-white">{userName}</h1>
              <p className="truncate text-xs text-slate-500">Tasker Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          {navigation.map((item) => (
            <NavButton key={item.name} item={item} />
          ))}
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            {secondaryNavigation.map((item) => (
              <NavButton key={item.name} item={item} />
            ))}
          </div>
        </nav>

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => handleNavigation('/dashboard')}
            className="w-full rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 p-4 text-left text-white shadow-lg shadow-emerald-500/20 transition-transform duration-300 hover:scale-[1.01]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-white/20 p-2">
                <ArrowLeft className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">User Dashboard</p>
                <p className="mt-1 text-xs text-emerald-50">
                  Switch back to booking tasks.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>
      <div className="hidden w-72 shrink-0 lg:block" aria-hidden="true" />
    </>
  )
}
