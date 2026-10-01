import type { Metadata } from 'next'
import AdminSidebar from '@/components/admin-sidebar'

export const metadata: Metadata = {
  title: 'Swiftdu Admin',
  description: 'Manage users, taskers, orders, transactions.',
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AdminSidebar><div className="min-h-screen bg-slate-50 text-slate-900 [&_[data-slot=card]]:rounded-3xl [&_[data-slot=card]]:border [&_[data-slot=card]]:border-slate-200/80 [&_[data-slot=card]]:bg-white [&_[data-slot=card]]:text-slate-900 [&_[data-slot=card]]:shadow-sm [&_[data-slot=input]]:min-h-11 [&_[data-slot=input]]:rounded-xl [&_[data-slot=input]]:border-slate-200 [&_[data-slot=input]]:bg-white [&_[data-slot=input]]:focus-visible:border-violet-400 [&_[data-slot=input]]:focus-visible:ring-violet-200 [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:focus-visible:ring-violet-300">{children}</div></AdminSidebar>
  )
}
