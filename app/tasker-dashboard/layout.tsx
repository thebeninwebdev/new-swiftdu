// app/tasker-dashboard/layout.tsx
import TaskerSidebar from "@/components/tasker-sidebar"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <TaskerSidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden mt-10 px-3 pt-4 sm:px-4 md:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
