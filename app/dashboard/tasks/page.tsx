// page.tsx
import { Suspense } from 'react'
import TaskListClient from './TaskListClient'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-sm text-slate-500">
          Loading your tasks...
        </div>
      }
    >
      <TaskListClient />
    </Suspense>
  )
}
