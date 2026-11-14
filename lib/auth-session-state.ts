export type AuthSessionError = {
  status?: number
  statusCode?: number
} | null | undefined

export type AuthSessionState = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable'

export function getAuthSessionState(input: {
  hasUser: boolean
  isPending?: boolean
  error?: AuthSessionError
}): AuthSessionState {
  if (input.hasUser) return 'authenticated'
  if (input.isPending) return 'loading'

  const status = Number(input.error?.status ?? input.error?.statusCode)
  if (input.error && status !== 401) return 'unavailable'
  return 'unauthenticated'
}

export function isTemporaryAuthFailure(error?: AuthSessionError) {
  return getAuthSessionState({ hasUser: false, error }) === 'unavailable'
}
