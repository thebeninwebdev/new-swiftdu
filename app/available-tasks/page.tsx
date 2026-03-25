'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TaskCard } from '@/components/TaskCard'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

interface Task {
  _id: string
  taskType: string
  description: string
  amount: number
  deadlineValue: number
  deadlineUnit: 'mins' | 'hours' | 'days'
  location: string
  store?: string
  createdAt: string
}

export default function AvailableTasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAvailableTasks = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch('/api/orders/available')
        
        if (!response.ok) {
          if (response.status === 401) {
            toast.error('Please log in to view available tasks')
            router.push('/login')
            return
          }
          throw new Error('Failed to fetch tasks')
        }

        const data = await response.json()
        setTasks(data)
      } catch (err) {
        console.error('[Available Tasks Error]:', err)
        setError('Failed to load available tasks. Please try again.')
        toast.error('Failed to load tasks')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAvailableTasks()
  }, [router])

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-screen">
            <Spinner />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-4xl font-bold text-foreground">Available Tasks</h1>
          <p className="text-muted-foreground">
            Browse and accept tasks from your community
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3 mb-8">
          <Button variant="outline" onClick={() => router.push('/my-tasks')}>
            My Tasks
          </Button>
          <Button variant="outline" onClick={() => router.push('/errand-wizard')}>
            Create Task
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {tasks.length === 0 && !error && (
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground mb-4">No tasks available right now</p>
            <p className="text-sm text-muted-foreground mb-6">Check back later or create your own task</p>
            <Button onClick={() => router.push('/errand-wizard')}>
              Create a Task
            </Button>
          </div>
        )}

        {/* Tasks Grid */}
        {tasks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((task) => (
              <TaskCard
                key={task._id}
                id={task._id}
                taskType={task.taskType}
                description={task.description}
                amount={task.amount}
                deadlineValue={task.deadlineValue}
                deadlineUnit={task.deadlineUnit}
                location={task.location}
                store={task.store}
                createdAt={task.createdAt}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
