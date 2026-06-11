'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ListTodo } from 'lucide-react'

export default function ActiveTasksHomeLink() {
  const [hasActiveTask, setHasActiveTask] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkActiveTask() {
      try {
        const response = await fetch('/api/orders?current=true', { cache: 'no-store' })

        if (!response.ok) return

        const order = await response.json()
        if (mounted) setHasActiveTask(Boolean(order?._id))
      } catch {
        if (mounted) setHasActiveTask(false)
      }
    }

    void checkActiveTask()

    return () => {
      mounted = false
    }
  }, [])

  if (!hasActiveTask) return null

  return (
    <Link
      href="/dashboard/tasks"
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-6 py-3 text-sm font-bold text-sky-700 shadow-sm transition hover:bg-sky-100 sm:w-auto"
    >
      <ListTodo className="h-4 w-4" />
      Track your current tasks
      <ArrowRight className="h-4 w-4" />
    </Link>
  )
}
