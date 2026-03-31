'use client'

import {useState, useEffect} from 'react'
import {useRouter, usePathname} from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import {LogOut, Menu, X, PlusCircle, ListTodo, User, Bell} from 'lucide-react'


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
    description: 'User notifications',
    notification: true,
  },
  {
    label: 'Account',
    href: '/dashboard/account',
    icon: User,
    description: 'Profile settings'
  }
]

export default function DashboardMenu() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasNotification, setHasNotification] = useState(false)

  const router = useRouter()
  const pathname = usePathname()

  // Notification check: unpaid, accepted orders
  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch('/api/orders')
        if (!res.ok) throw new Error('Failed to fetch orders')
        const orders = await res.json()
        const hasUnpaidAccepted = orders.some(
          (order: any) => order.hasPaid === false && !!order.taskerId
        )
        setHasNotification(hasUnpaidAccepted)
      } catch {
        setHasNotification(false)
      }
    }
    fetchOrders()
  }, [])

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
      <aside className="hidden lg:flex sticky top-0 h-screen w-72 shrink-0 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 flex-col">
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
                className="absolute right-0 top-16 bottom-0 w-64 bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-right duration-300"
                onClick={e => e.stopPropagation()}
              >
                <nav className="p-4 space-y-2">
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
