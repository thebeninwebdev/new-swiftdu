'use client'

import { useSearchParams } from 'next/navigation'
import { AdminWorkspaceTabs } from '@/components/admin-workspace-tabs'
import AdminBusinessesPage from '@/app/admin/businesses/page'
import AdminLocationsPage from '@/app/admin/locations/page'
import PricingPage from '@/app/admin/pricing/page'

const tabs = [{ value: 'businesses', label: 'Businesses' }, { value: 'locations', label: 'Locations' }, { value: 'pricing', label: 'Pricing' }]
export default function MarketplaceWorkspace() {
  const tab = useSearchParams().get('tab') || 'businesses'
  const content = tab === 'locations' ? <AdminLocationsPage /> : tab === 'pricing' ? <PricingPage /> : <AdminBusinessesPage />
  return <><div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:pt-10"><p className="text-sm font-semibold text-violet-700">Marketplace</p><h1 className="mt-1 text-3xl font-bold">Marketplace</h1><p className="mt-2 text-sm text-slate-600">Businesses, campus locations and delivery pricing.</p><AdminWorkspaceTabs tabs={tabs} /></div>{content}</>
}
