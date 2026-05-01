'use client'

import {useState, useEffect} from 'react'
import {useRouter, usePathname} from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import {LogOut, Menu, X, PlusCircle, ListTodo, User, Bell, UserPlus, Star, BriefcaseBusiness} from 'lucide-react'


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

export default function DashboardMenu() {
  const { data: session } = authClient.useSession()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasNotification, setHasNotification] = useState(false)
  const [excoDashboard, setExcoDashboard] = useState<ExcoDashboardAccess | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const sessionUserId = session?.user?.id
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
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/30">
              E
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white text-lg">ErrandHub</h1>
              <p className="text-xs text-slate-500">Campus Delivery</p>
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
          <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 z-50 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                E
              </div>
              <span className="font-bold text-slate-900 dark:text-white">ErrandHub</span>
            </div>
            
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </header>
    
          {/* Mobile Menu Overlay */}
          {isMobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
              <div 
                className="absolute bottom-0 right-0 top-16 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300 dark:bg-slate-900"
                onClick={e => e.stopPropagation()}
              >
                <nav className="flex-1 space-y-2 overflow-y-auto p-4 pb-6">
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
