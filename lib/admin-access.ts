import { getExcoAccess, type ExcoAccess } from '@/lib/exco'

export interface AdminDashboardAccess extends ExcoAccess {
  userId: string
  isAdmin: boolean
}

export function canAccessAdminDashboard(
  access: Pick<ExcoAccess, 'isAuthenticated' | 'userId' | 'userRole' | 'excoRole'>,
) {
  return Boolean(
    access.isAuthenticated &&
    access.userId &&
    (access.userRole?.toLowerCase() === 'admin' || access.excoRole),
  )
}

export async function getAdminDashboardAccess(headers: Headers) {
  const access = await getExcoAccess(headers)
  if (!canAccessAdminDashboard(access)) return null

  return {
    ...access,
    userId: access.userId as string,
    isAdmin: access.userRole?.toLowerCase() === 'admin',
  } satisfies AdminDashboardAccess
}
