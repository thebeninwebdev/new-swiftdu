import type { Metadata } from 'next'
import AdminSidebar from '@/components/admin-sidebar'

export const metadata: Metadata = {
  title: 'Swiftdu Admin',
  description: 'Manage users, taskers, orders, transactions, and support tickets.',
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen bg-slate-50/70">
      <AdminSidebar />
      <main className="min-w-0 flex-1 pt-16 lg:pt-0">{children}</main>
    </div>
  )
}
