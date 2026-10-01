import type { FirstOrderBonusFields } from '@/lib/first-order-pricing'
import { convertToNaira } from '@/lib/utils'

export type BonusPriceOrder = FirstOrderBonusFields & {
  amount?: number
  taskerFee?: number
  platformFee?: number
  totalAmount?: number
  pricingModel?: string
  serviceFeeDiscountApplied?: boolean
}

export function FirstOrderBonusNotice({ order, tasker = false }: { order: FirstOrderBonusFields; tasker?: boolean }) {
  if (!order.firstOrderBonusApplied) return null
  return <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
    {tasker ? 'First-order bonus: no platform fee to remit.' : <>First-order bonus: {convertToNaira(order.firstOrderBonusAmount || 0)} saved on the SwiftDU platform fee.</>}
  </p>
}

export function FirstOrderPriceBreakdown({ order, preview = false }: { order: BonusPriceOrder; preview?: boolean }) {
  if (!order.firstOrderBonusApplied) return null
  const taskerFee = order.taskerFee || 0
  const items = Math.max(0, (order.amount || 0) - (order.pricingModel === 'water' || order.pricingModel === 'copy_notes' ? taskerFee : 0))
  const sponsored = order.serviceFeeDiscountApplied ? Math.max(0, items + taskerFee - (order.totalAmount || 0)) : 0
  return <div className="space-y-3 rounded-2xl border border-violet-200 p-4 text-left text-sm dark:border-violet-900">
    <FirstOrderBonusNotice order={order} />
    <dl className="space-y-2 text-slate-700 dark:text-slate-200">
      <div className="flex justify-between gap-4"><dt>Items/service cost</dt><dd>{convertToNaira(items)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Tasker fee</dt><dd>{convertToNaira(taskerFee)}</dd></div>
      <div className="flex justify-between gap-4"><dt>SwiftDU platform fee</dt><dd>{convertToNaira(0)}</dd></div>
      {sponsored > 0 && <div className="flex justify-between gap-4"><dt>Sponsored service fee discount</dt><dd>−{convertToNaira(sponsored)}</dd></div>}
      <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 font-bold dark:border-slate-700"><dt>Total</dt><dd>{convertToNaira(order.totalAmount || 0)}</dd></div>
    </dl>
    {preview && <p className="text-xs text-slate-500 dark:text-slate-400">Available for one order. Your final price is confirmed when you place the order.</p>}
  </div>
}
