'use client'

import { useSearchParams } from 'next/navigation'
import { AdminWorkspaceTabs } from '@/components/admin-workspace-tabs'
import { AdminTaskersPage } from '@/app/admin/taskers/page'
import { AdminUsersPage } from '@/app/admin/users/page'

const tabs = [{ value: 'taskers', label: 'Taskers' }, { value: 'customers', label: 'Customers' }]
export default function PeopleWorkspace() {
  const tab = useSearchParams().get('tab') || 'taskers'
  return <><div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:pt-10"><p className="text-sm font-semibold text-violet-700">People</p><h1 className="mt-1 text-3xl font-bold">People</h1><p className="mt-2 text-sm text-slate-600">Manage taskers and customer accounts.</p><AdminWorkspaceTabs tabs={tabs} /></div>{tab === 'customers' ? <AdminUsersPage /> : <AdminTaskersPage />}</>
}
