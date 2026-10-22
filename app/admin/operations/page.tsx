'use client'

import { useSearchParams } from 'next/navigation'
import { AdminWorkspaceTabs } from '@/components/admin-workspace-tabs'
import { AdminPeriods } from '@/components/admin-periods'
import { OperationsAdminPage } from '@/components/admin-operations-settings'
import { AdminTransactionsPage } from '@/app/admin/transactions/page'

const tabs = [{ value: 'availability', label: 'Availability' }, { value: 'periods', label: 'Periods' }, { value: 'finance', label: 'Finance' }]
export default function OperationsWorkspace() {
  const tab = useSearchParams().get('tab') || 'availability'
  const content = tab === 'periods' ? <AdminPeriods /> : tab === 'finance' ? <AdminTransactionsPage /> : <OperationsAdminPage />
  return <><div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:pt-10"><p className="text-sm font-semibold text-violet-700">Operations</p><h1 className="mt-1 text-3xl font-bold">Operations</h1><p className="mt-2 text-sm text-slate-600">Availability, academic periods and finance.</p><AdminWorkspaceTabs tabs={tabs} /></div>{content}</>
}
