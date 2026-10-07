'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function PaymentReviewActions({ busy, onConfirm }: { busy: boolean; onConfirm: () => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  return <div className="mt-4 space-y-3">
    <Button className="min-h-12 w-full rounded-xl bg-violet-600 text-white hover:bg-violet-700" disabled={busy} onClick={() => setOpen(true)}>I have received the payment</Button>
    <Link href="/tasker-dashboard?view=all" className="flex min-h-12 items-center justify-center rounded-xl border border-violet-300 px-4 text-sm font-bold text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-950">Check other tasks</Link>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader><DialogTitle>Payment received?</DialogTitle><DialogDescription>Only confirm this if the customer&apos;s payment has actually entered your account.</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Not yet</Button>
          <Button disabled={busy} onClick={async () => { if (await onConfirm()) setOpen(false) }}>{busy ? 'Confirming...' : 'Yes, I received it'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
