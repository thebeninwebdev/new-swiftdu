import { Suspense } from "react"
// app/tasker-dashboard/layout.tsx
import TaskerSidebar from "@/components/tasker-sidebar"
import { CompleteProfileGate } from "@/components/complete-profile-gate"

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
      <CompleteProfileGate>
        <div className="flex min-h-screen bg-background">
          <TaskerSidebar />
          <main className="min-w-0 flex-1 overflow-x-hidden px-3 pb-4 pt-4 sm:px-4 md:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </CompleteProfileGate>
    </Suspense>
  )
}
