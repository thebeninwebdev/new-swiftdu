'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface TaskCardProps {
  id: string
  taskType: string
  description: string
  amount: number
  totalAmount?: number
  deadlineValue: number
  deadlineUnit: 'mins' | 'hours' | 'days'
  location: string
  store?: string
  createdAt: string
}

const taskTypeColors: Record<string, string> = {
  restaurant: 'bg-orange-100 text-orange-800 border-orange-300',
  printing: 'bg-blue-100 text-blue-800 border-blue-300',
  shopping: 'bg-green-100 text-green-800 border-green-300',
  others: 'bg-purple-100 text-purple-800 border-purple-300',
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Restaurant',
  printing: 'Printing',
  shopping: 'Shopping',
  others: 'Others',
}

export function TaskCard({ id, taskType, description, amount, totalAmount, deadlineValue, deadlineUnit, location, store, createdAt }: TaskCardProps) {
  const router = useRouter()
  const [isAccepting, setIsAccepting] = useState(false)
  const displayAmount = totalAmount || amount

  const handleAcceptTask = async () => {
    try {
      setIsAccepting(true)
      const response = await fetch(`/api/orders/${id}/accept`, {
        method: 'PATCH',
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to accept task')
        return
      }

      toast.success('Task accepted successfully!')
      router.refresh()
      setTimeout(() => {
        router.push('/my-tasks')
      }, 1000)
    } catch (error) {
      toast.error('An error occurred while accepting the task')
      console.error(error)
    } finally {
      setIsAccepting(false)
    }
  }

  const createdDate = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - createdDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  let timeAgo = 'Just now'
  if (diffMins > 0 && diffMins < 60) {
    timeAgo = `${diffMins}m ago`
  } else if (diffHours > 0 && diffHours < 24) {
    timeAgo = `${diffHours}h ago`
  } else if (diffDays > 0) {
    timeAgo = `${diffDays}d ago`
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{taskType === 'restaurant' ? `Order from ${store}` : taskType === 'shopping' ? `Buy from ${store}` : 'Task'}</CardTitle>
            <p className="text-sm text-muted-foreground">{timeAgo}</p>
          </div>
          <Badge className={taskTypeColors[taskType] || taskTypeColors.others}>
            {taskTypeLabels[taskType] || 'Task'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description */}
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Description</p>
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Budget */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Budget</p>
            <p className="text-lg font-semibold text-foreground">₦{displayAmount.toLocaleString()}</p>
          </div>

          {/* Deadline */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deadline</p>
            <p className="text-lg font-semibold text-foreground">{deadlineValue} {deadlineUnit}</p>
          </div>

          {/* Location */}
          <div className="col-span-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</p>
            <p className="text-sm text-foreground">{location}</p>
          </div>
        </div>

        {/* Accept Button */}
        <Button
          onClick={handleAcceptTask}
          disabled={isAccepting}
          className="w-full"
        >
          {isAccepting ? 'Accepting...' : 'Accept Task'}
        </Button>
      </CardContent>
    </Card>
  )
}
