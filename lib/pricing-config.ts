import { getDeliveryDestination, DELIVERY_DESTINATIONS } from '@/lib/delivery-policy'
import { PricingRule, type PricingTaskType } from '@/models/pricing-rule'

export const PRICING_TASK_TYPES: PricingTaskType[] = ['restaurant', 'shopping', 'printing', 'indomie']
export const LAUNCH_DEFAULT_FEES: Record<PricingTaskType, number> = { restaurant: 600, shopping: 600, printing: 900, indomie: 600 }
export function pricingLocationId(location?: string | null) { return getDeliveryDestination(location)?.id || 'default' }
export function isConfigurablePricingTask(taskType: string): taskType is PricingTaskType { return PRICING_TASK_TYPES.includes(taskType as PricingTaskType) }

export async function getConfiguredServiceFee({ taskType, location }: { taskType: string; location?: string | null }) {
  if (!isConfigurablePricingTask(taskType)) return null
  const locationId = pricingLocationId(location)
  const rules = await PricingRule.find({ taskType, enabled: true, locationId: { $in: locationId === 'default' ? ['default'] : [locationId, 'default'] } }).lean()
  const exact = rules.find(rule => rule.locationId === locationId)
  const fallback = rules.find(rule => rule.locationId === 'default')
  return exact?.serviceFee || fallback?.serviceFee || LAUNCH_DEFAULT_FEES[taskType]
}

export async function getPricingMatrix() {
  const rules = await PricingRule.find({ enabled: true }).lean()
  const defaults = Object.fromEntries(PRICING_TASK_TYPES.map(taskType => [taskType, rules.find(rule => rule.taskType === taskType && rule.locationId === 'default')?.serviceFee || LAUNCH_DEFAULT_FEES[taskType]])) as Record<PricingTaskType, number>
  return { taskTypes: PRICING_TASK_TYPES, locations: [{ id: 'default', label: 'Default fee' }, ...DELIVERY_DESTINATIONS.map(({ id, aliases }) => ({ id, label: aliases[0] }))], defaults, rules }
}

export async function seedLaunchPricingRules() {
  await Promise.all(PRICING_TASK_TYPES.map(taskType => PricingRule.updateOne({ taskType, locationId: 'default' }, { $setOnInsert: { serviceFee: LAUNCH_DEFAULT_FEES[taskType], enabled: true, label: 'Default' } }, { upsert: true })))
}
