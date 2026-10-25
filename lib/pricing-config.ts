import { Types } from 'mongoose'
import CampusLocation from '@/models/campus-location'
import { PricingRule, type PricingTaskType } from '@/models/pricing-rule'

export const PRICING_TASK_TYPES: PricingTaskType[] = ['restaurant', 'shopping', 'printing', 'indomie']
export const LAUNCH_DEFAULT_FEES: Record<PricingTaskType, number> = { restaurant: 600, shopping: 600, printing: 900, indomie: 600 }
export function isConfigurablePricingTask(taskType: string): taskType is PricingTaskType { return PRICING_TASK_TYPES.includes(taskType as PricingTaskType) }

export type PricingFeeSource = 'parent_override' | 'default_rule' | 'launch_default'
export type PricingFeeResolution = { taskType: PricingTaskType; parentLocationId: string | null; serviceFee: number; source: PricingFeeSource }
type PricingRuleValue = { taskType: PricingTaskType; parentLocationId?: Types.ObjectId | string | null; serviceFee: number; enabled?: boolean }
const parentId = (value: Types.ObjectId | string | null | undefined) => value == null ? null : String(value)

/** Pure rule precedence, shared by the DB resolver and tests. */
export function resolveConfiguredServiceFee(taskType: PricingTaskType, parentLocationId: string | null, rules: PricingRuleValue[]): PricingFeeResolution {
  const enabled = rules.filter(rule => rule.taskType === taskType && rule.enabled !== false)
  const override = parentLocationId && enabled.find(rule => parentId(rule.parentLocationId) === parentLocationId)
  if (override) return { taskType, parentLocationId, serviceFee: override.serviceFee, source: 'parent_override' }
  const fallback = enabled.find(rule => rule.parentLocationId == null)
  if (fallback) return { taskType, parentLocationId, serviceFee: fallback.serviceFee, source: 'default_rule' }
  return { taskType, parentLocationId, serviceFee: LAUNCH_DEFAULT_FEES[taskType], source: 'launch_default' }
}

export async function getConfiguredServiceFeeResolution({ taskType, parentLocationId }: { taskType: string; parentLocationId?: Types.ObjectId | string | null }): Promise<PricingFeeResolution | null> {
  if (!isConfigurablePricingTask(taskType)) return null
  const id = parentId(parentLocationId)
  const objectId = id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null
  const rules = await PricingRule.find({ taskType, enabled: true, $or: objectId ? [{ parentLocationId: objectId }, { parentLocationId: null }] : [{ parentLocationId: null }] }).lean()
  return resolveConfiguredServiceFee(taskType, id, rules)
}

export async function getConfiguredServiceFee(input: { taskType: string; parentLocationId?: Types.ObjectId | string | null }) {
  return (await getConfiguredServiceFeeResolution(input))?.serviceFee ?? null
}

export async function getPricingMatrix() {
  const [rules, locations] = await Promise.all([PricingRule.find({ enabled: true }).lean(), CampusLocation.find({ parentLocationId: null, active: true }).select('_id name type').sort({ name: 1 }).lean()])
  const parentLocations = locations.map(location => ({ id: String(location._id), name: location.name, type: location.type }))
  const defaults = Object.fromEntries(PRICING_TASK_TYPES.map(taskType => [taskType, resolveConfiguredServiceFee(taskType, null, rules).serviceFee])) as Record<PricingTaskType, number>
  const effective = Object.fromEntries(PRICING_TASK_TYPES.map(taskType => [taskType, Object.fromEntries(parentLocations.map(location => [location.id, resolveConfiguredServiceFee(taskType, location.id, rules)]))]))
  return { taskTypes: PRICING_TASK_TYPES, parentLocations, defaults, rules, effective }
}

export async function seedLaunchPricingRules() {
  await Promise.all(PRICING_TASK_TYPES.map(taskType => PricingRule.updateOne({ taskType, parentLocationId: null }, { $setOnInsert: { serviceFee: LAUNCH_DEFAULT_FEES[taskType], enabled: true, label: 'Default', locationId: 'default' } }, { upsert: true })))
}
