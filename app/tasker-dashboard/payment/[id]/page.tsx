'use client'

import { useRouter, useParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

export default function TaskerPaymentPage() {
  const router = useRouter()
  const { id } = useParams()

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manual payouts handled by SwiftDU</h1>
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Customers no longer send money directly to taskers, and taskers no longer pay platform
        fees from this screen. SwiftDU collects checkout through Flutterwave and handles runner
        settlements internally.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => router.push(`/tasker-dashboard/${id}`)} className="flex-1">
          View task
        </Button>
        <Button variant="outline" onClick={() => router.push('/tasker-dashboard')} className="flex-1">
          Dashboard
        </Button>
      </div>
    </div>
  )
}
