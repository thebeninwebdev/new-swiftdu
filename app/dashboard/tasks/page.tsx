'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ShoppingBag, 
  Clock, 
  MapPin, 
  Store, 
  User, 
  ChevronRight, 
  RefreshCw, 
  Package,
  Utensils,
  Printer,
  MoreHorizontal,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Landmark,
  Copy,
  Search,
  Radio,
  CreditCard,
  Bell,
  ArrowRight,
  Wallet,
  Sparkles,
  Check
} from 'lucide-react'
import { toast } from 'sonner'

interface Order {
  _id: string
  taskType: string
  description: string
  amount: number
  commission?: number
  platformFee?: number
  taskerFee?: number
  totalAmount?: number
  deadlineValue: number
  deadlineUnit: 'mins' | 'hours' | 'days'
  location: string
  store?: string
  packaging?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  taskerName?: string
  taskerId?: string
  createdAt: string
  updatedAt: string
  hasPaid?: boolean
  acceptedAt?: string
}

interface TaskerDetails {
  _id: string
  bankDetails: {
    bankName: string
    accountNumber: string
    accountName: string
  }
}

const statusConfig = {
  pending: {
    color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    icon: Search,
    label: 'Searching for Tasker',
    gradient: 'from-amber-400 to-orange-500',
    pulseColor: 'amber',
    description: 'We are finding the best tasker for your errand'
  },
  in_progress: {
    color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    icon: Loader2,
    label: 'Tasker Assigned',
    gradient: 'from-blue-400 to-indigo-500',
    pulseColor: 'blue',
    description: 'Tasker accepted - payment required to start'
  },
  completed: {
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    icon: CheckCircle2,
    label: 'Completed',
    gradient: 'from-emerald-400 to-green-500',
    pulseColor: 'emerald',
    description: 'Task completed successfully'
  },
  cancelled: {
    color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    icon: XCircle,
    label: 'Cancelled',
    gradient: 'from-red-400 to-rose-500',
    pulseColor: 'red',
    description: 'Task has been cancelled'
  }
}

const taskTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
  restaurant: { 
    icon: Utensils, 
    label: 'Restaurant', 
    color: 'from-orange-400 to-red-500' 
  },
  printing: { 
    icon: Printer, 
    label: 'Printing', 
    color: 'from-blue-400 to-indigo-500' 
  },
  shopping: { 
    icon: ShoppingBag, 
    label: 'Shopping', 
    color: 'from-green-400 to-emerald-500' 
  },
  others: { 
    icon: MoreHorizontal, 
    label: 'Others', 
    color: 'from-purple-400 to-pink-500' 
  }
}

const tabs = [
  { id: 'all', label: 'All Orders', count: null },
  { id: 'pending', label: 'Searching', count: null },
  { id: 'in_progress', label: 'Payment Needed', count: null },
  { id: 'completed', label: 'Completed', count: null }
]

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
}

const cardHoverVariants: Variants = {
  rest: { scale: 1, y: 0 },
  hover: { 
    scale: 1.02, 
    y: -4,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25
    }
  }
}

const tabVariants: Variants = {
  inactive: { scale: 1, opacity: 0.7 },
  active: { 
    scale: 1.05, 
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 30
    }
  }
}

// Animated searching dots component
function SearchingDots() {
  return (
    <span className="inline-flex ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 bg-current rounded-full mx-0.5"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [1, 0.5, 1]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut"
          }}
        />
      ))}
    </span>
  )
}

// Pulsing ring animation for pending status
function PendingPulseRing() {
  return (
    <div className="absolute -inset-1 rounded-2xl overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-amber-400 dark:border-amber-500"
        animate={{
          scale: [1, 1.02, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400/10 to-orange-500/10 dark:from-amber-500/10 dark:to-orange-600/10"
        animate={{
          opacity: [0, 0.5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  )
}

// Payment required pulse ring for in_progress
function PaymentPulseRing() {
  return (
    <div className="absolute -inset-1 rounded-2xl overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-indigo-500 dark:border-indigo-400"
        animate={{
          scale: [1, 1.02, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/10 dark:to-purple-600/10"
        animate={{
          opacity: [0, 0.3, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  )
}

// Paid success pulse ring
function PaidPulseRing() {
  return (
    <div className="absolute -inset-1 rounded-2xl overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-emerald-400 dark:border-emerald-500"
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.3, 0.8, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  )
}

// Animated searching indicator
function SearchingIndicator() {
  return (
    <motion.div 
      className="flex items-center gap-2 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      >
        <Search className="w-4 h-4" />
      </motion.div>
      <span className="text-sm font-medium flex items-center">
        Searching for available taskers
        <SearchingDots />
      </span>
    </motion.div>
  )
}

// Payment required banner component
function PaymentRequiredBanner({ onPay, amount }: { onPay: () => void; amount: number }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount)
  }

  return (
    <motion.div 
      className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 mb-4 shadow-lg"
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
    >
      {/* Animated background shimmer */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
        animate={{
          x: ['-200%', '200%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div 
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Bell className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-wide">
              Tasker Accepted!
            </h4>
            <p className="text-indigo-100 text-sm">
              Complete payment to start your task
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-white/80 text-xs mb-1">Amount Due</p>
          <p className="text-white font-bold text-lg">{formatCurrency(amount)}</p>
        </div>
      </div>

      <motion.div 
        className="mt-3 pt-3 border-t border-white/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Button 
          onClick={onPay}
          className="w-full bg-white hover:bg-indigo-50 text-indigo-600 font-semibold py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group"
        >
          <CreditCard className="w-4 h-4" />
          Make Payment Now
          <motion.div
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ArrowRight className="w-4 h-4" />
          </motion.div>
        </Button>
      </motion.div>
    </motion.div>
  )
}

// Paid success banner component
function PaidSuccessBanner({ taskerName }: { taskerName?: string }) {
  return (
    <motion.div 
      className="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-4 mb-4 shadow-lg"
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
    >
      {/* Animated background shimmer */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
        animate={{
          x: ['-200%', '200%'],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      <div className="relative flex items-center gap-3">
        <motion.div 
          className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
          >
            <Check className="w-6 h-6 text-white" />
          </motion.div>
        </motion.div>
        <div>
          <h4 className="text-white font-bold text-base flex items-center gap-2">
            Payment Confirmed!
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
            </motion.div>
          </h4>
          <p className="text-emerald-100 text-sm">
            {taskerName ? `${taskerName} has been notified and will begin your task shortly.` : 'Your tasker has been notified and will begin shortly.'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function OrderCard({ order, index, onViewDetails }: { order: Order; index: number; onViewDetails: (order: Order) => void }) {
  const status = statusConfig[order.status]
  const taskType = taskTypeConfig[order.taskType]
  const StatusIcon = status.icon
  const TaskIcon = taskType.icon
  const isPending = order.status === 'pending'
  const isInProgress = order.status === 'in_progress'
  const hasPaid = order.hasPaid === true

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount)
  }

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      whileHover={isPending || (isInProgress && hasPaid) ? undefined : "hover"}
      custom={index}
      className="relative group"
    >
      {/* Status-specific pulse effects */}
      {isPending && <PendingPulseRing />}
      {isInProgress && !hasPaid && <PaymentPulseRing />}
      {isInProgress && hasPaid && <PaidPulseRing />}
      
      <motion.div
        variants={cardHoverVariants}
        className={`relative bg-white dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border overflow-hidden shadow-lg ${
          isPending 
            ? 'border-amber-300 dark:border-amber-700 shadow-amber-200/50 dark:shadow-amber-900/30' 
            : isInProgress && !hasPaid
              ? 'border-indigo-300 dark:border-indigo-700 shadow-indigo-200/50 dark:shadow-indigo-900/30'
              : isInProgress && hasPaid
                ? 'border-emerald-300 dark:border-emerald-700 shadow-emerald-200/50 dark:shadow-emerald-900/30'
                : 'border-slate-200 dark:border-slate-800 shadow-slate-200/50 dark:shadow-slate-950/50'
        }`}
      >
        {/* Status Indicator Bar with animation */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${status.gradient} relative overflow-hidden`}>
          {(isPending || (isInProgress && !hasPaid)) && (
            <motion.div
              className="absolute inset-0 bg-white/30"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: isInProgress && !hasPaid ? 1 : 1.5,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          )}
          {isInProgress && hasPaid && (
            <motion.div
              className="absolute inset-0 bg-white/30"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          )}
        </div>
        
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              <motion.div 
                whileHover={!isPending && !(isInProgress && hasPaid) ? { rotate: 10, scale: 1.1 } : undefined}
                animate={isPending ? {
                  scale: [1, 1.05, 1],
                  rotate: [0, -5, 5, 0]
                } : isInProgress && !hasPaid ? {
                  scale: [1, 1.08, 1],
                } : isInProgress && hasPaid ? {
                  scale: [1, 1.02, 1],
                } : undefined}
                transition={isPending || isInProgress ? {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : undefined}
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${taskType.color} flex items-center justify-center text-white shadow-lg ${
                  isPending ? 'ring-2 ring-amber-400 dark:ring-amber-500 ring-offset-2 dark:ring-offset-slate-900' : 
                  isInProgress && !hasPaid ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900' :
                  isInProgress && hasPaid ? 'ring-2 ring-emerald-400 dark:ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' : ''
                }`}
              >
                <TaskIcon className="w-6 h-6" />
              </motion.div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {taskType.label}
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Calendar className="w-4 h-4" />
                  {formatDate(order.createdAt)}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.3 }}
              >
                <Badge className={`${status.color} font-semibold px-3 py-1 flex items-center gap-1`}>
                  <StatusIcon className={`w-3 h-3 ${isInProgress && !hasPaid ? 'animate-spin' : ''}`} />
                  {isInProgress && hasPaid ? 'Payment Confirmed' : status.label}
                  {isPending && <SearchingDots />}
                </Badge>
              </motion.div>
              <motion.p 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 + 0.4 }}
                className="text-xl font-bold text-slate-900 dark:text-white mt-2"
              >
                {formatCurrency(order.totalAmount || order.amount)}
              </motion.p>
            </div>
          </div>

          {/* Searching Indicator for Pending Orders */}
          {isPending && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4"
            >
              <SearchingIndicator />
            </motion.div>
          )}

          {/* Payment Required Banner for In Progress Orders (not paid) */}
          {isInProgress && !hasPaid && (
            <PaymentRequiredBanner 
              onPay={() => onViewDetails(order)}
              amount={order.totalAmount || order.amount}
            />
          )}

          {/* Paid Success Banner for In Progress Orders (paid) */}
          {isInProgress && hasPaid && (
            <PaidSuccessBanner taskerName={order.taskerName} />
          )}

          {/* Description */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 + 0.5 }}
            className="text-slate-600 dark:text-slate-300 mb-4 line-clamp-2"
          >
            {order.description}
          </motion.p>

          {/* Tasker Info for In Progress */}
          {isInProgress && order.taskerName && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`flex items-center gap-2 mb-4 p-3 rounded-lg border ${
                hasPaid 
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' 
                  : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold ${
                hasPaid ? 'from-emerald-400 to-green-500' : 'from-blue-400 to-indigo-500'
              }`}>
                {order.taskerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{order.taskerName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {hasPaid ? 'Task in progress' : 'Your assigned tasker'}
                </p>
              </div>
              <div className="ml-auto">
                <span className={`flex items-center gap-1 text-xs ${
                  hasPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${hasPaid ? 'bg-emerald-500' : 'bg-green-500'}`} />
                  {hasPaid ? 'Working' : 'Online'}
                </span>
              </div>
            </motion.div>
          )}

          {/* Details Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm"
          >
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span className="truncate">{order.location}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>{order.deadlineValue} {order.deadlineUnit}</span>
            </div>
            {order.store && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Store className="w-4 h-4 text-indigo-500" />
                <span className="capitalize">{order.store}</span>
              </div>
            )}
            {!isInProgress && order.taskerName && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <User className="w-4 h-4 text-indigo-500" />
                <span>{order.taskerName}</span>
              </div>
            )}
          </motion.div>

          {/* Action Button Area */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 + 0.7 }}
            className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end"
          >
            {isPending ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>Payment details available once tasker accepts</span>
              </div>
            ) : isInProgress && hasPaid ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Your task will be completed shortly</span>
              </div>
            ) : isInProgress && !hasPaid ? (
              <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                <Wallet className="w-4 h-4" />
                <span>Waiting for your payment to begin task</span>
              </div>
            ) : (
              <Button 
                onClick={() => onViewDetails(order)}
                variant="ghost" 
                size="sm"
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 group/btn"
              >
                View Details
                <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            )}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function EmptyState({ activeTab }: { activeTab: string }) {
  const isSearchingTab = activeTab === 'pending'
  const isPaymentTab = activeTab === 'in_progress'
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="flex flex-col items-center justify-center py-20 px-4"
    >
      <motion.div
        animate={isSearchingTab ? {
          scale: [1, 1.1, 1],
          rotate: [0, 10, -10, 0]
        } : isPaymentTab ? {
          y: [0, -5, 0],
        } : {
          y: [0, -10, 0],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ 
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
          isSearchingTab 
            ? 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30' 
            : isPaymentTab
              ? 'bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30'
            : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700'
        }`}
      >
        {isSearchingTab ? (
          <Search className="w-12 h-12 text-amber-500" />
        ) : isPaymentTab ? (
          <CreditCard className="w-12 h-12 text-indigo-500" />
        ) : (
          <Package className="w-12 h-12 text-slate-400" />
        )}
      </motion.div>
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
        {isSearchingTab ? 'No tasks searching for taskers' : 
         isPaymentTab ? 'No pending payments' : 
         'No orders found'}
      </h3>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
        {activeTab === 'all' 
          ? "You haven't created any errands yet. Book a task to get started!"
          : isSearchingTab
            ? "You don't have any tasks currently searching for taskers."
            : isPaymentTab
              ? "Great! You have no outstanding payments. All your tasks are either completed or paid and in progress."
              : `You don't have any ${activeTab.replace('_', ' ')} orders at the moment.`
        }
      </p>
      {(activeTab === 'all' || isSearchingTab) && (
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button className="mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Book a Task
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 rounded-full border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400"
      />
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 text-slate-500 dark:text-slate-400 font-medium"
      >
        Loading your orders...
      </motion.p>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] px-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mb-6"
      >
        <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
      </motion.div>
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
        Oops! Something went wrong
      </h3>
      <p className="text-slate-500 dark:text-slate-400 text-center mb-6 max-w-md">
        {error}
      </p>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button 
          onClick={onRetry}
          variant="outline"
          className="border-2 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </motion.div>
    </motion.div>
  )
}

function PaymentDetailsModal({ 
  order, 
  taskerDetails, 
  isOpen, 
  isLoading, 
  onClose,
  onPaymentComplete
}: { 
  order: Order | null
  taskerDetails: TaskerDetails | null
  isOpen: boolean
  isLoading: boolean
  onClose: () => void
  onPaymentComplete: (orderId: string) => Promise<void>
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount)
  }

  const handleCopyAccountNumber = () => {
    if (taskerDetails?.bankDetails.accountNumber) {
      navigator.clipboard.writeText(taskerDetails.bankDetails.accountNumber)
      toast.success('Account number copied!')
    }
  }

  const handlePaymentComplete = async () => {
    if (!order) return
    
    setIsSubmitting(true)
    try {
      await onPaymentComplete(order._id)
      // Modal will be closed by parent after successful update
    } catch (error) {
      // Error is handled by parent, just stop loading
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !order) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isSubmitting ? onClose : undefined}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-3xl">
                {!isSubmitting && (
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                )}
                <motion.div
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <Landmark className="w-6 h-6 text-white" />
                    <h2 className="text-2xl font-bold text-white">Payment Instructions</h2>
                  </div>
                  <p className="text-indigo-100 text-sm">Tasker accepted! Complete payment to start</p>
                </motion.div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-8 h-8 rounded-full border-2 border-indigo-200 dark:border-indigo-900 border-t-indigo-600"
                    />
                  </div>
                ) : taskerDetails ? (
                  <>
                    {/* Success Message */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-green-50 dark:bg-green-950/30 rounded-2xl p-4 border border-green-200 dark:border-green-800 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-800 dark:text-green-300">Tasker Assigned</p>
                        <p className="text-sm text-green-600 dark:text-green-400">{order.taskerName} has accepted your task</p>
                      </div>
                    </motion.div>

                    {/* Amount to Transfer */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800"
                    >
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Amount to Transfer</p>
                      <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(order.totalAmount || order.amount)}
                      </p>
                    </motion.div>

                    {/* Bank Details */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Bank Name
                        </label>
                        <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                          {taskerDetails.bankDetails.bankName}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Account Name
                        </label>
                        <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                          {taskerDetails.bankDetails.accountName}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Account Number
                        </label>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.25 }}
                          className="flex items-center gap-2 mt-1"
                        >
                          <p className="text-lg font-mono font-bold text-slate-900 dark:text-white">
                            {taskerDetails.bankDetails.accountNumber}
                          </p>
                          <button
                            onClick={handleCopyAccountNumber}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Copy account number"
                          >
                            <Copy className="w-4 h-4 text-indigo-500" />
                          </button>
                        </motion.div>
                      </div>
                    </motion.div>

                    {/* Info Box */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-4 border border-blue-200 dark:border-blue-800"
                    >
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        <span className="font-semibold">💡 Next Step:</span> Once you transfer {formatCurrency(order.totalAmount || order.amount)}, {order.taskerName} will be notified and can begin working on your task immediately.
                      </p>
                    </motion.div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                    <p className="text-slate-600 dark:text-slate-400">Unable to load tasker details</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-3xl">
                <Button
                  onClick={handlePaymentComplete}
                  disabled={isSubmitting || !taskerDetails}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      I have completed the payment
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [taskerDetails, setTaskerDetails] = useState<TaskerDetails | null>(null)
  const [loadingTasker, setLoadingTasker] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/orders')

      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }

      const data = await response.json()
      setOrders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentComplete = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hasPaid: true }),
      })

      if (!response.ok) {
        throw new Error('Failed to update payment status')
      }

      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === orderId 
            ? { ...order, hasPaid: true }
            : order
        )
      )

      // Close modal
      setSelectedOrder(null)
      setTaskerDetails(null)

      // Show success notification
      toast.success('Payment confirmed! Your tasker has been notified and will begin shortly.', {
        duration: 5000,
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      })

    } catch (err) {
      toast.error('Failed to confirm payment. Please try again.')
      throw err // Re-throw to let modal handle the error state
    }
  }

  const handleViewDetails = async (order: Order) => {
    // Only show modal for in_progress orders (where tasker has accepted)
    if (order.status !== 'in_progress') {
      toast.info('Payment details are shown once a tasker accepts your task')
      return
    }

    // If already paid, show info toast instead of modal
    if (order.hasPaid) {
      toast.info('Payment already confirmed. Your task is in progress!')
      return
    }

    setSelectedOrder(order)
    setLoadingTasker(true)

    try {
      // Fetch tasker details
      if (order.taskerId) {
        const response = await fetch(`/api/taskers/${order.taskerId}`)
        if (response.ok) {
          const data = await response.json()
          setTaskerDetails(data)
        } else {
          toast.error('Failed to load tasker details')
        }
      }
    } catch (err) {
      toast.error('Error loading payment information')
    } finally {
      setLoadingTasker(false)
    }
  }

  const handleCloseModal = () => {
    setSelectedOrder(null)
    setTaskerDetails(null)
  }

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true
    return order.status === activeTab
  })

  // Update tab counts
  const tabsWithCounts = tabs.map(tab => ({
    ...tab,
    count: tab.id === 'all' 
      ? orders.length 
      : orders.filter(o => o.status === tab.id).length
  }))

  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} onRetry={fetchOrders} />

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            My Orders
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            Track and manage your errands
          </p>
        </motion.div>

        {/* Stats Overview */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Total', value: orders.length, color: 'from-slate-400 to-slate-500' },
            { label: 'Searching', value: orders.filter(o => o.status === 'pending').length, color: 'from-amber-400 to-orange-500', animate: true, type: 'pending' },
            { label: 'Payment Needed', value: orders.filter(o => o.status === 'in_progress' && !o.hasPaid).length, color: 'from-indigo-400 to-purple-500', animate: true, type: 'in_progress' },
            { label: 'Completed', value: orders.filter(o => o.status === 'completed').length, color: 'from-emerald-400 to-green-500' }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 + 0.2 }}
              whileHover={{ scale: 1.05, y: -2 }}
              className={`bg-white dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-4 border shadow-lg relative overflow-hidden ${
                stat.animate && stat.value > 0 ? 
                  stat.type === 'pending' ? 'border-amber-200 dark:border-amber-800' : 'border-indigo-200 dark:border-indigo-800'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {stat.animate && stat.value > 0 && (
                <motion.div
                  className={`absolute inset-0 ${
                    stat.type === 'pending' 
                      ? 'bg-gradient-to-r from-amber-400/10 to-orange-500/10' 
                      : 'bg-gradient-to-r from-indigo-400/10 to-purple-500/10'
                  }`}
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              )}
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} mb-2 ${stat.animate && stat.value > 0 ? 'relative' : ''}`}>
                {stat.animate && stat.value > 0 && (
                  <motion.div
                    className="absolute inset-0 rounded-lg bg-white/30"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white relative">{stat.value}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 relative">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
            {tabsWithCounts.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variants={tabVariants}
                animate={activeTab === tab.id ? "active" : "inactive"}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex-1 min-w-[120px] py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-lg'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        activeTab === tab.id
                          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                          : tab.id === 'pending' 
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
                            : tab.id === 'in_progress'
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </motion.span>
                  )}
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl -z-10 shadow-lg"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Orders List */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            variants={containerVariants}
            className="space-y-4"
          >
            {filteredOrders.length === 0 ? (
              <EmptyState activeTab={activeTab} />
            ) : (
              filteredOrders.map((order, index) => (
                <OrderCard 
                  key={order._id} 
                  order={order} 
                  index={index}
                  onViewDetails={handleViewDetails}
                />
              ))
            )}
          </motion.div>
        </AnimatePresence>

        {/* Refresh Button */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="fixed bottom-6 right-6"
        >
          <motion.button
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={fetchOrders}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:shadow-xl transition-shadow"
          >
            <RefreshCw className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </div>

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        order={selectedOrder}
        taskerDetails={taskerDetails}
        isOpen={!!selectedOrder}
        isLoading={loadingTasker}
        onClose={handleCloseModal}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  )
}