import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminDashboardAccess } from '@/lib/admin-access'

export default async function LiveTaskersLayout({ children }: { children: React.ReactNode }) {
  if (!await getAdminDashboardAccess(await headers())) redirect('/dashboard')
  return children
}
