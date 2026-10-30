import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardLanding } from '@/components/dashboard-landing'

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/auth')
  return (
    <DashboardLanding
      userName={session.user.name || 'there'}
      initialTrainingMode={Boolean(session.user.excoRole && session.user.testOrderMode)}
    />
  )
}
