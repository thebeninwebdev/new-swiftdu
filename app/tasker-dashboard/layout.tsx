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
      <main className="flex-1 overflow-auto pt-20 px-2 md:px-8">
        {children}
      </main>
    </div>
  )
}