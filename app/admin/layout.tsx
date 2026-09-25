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
    <AdminSidebar>{children}</AdminSidebar>
  )
}
