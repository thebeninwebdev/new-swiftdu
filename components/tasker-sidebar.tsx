'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Star,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'
import { acquireSharedSocket, releaseSharedSocket } from '@/lib/client-socket'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
    badge: null,
  },
  {
    name: 'Available Errands',
    href: '/tasker-dashboard?accepted=true',
    icon: ListTodo,
    badge: null,
  },
  {
    name: 'History',
    href: '/tasker-dashboard/history',
    icon: ListTodo,
    badge: null,
  },
  {
    name: 'Support',
    href: '/tasker-dashboard/support',
    icon: MessageSquare,
    badge: null,
  },
]

const secondaryNavigation = [
  {
    name: 'Profile Settings',
    href: '/tasker-dashboard/profile',
    icon: Settings,
  },
  {
    name: 'Notifications',
    href: '/tasker-dashboard/notifications',
    icon: Bell,
  },
]

export default function TaskerSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [user, setUser] = useState<UserType | undefined>()
  const [taskerProfile, setTaskerProfile] = useState<TaskerProfileType | undefined>()
  const [taskerStats, setTaskerStats] = useState({ completedTasks: 0, rating: 0 })
  const [unpaidOrders, setUnpaidOrders] = useState<UnpaidOrder[]>([])
  const [dismissedNotificationId, setDismissedNotificationId] = useState<string | null>(null)

  const fetchTaskerStats = useCallback(async (taskerId: string) => {
    try {
      const statsRes = await fetch(`/api/taskers/stats?taskerId=${taskerId}`)
      if (!statsRes.ok) {
        return
      }

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
      const unpaidRes = await fetch('/api/taskers/unpaid-platform-fees')
      if (!unpaidRes.ok) {
        return
      }

      const { orders } = await unpaidRes.json()
      setUnpaidOrders(orders || [])
    } catch {
      // Ignore transient notification refresh failures.
    }
  }, [])

  useEffect(() => {
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

        if (!taskerId) {
          return
        }

        const taskerRes = await fetch(`/api/taskers?taskerId=${taskerId}`)
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
    if (!user?.taskerId) {
      return
    }

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

    if (!activeNotification) {
      return
    }

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

  const handleLogout = async () => {
    await authClient.signOut()
    toast.dismiss(TASKER_NOTIFICATION_TOAST_ID)
    router.push('/login')
  }

  const notificationCount = unpaidOrders.length

  const NavItem = ({
    item,
    isActive,
  }: {
    item: (typeof navigation)[number]
    isActive: boolean
  }) => {
    const Icon = item.icon

    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`group flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    isActive
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.name}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <Link
        href={item.href}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        <Icon
          className={`h-5 w-5 shrink-0 ${
            isActive
              ? 'text-primary-foreground'
              : 'text-muted-foreground group-hover:text-foreground'
          }`}
        />
        <span className="flex-1">{item.name}</span>
        {item.badge ? (
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isActive
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {item.badge}
          </span>
        ) : null}
        {isActive ? <ChevronRight className="h-4 w-4 opacity-50" /> : null}
      </Link>
    )
  }

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((previous) => !previous)}
            className="rounded-xl p-2 transition-colors hover:bg-accent"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-base font-bold tracking-tight">ErrandHub</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/tasker-dashboard/notifications"
            className="relative rounded-xl p-2 transition-colors hover:bg-accent"
            aria-label="Open notifications"
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            ) : null}
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen border-r border-border bg-card transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'w-72 lg:w-72'}`}
      >
        <div
          className={`flex h-16 items-center border-b border-border px-4 ${
            isCollapsed ? 'lg:justify-center' : 'justify-between'
          }`}
        >
          <Link href="/tasker-dashboard" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
              <ListTodo className="h-5 w-5 text-primary-foreground" />
            </div>
            {!isCollapsed ? (
              <span className="text-xl font-bold tracking-tight">ErrandHub</span>
            ) : null}
          </Link>

          <button
            type="button"
            onClick={() => setIsCollapsed((previous) => !previous)}
            className="hidden rounded-md p-1.5 transition-colors hover:bg-accent lg:flex"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu
              className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                isCollapsed ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        <div className="h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="space-y-6 p-4 pb-24">
            {!isCollapsed ? (
              <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-linear-to-br from-primary/5 to-primary/10 p-4">
                <div className="absolute right-0 top-0 -mr-2 -mt-2 h-16 w-16 rounded-full bg-primary/10 blur-2xl" />
                <div className="relative flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20 bg-background">
                    {taskerProfile?.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={taskerProfile.profileImage}
                        alt={user?.name || 'Tasker'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {user?.name || 'Tasker'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {taskerStats.rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {taskerStats.completedTasks} tasks
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${
                      taskerProfile?.isSettlementSuspended
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-green-500/10 text-green-600'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        taskerProfile?.isSettlementSuspended ? 'bg-amber-500' : 'bg-green-500'
                      }`}
                    />
                    {taskerProfile?.isSettlementSuspended ? 'Settlement hold' : 'Online'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              {!isCollapsed ? (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Menu
                </h3>
              ) : null}

              {navigation.map((item) => (
                <NavItem
                  key={item.name}
                  item={item}
                  isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                />
              ))}
            </div>

            <div className="space-y-1 border-t border-border pt-4">
              {!isCollapsed ? (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Settings
                </h3>
              ) : null}

              {secondaryNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                const isNotifications = item.name === 'Notifications'

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                  >
                    <div className="relative">
                      <Icon className="h-5 w-5 shrink-0" />
                      {isNotifications && notificationCount > 0 ? (
                        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                          {notificationCount > 9 ? '9+' : notificationCount}
                        </span>
                      ) : null}
                    </div>

                    {!isCollapsed ? <span>{item.name}</span> : null}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card p-4">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`w-full justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive ${
              isCollapsed ? 'px-2' : 'gap-3'
            }`}
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed ? <span>Sign Out</span> : null}
          </Button>
        </div>
      </aside>

      <div
        className={`hidden transition-all duration-300 lg:block ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      />
      <div className="h-16 lg:hidden" />
    </>
  )
}
