// Server-side configuration; do not import into client components.
export function areOperationsEnabled() {
  return process.env.OPERATIONS_ENABLED === 'true'
}

// Pass only shouldCreateTestOrder(databaseAccount), never request data.
export function canCreateOrder(isTestOrder: boolean) {
  return areOperationsEnabled() || isTestOrder === true
}

export const OPERATIONS_SUSPENDED = {
  error: 'SwiftDU operations are currently suspended.',
  code: 'OPERATIONS_SUSPENDED',
} as const
