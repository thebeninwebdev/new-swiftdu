'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  ListTodo, 
  MessageSquare, 
  Star, 
  Settings, 
  LogOut, 
  Menu,
  X,
  ChevronRight,
  Bell,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { toast } from 'sonner'

interface UnpaidOrder {
  _id: string;
  platformFee: number;
  description: string;
}

interface UserType {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  rating?: number;
  completedTasks?: number;
  taskerId?: string;
}

interface TaskerProfileType {
  profileImage?: string;
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/tasker-dashboard',
    icon: LayoutDashboard,
    badge: null
  },
  {
    name: 'Available Errands',
    href: '/tasker-dashboard?accepted=true',
    icon: ListTodo,
    badge: null
  },
  {
    name: 'History',
    href: '/tasker-dashboard/history',
    icon: ListTodo,
    badge: null
  },
  {
    name: 'Support',
    href: '/tasker-dashboard/support',
    icon: MessageSquare,
    badge: null
  },
  {
    name: 'Reviews',
    href: '/tasker-dashboard/reviews',
    icon: Star,
    badge: null
  }
]

const secondaryNavigation = [
  {
    name: 'Profile Settings',
    href: '/tasker-dashboard/profile',
    icon: Settings
  },
  {
    name: 'Notifications',
    href: '/tasker-dashboard/notifications',
    icon: Bell
  }
]

export default function TaskerSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [user, setUser] = useState<UserType | undefined>()
  const [taskerProfile, setTaskerProfile] = useState<TaskerProfileType | undefined>()
  const [taskerStats, setTaskerStats] = useState<{ completedTasks: number; rating: number }>({ completedTasks: 0, rating: 0 })

  const [unpaidOrders, setUnpaidOrders] = useState<UnpaidOrder[]>([]);

  useEffect(() => {
    const fetchTaskerProfileAndStats = async () => {
      const { data } = await authClient.getSession()
      if (data?.user) {
        setUser({
          ...data.user,
          taskerId: data.user.taskerId === null ? undefined : data.user.taskerId,
        })
        const taskerRes = await fetch(`/api/taskers?taskerId=${data.user.taskerId}`)
        if (!taskerRes.ok) {
          toast.error('Failed to load tasker profile')
          return
        }
        const { tasker } = await taskerRes.json()
        setTaskerProfile(tasker)
        // Fetch stats
        const statsRes = await fetch(`/api/taskers/stats?taskerId=${data.user.taskerId}`)
        if (statsRes.ok) {
          const stats = await statsRes.json()
          setTaskerStats(stats)
        }
        // Fetch unpaid platform fees
        const unpaidRes = await fetch('/api/taskers/unpaid-platform-fees');
        if (unpaidRes.ok) {
          const { orders } = await unpaidRes.json();
          setUnpaidOrders(orders || []);
        }
      } else {
        toast.error('No user session found')
      }
    }
    fetchTaskerProfileAndStats()
  }, [])

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/login')
  }

  const NavItem = ({ item, isActive }: { item: typeof navigation[0], isActive: boolean }) => {
    const Icon = item.icon
    // Tooltip only when not collapsed
    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }
                  justify-center
                `}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.name}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }
    // Not collapsed: no tooltip, show label
    return (
      <Link
        href={item.href}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`
          group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
          ${isActive 
            ? 'bg-primary text-primary-foreground shadow-sm' 
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }
        `}
      >
        <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
        <span className="flex-1">{item.name}</span>
        {item.badge && (
          <span className={`
            inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full
            ${isActive 
              ? 'bg-primary-foreground/20 text-primary-foreground' 
              : 'bg-primary/10 text-primary'
            }
          `}>
            {item.badge}
          </span>
        )}
        {isActive && <ChevronRight className="h-4 w-4 opacity-50" />}
      </Link>
    )
  }

  return (
    <>
      {/* Platform Fee Notification Panel */}
      {unpaidOrders.length > 0 && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-yellow-50 dark:bg-yellow-900/80 border border-yellow-300 dark:border-yellow-700 rounded-xl shadow-lg p-4 animate-in fade-in slide-in-from-top-8">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="h-5 w-5 text-yellow-500 animate-bounce" />
            <span className="font-semibold text-yellow-800 dark:text-yellow-200">Action Required</span>
          </div>
          <ul className="space-y-2">
            {unpaidOrders.map(order => (
              <li key={order._id} className="text-sm text-yellow-900 dark:text-yellow-100 flex flex-col gap-1">
                <span>
                  Platform fee of <span className="font-bold">₦{order.platformFee}</span> for <span className="font-medium">{order.description}</span> must be paid within 24hrs or your account will be suspended.
                </span>
                <Link href={`/tasker-dashboard/payment/${order._id}`} className="text-indigo-600 hover:underline font-semibold">Pay Now</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-bold text-lg">ErrandHub</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-accent relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          </button>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 z-50 h-screen bg-card border-r border-border transition-all duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-20' : 'lg:w-72 w-72'}
      `}>
        {/* Logo Section */}
        <div className={`
          h-16 flex items-center border-b border-border px-4
          ${isCollapsed ? 'lg:justify-center' : 'justify-between'}
        `}>
          <Link href="/tasker-dashboard" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-linear-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <ListTodo className="h-5 w-5 text-primary-foreground" />
            </div>
            {!isCollapsed && <span className="font-bold text-xl tracking-tight">ErrandHub</span>}
          </Link>
          
          {/* Desktop Collapse Toggle */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <Menu className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <div className="p-4 space-y-6">
            
            {/* User Profile Card */}
            {!isCollapsed && (
              <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-primary/5 to-primary/10 border border-primary/10 p-4">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 h-16 w-16 rounded-full bg-primary/10 blur-2xl" />
                <div className="relative flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                    {taskerProfile?.profileImage ? (
                      <img src={taskerProfile.profileImage} alt={user?.name || ''} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{user?.name || 'Tasker'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {taskerStats.rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{taskerStats.completedTasks} tasks</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Online
                  </span>
                </div>
              </div>
            )}

            {/* Collapsed Profile Icon */}
            {isCollapsed && (
              <div className="flex justify-center">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                  <User className="h-5 w-5 text-primary" />
                </div>
              </div>
            )}

            {/* Main Navigation */}
            <div className="space-y-1">
              {!isCollapsed && (
                <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Menu
                </h3>
              )}
              {navigation.map((item) => (
                <NavItem 
                  key={item.name} 
                  item={item} 
                  isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)} 
                />
              ))}
            </div>

            {/* Secondary Navigation */}
            <div className="space-y-1 pt-4 border-t border-border">
              {!isCollapsed && (
                <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Settings
                </h3>
              )}
              {secondaryNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                      ${isActive 
                        ? 'bg-accent text-foreground' 
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`
              w-full justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10
              ${isCollapsed ? 'px-2' : 'gap-3'}
            `}
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content Spacer for Desktop */}
      <div className={`hidden lg:block transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-72'}`} />
      
      {/* Mobile Content Spacer */}
      <div className="lg:hidden h-14" />
    </>
  )
}