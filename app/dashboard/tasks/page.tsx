// page.tsx
import { Suspense } from 'react'
import OrdersPage from './TasksClient'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrdersPage />
    </Suspense>
  )
}