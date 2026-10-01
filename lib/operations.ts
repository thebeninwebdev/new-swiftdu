// Server-side configuration; do not import into client components.
export function areOperationsEnabled() {
  return process.env.OPERATIONS_ENABLED === 'true'
}

// Pass only shouldCreateTestOrder(databaseAccount), never request data.
export function canCreateOrder(isTestOrder: boolean) {
  return areOperationsEnabled() || isTestOrder === true
}

// Taskers may only view or act on training orders while customer operations are paused.
export function canWorkOnOrder(isTestOrder: boolean) {
  return areOperationsEnabled() || isTestOrder === true
}

export function isCustomerOperationRoute(pathname: string) {
  return pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/available-tasks')
}

export const OPERATIONS_SUSPENDED = {
  error: 'SwiftDU operations are currently suspended.',
  code: 'OPERATIONS_SUSPENDED',
} as const
