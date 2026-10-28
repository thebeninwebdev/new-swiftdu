export const ADMIN_WORKSPACE_TABS = {
  orders: ['live', 'all', 'batches', 'reviews'],
  people: ['taskers', 'customers'],
  marketplace: ['businesses', 'locations', 'pricing'],
  operations: ['availability', 'periods', 'finance'],
} as const

export type AdminWorkspace = keyof typeof ADMIN_WORKSPACE_TABS

export const LIVE_ORDER_STATUSES = ['pending', 'in_progress', 'paid'] as const
export const ORDER_STATUSES = [...LIVE_ORDER_STATUSES, 'completed', 'cancelled'] as const
export type AdminOrderStatus = (typeof ORDER_STATUSES)[number]
export type AdminOrderScope = 'live' | 'all'

export function resolveAdminWorkspaceTab(workspace: AdminWorkspace, candidate?: string | null) {
  const tabs = ADMIN_WORKSPACE_TABS[workspace] as readonly string[]
  return candidate && tabs.includes(candidate) ? candidate : tabs[0]
}

export function buildAdminWorkspaceTabHref({
  pathname,
  search,
  tab,
  reset = [],
}: {
  pathname: string
  search: string
  tab: string
  reset?: readonly string[]
}) {
  const params = new URLSearchParams(search)
  params.set('tab', tab)
  reset.forEach((name) => params.delete(name))
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function isAdminOrderStatus(value?: string | null): value is AdminOrderStatus {
  return Boolean(value && (ORDER_STATUSES as readonly string[]).includes(value))
}

export function isStatusAvailableInOrderScope(scope: AdminOrderScope, status: string) {
  return status === 'all' || (isAdminOrderStatus(status) && (scope === 'all' || (LIVE_ORDER_STATUSES as readonly string[]).includes(status)))
}

export function getAdminOrderStatusQuery(scope: AdminOrderScope, selectedStatus: string) {
  if (selectedStatus !== 'all' && isStatusAvailableInOrderScope(scope, selectedStatus)) return selectedStatus
  return scope === 'live' ? LIVE_ORDER_STATUSES.join(',') : 'all'
}

export function isLatestAdminOrderRequest(requestGeneration: number, latestGeneration: number) {
  return requestGeneration === latestGeneration
}
