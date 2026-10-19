import { getDeliveryDestination, DELIVERY_DESTINATIONS } from '@/lib/delivery-policy'
import { PricingRule, type PricingTaskType } from '@/models/pricing-rule'

export const PRICING_TASK_TYPES: PricingTaskType[] = ['restaurant', 'shopping', 'printing', 'indomie']
export const LAUNCH_DEFAULT_FEES: Record<PricingTaskType, number> = { restaurant: 600, shopping: 600, printing: 900, indomie: 600 }
export function pricingLocationId(location?: string | null) { return getDeliveryDestination(location)?.id || 'default' }
export function isConfigurablePricingTask(taskType: string): taskType is PricingTaskType { return PRICING_TASK_TYPES.includes(taskType as PricingTaskType) }

export type PricingFeeSource = 'location_override' | 'default_rule' | 'launch_default'
export type PricingFeeResolution = { taskType: PricingTaskType; locationId: string; serviceFee: number; source: PricingFeeSource }
type PricingRuleValue = { taskType: PricingTaskType; locationId: string; serviceFee: number; enabled?: boolean }

/** Pure rule precedence, shared by the DB resolver and tests. */
export function resolveConfiguredServiceFee(taskType: PricingTaskType, locationId: string, rules: PricingRuleValue[]): PricingFeeResolution {
  const enabled = rules.filter(rule => rule.taskType === taskType && rule.enabled !== false)
  const exact = enabled.find(rule => rule.locationId === locationId)
  if (exact) return { taskType, locationId, serviceFee: exact.serviceFee, source: 'location_override' }
  const fallback = enabled.find(rule => rule.locationId === 'default')
  if (fallback) return { taskType, locationId, serviceFee: fallback.serviceFee, source: 'default_rule' }
  return { taskType, locationId, serviceFee: LAUNCH_DEFAULT_FEES[taskType], source: 'launch_default' }
}

export async function getConfiguredServiceFeeResolution({ taskType, location }: { taskType: string; location?: string | null }): Promise<PricingFeeResolution | null> {
  if (!isConfigurablePricingTask(taskType)) return null
  const locationId = pricingLocationId(location)
  const rules = await PricingRule.find({ taskType, enabled: true, locationId: { $in: locationId === 'default' ? ['default'] : [locationId, 'default'] } }).lean()
  return resolveConfiguredServiceFee(taskType, locationId, rules)
}

export async function getConfiguredServiceFee(input: { taskType: string; location?: string | null }) {
  return (await getConfiguredServiceFeeResolution(input))?.serviceFee ?? null
}

export async function getPricingMatrix() {
  const rules = await PricingRule.find({ enabled: true }).lean()
  const defaults = Object.fromEntries(PRICING_TASK_TYPES.map(taskType => [taskType, rules.find(rule => rule.taskType === taskType && rule.locationId === 'default')?.serviceFee || LAUNCH_DEFAULT_FEES[taskType]])) as Record<PricingTaskType, number>
  const locations = DELIVERY_DESTINATIONS.map(({ id, aliases }) => ({ id, label: aliases[0] }))
  const effective = Object.fromEntries(PRICING_TASK_TYPES.map(taskType => [taskType, Object.fromEntries(locations.map(location => [location.id, resolveConfiguredServiceFee(taskType, location.id, rules)]))]))
  return { taskTypes: PRICING_TASK_TYPES, locations, defaults, rules, effective }
}

export async function seedLaunchPricingRules() {
  await Promise.all(PRICING_TASK_TYPES.map(taskType => PricingRule.updateOne({ taskType, locationId: 'default' }, { $setOnInsert: { serviceFee: LAUNCH_DEFAULT_FEES[taskType], enabled: true, label: 'Default' } }, { upsert: true })))
}
