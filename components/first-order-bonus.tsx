import type { FirstOrderBonusFields } from '@/lib/first-order-pricing'
import { convertToNaira } from '@/lib/utils'

export type BonusPriceOrder = FirstOrderBonusFields & {
  amount?: number
  commission?: number
  serviceFee?: number
  taskerFee?: number
  platformFee?: number
  totalAmount?: number
  pricingModel?: string
  serviceFeeDiscountApplied?: boolean
}

/** Kept for existing tasker screens; the customer discount is shown in the fee row. */
export function FirstOrderBonusNotice(_: { order: FirstOrderBonusFields; tasker?: boolean }) {
  return null
}

/** Customer-facing prices intentionally combine tasker and platform shares as one service fee. */
export function FirstOrderPriceBreakdown({ order, preview = false }: { order: BonusPriceOrder; preview?: boolean }) {
  if (!order.firstOrderBonusApplied) return null
  const serviceFee = Math.max(0, Number(order.serviceFee || order.commission || 0))

  return <div className="space-y-2 border-t border-slate-200 pt-3 text-left text-sm dark:border-slate-800">
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">Service fee</span>
      <span className="font-semibold">{convertToNaira(serviceFee)}</span>
    </div>
    <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 font-bold text-slate-900 dark:border-slate-800 dark:text-white"><span>Total</span><span>{convertToNaira(order.totalAmount || 0)}</span></div>
    {preview && <p className="text-xs text-slate-500 dark:text-slate-400">Your first-order benefit is applied automatically.</p>}
  </div>
}
