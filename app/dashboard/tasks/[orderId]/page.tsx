import { Suspense } from 'react'

import OrdersPage from '../TasksClient'

interface PageProps {
  params: Promise<{
    orderId: string
  }>
}

export default async function Page({ params }: PageProps) {
  const { orderId } = await params

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrdersPage trackingOrderId={orderId} />
    </Suspense>
  )
}
