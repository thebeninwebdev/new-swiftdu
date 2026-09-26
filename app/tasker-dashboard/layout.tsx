import { Suspense } from "react"
// app/tasker-dashboard/layout.tsx
import TaskerSidebar from "@/components/tasker-sidebar"
import { PushSubscriptionManager } from "@/components/PushSubscriptionManager"
import TaskerBottomNav from "@/components/BottomNavigation"
import { TaskerWorkProvider } from '@/components/tasker/WorkProvider'
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-slate-500">
          Loading your dashboard...
        </div>
      }
    >
      <TaskerWorkProvider>
        <div className="flex min-h-screen bg-[#faf9ff] dark:bg-slate-950">
          <TaskerSidebar/>
            <main className="min-w-0 flex-1 overflow-x-hidden px-3 pb-32 pt-2 sm:px-4 md:px-6 lg:px-8 lg:pb-4 lg:pt-4">
              {children}
              </main>
              
              <TaskerBottomNav />
          <PushSubscriptionManager />
        </div>
      </TaskerWorkProvider>
    </Suspense>
  )
}
