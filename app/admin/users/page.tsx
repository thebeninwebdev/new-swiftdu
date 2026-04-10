'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Users,
  Search,
  Mail,
  Phone,
  UserCheck,
  UserX,
  Eye,
  AlertCircle,
  Shield,
  Calendar,
  MapPin,
  Package,
  ChevronUp,
  Filter,
  RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface User {
  _id: string
  name: string
  email: string
  phone?: string
  location?: string
  emailVerified: boolean
  role: string
  createdAt: string
  lastLogin?: string
  orderCount?: number
  isSuspended?: boolean
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
}

const expandVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: {
      duration: 0.3,
      ease: [0.04, 0.62, 0.23, 0.98] as const
    }
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.2
    }
  }
}

const statsCardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 20
    }
  }
}

export default function AdminUsersPage() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [admin, setAdmin] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [suspendConfirm, setSuspendConfirm] = useState<{ show: boolean; userId?: string; willSuspend?: boolean }>({ show: false })

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await authClient.getSession()
        if (error || !data?.user) {
          router.push('/login')
          return
        }
        // TODO: Add admin role check
        setAdmin(data.user)
      } catch {
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setIsFetching(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        role: roleFilter,
        status: statusFilter
      })

      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to load users')
        return
      }

      setUsers(data.users)
      setTotalPages(data.totalPages)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setIsFetching(false)
    }
  }, [currentPage, searchTerm, roleFilter, statusFilter])

  useEffect(() => {
    if (admin) fetchUsers()
  }, [admin, fetchUsers])

  // Handle user actions
  const handleUserAction = async (userId: string, action: 'verify' | 'suspend' | 'activate') => {
    const targetUser = users.find((user) => user._id === userId)

    if (targetUser?.role?.toLowerCase() === 'admin') {
      toast.error('Admin accounts cannot be modified')
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Action failed')
        return
      }

      toast.success(
        action === 'verify' ? 'User verified ✓' :
        action === 'suspend' ? 'User suspended' :
        'User activated'
      )

      // Refresh users list
      fetchUsers()
    } catch {
      toast.error('Something went wrong')
    }
  }

  const handleSuspendClick = (userId: string, isSuspended: boolean) => {
    const targetUser = users.find((user) => user._id === userId)

    if (targetUser?.role?.toLowerCase() === 'admin') {
      toast.error('Admin accounts cannot be suspended')
      return
    }

    setSuspendConfirm({
      show: true,
      userId,
      willSuspend: !isSuspended
    })
  }

  const confirmSuspendAction = async () => {
    if (!suspendConfirm.userId) return

    const action = suspendConfirm.willSuspend ? 'suspend' : 'activate'
    await handleUserAction(suspendConfirm.userId, action)
    setSuspendConfirm({ show: false })
  }

  // Calculate stats
  const verifiedCount = users.filter(u => u.emailVerified).length
  const totalOrders = users.reduce((acc, u) => acc + (u.orderCount || 0), 0)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="h-16 w-16 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-muted-foreground font-medium">Loading admin panel...</p>
        </motion.div>
      </div>
    )
  }

  if (!admin) return null

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
      {/* Animated Header */}
      <motion.div 
        className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-16 lg:top-0 z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <motion.h1 
                className="text-3xl sm:text-4xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                User Management
              </motion.h1>
              <motion.p 
                className="text-muted-foreground mt-2 text-sm sm:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Manage platform users and their accounts
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Badge variant="secondary" className="px-4 py-1.5 text-sm font-medium shadow-sm">
                <Shield className="w-3.5 h-3.5 mr-2" />
                Admin Panel
              </Badge>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats Overview */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={statsCardVariants}>
            <Card className="bg-linear-to-br from-card to-card/50 border-border/50 hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold mt-1">{users.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div variants={statsCardVariants}>
            <Card className="bg-linear-to-br from-card to-card/50 border-border/50 hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">{verifiedCount}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div variants={statsCardVariants}>
            <Card className="bg-linear-to-br from-card to-card/50 border-border/50 hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold mt-1">{totalOrders}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="mb-6 border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative group">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value ?? 'all')}>
                  <SelectTrigger className="transition-all duration-300 hover:border-primary/50">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="user">Users</SelectItem>
                    <SelectItem value="tasker">Taskers</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value || 'all')}>
                  <SelectTrigger className="transition-all duration-300 hover:border-primary/50">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  onClick={() => setCurrentPage(1)} 
                  disabled={isFetching}
                  className="transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <motion.div
                    animate={isFetching ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 1, repeat: isFetching ? Infinity : 0, ease: "linear" }}
                    className="mr-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </motion.div>
                  {isFetching ? 'Loading...' : 'Apply Filters'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Users List */}
        <motion.div 
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="wait">
            {users.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-border/50">
                  <CardContent className="py-16 text-center">
                    <motion.div
                      initial={{ y: 0 }}
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                    </motion.div>
                    <p className="text-muted-foreground text-lg">No users found</p>
                    <p className="text-sm text-muted-foreground/60 mt-2">Try adjusting your filters</p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              users.map((user) => {
                const isAdminUser = user.role?.toLowerCase() === 'admin'

                return (
                  <motion.div
                    key={user._id}
                    variants={itemVariants}
                    layout
                    whileHover={{ scale: 1.005 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <Card className={`overflow-hidden border-border/50 transition-all duration-300 hover:shadow-lg ${user.isSuspended ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                      <CardContent className="p-4 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex items-start md:items-center space-x-3 md:space-x-4">
                            <motion.div 
                              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0 ${user.isSuspended ? 'bg-red-100 dark:bg-red-900/30' : 'bg-linear-to-br from-primary/20 to-primary/10'}`}
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              <Users className={`w-6 h-6 md:w-7 md:h-7 ${user.isSuspended ? 'text-red-600 dark:text-red-400' : 'text-primary'}`} />
                            </motion.div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-base md:text-lg truncate">{user.name}</h3>
                                {user.isSuspended && (
                                  <Badge variant="destructive" className="text-xs">
                                    Suspended
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs md:text-sm text-muted-foreground gap-1 sm:gap-0 mt-1">
                                <div className="flex items-center hover:text-foreground transition-colors">
                                  <Mail className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                  <span className="truncate">{user.email}</span>
                                </div>
                                {user.phone && (
                                  <div className="flex items-center hover:text-foreground transition-colors">
                                    <Phone className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                    {user.phone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-3 sm:gap-0">
                            <div className="text-left sm:text-right">
                              <div className="flex items-center sm:justify-end gap-2 mb-1">
                                <Badge 
                                  variant={user.emailVerified ? 'default' : 'secondary'}
                                  className={`transition-all duration-300 ${user.emailVerified ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                                >
                                  {user.emailVerified ? 'Verified' : 'Unverified'}
                                </Badge>
                                <Badge variant="outline" className="font-normal">
                                  {user.role}
                                </Badge>
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {user.orderCount || 0} orders
                              </p>
                            </div>

                            <div className="flex space-x-2">
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setExpandedId(expandedId === user._id ? null : user._id)}
                                  className="transition-all duration-300 hover:bg-muted"
                                >
                                  <motion.div
                                    animate={{ rotate: expandedId === user._id ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    {expandedId === user._id ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </motion.div>
                                </Button>
                              </motion.div>

                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                  variant={user.isSuspended ? 'outline' : 'destructive'}
                                  size="sm"
                                  onClick={() => handleSuspendClick(user._id, user.isSuspended || false)}
                                  disabled={isAdminUser}
                                  title={isAdminUser ? 'Admin accounts cannot be suspended' : user.isSuspended ? 'Unsuspend user' : 'Suspend user'}
                                  className={`transition-all duration-300 ${isAdminUser ? 'cursor-not-allowed opacity-50' : user.isSuspended ? 'hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200' : 'hover:bg-destructive/90'}`}
                                >
                                  <UserX className="w-4 h-4" />
                                </Button>
                              </motion.div>

                              {!user.emailVerified && !isAdminUser && (
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUserAction(user._id, 'verify')}
                                    className="transition-all duration-300 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                                  >
                                    <UserCheck className="w-4 h-4" />
                                  </Button>
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {expandedId === user._id && (
                            <motion.div
                              variants={expandVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              className="overflow-hidden"
                            >
                              <div className="mt-6 pt-6 border-t border-border/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                <motion.div 
                                  className="space-y-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.1 }}
                                >
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</p>
                                  <p className="text-sm font-medium">{user.name}</p>
                                </motion.div>

                                <motion.div 
                                  className="space-y-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.15 }}
                                >
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                                  <p className="text-sm font-medium truncate">{user.email}</p>
                                </motion.div>

                                {user.phone && (
                                  <motion.div 
                                    className="space-y-1"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                  >
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</p>
                                    <p className="text-sm font-medium">{user.phone}</p>
                                  </motion.div>
                                )}

                                {user.location && (
                                  <motion.div 
                                    className="space-y-1"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.25 }}
                                  >
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      Location
                                    </p>
                                    <p className="text-sm font-medium">{user.location}</p>
                                  </motion.div>
                                )}

                                <motion.div 
                                  className="space-y-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.3 }}
                                >
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</p>
                                  <Badge variant="outline" className="font-medium">{user.role}</Badge>
                                </motion.div>

                                <motion.div 
                                  className="space-y-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.35 }}
                                >
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                                  <div className="flex gap-2">
                                    <Badge variant={user.emailVerified ? 'default' : 'secondary'} className={user.emailVerified ? 'bg-emerald-500' : ''}>
                                      {user.emailVerified ? 'Verified' : 'Unverified'}
                                    </Badge>
                                    {user.isSuspended && (
                                      <Badge variant="destructive">Suspended</Badge>
                                    )}
                                  </div>
                                </motion.div>

                                <motion.div 
                                  className="space-y-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.4 }}
                                >
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Joined
                                  </p>
                                  <p className="text-sm font-medium">
                                    {new Date(user.createdAt).toLocaleDateString(undefined, { 
                                      year: 'numeric', 
                                      month: 'long', 
                                      day: 'numeric' 
                                    })}
                                  </p>
                                </motion.div>

                                {user.lastLogin && (
                                  <motion.div 
                                    className="space-y-1"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.45 }}
                                  >
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Login</p>
                                    <p className="text-sm font-medium">
                                      {new Date(user.lastLogin).toLocaleString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  </motion.div>
                                )}

                                <motion.div 
                                  className="space-y-1"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.5 }}
                                >
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    <Package className="w-3 h-3" />
                                    Total Orders
                                  </p>
                                  <p className="text-sm font-medium">{user.orderCount || 0}</p>
                                </motion.div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pagination */}
        <AnimatePresence>
          {totalPages > 1 && (
            <motion.div 
              className="flex justify-center mt-8 space-x-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="transition-all duration-300"
                >
                  Previous
                </Button>
              </motion.div>

              <span className="px-4 py-2 text-sm text-muted-foreground font-medium bg-muted/50 rounded-md">
                Page {currentPage} of {totalPages}
              </span>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="transition-all duration-300"
                >
                  Next
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Suspend Confirmation Dialog */}
      <AlertDialog open={suspendConfirm.show} onOpenChange={(open) => setSuspendConfirm({ show: open })}>
        <AlertDialogContent className="border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <AlertCircle className={`w-6 h-6 ${suspendConfirm.willSuspend ? 'text-destructive' : 'text-emerald-500'}`} />
              </motion.div>
              {suspendConfirm.willSuspend ? 'Suspend User' : 'Unsuspend User'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {suspendConfirm.willSuspend
                ? 'Are you sure you want to suspend this user? They will not be able to access their account until reactivated.'
                : 'Are you sure you want to unsuspend this user? They will immediately regain access to their account.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel className="transition-all duration-300 hover:bg-muted">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSuspendAction}
              className={`transition-all duration-300 ${suspendConfirm.willSuspend ? 'bg-destructive hover:bg-destructive/90' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              {suspendConfirm.willSuspend ? 'Suspend' : 'Unsuspend'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
