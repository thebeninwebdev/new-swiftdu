import { IndomieBatchSettings } from '@/models/indomie-batch-settings'
export const DEFAULT_INDOMIE_BATCH_SETTINGS = { startMinute: 18 * 60, endMinute: 21 * 60, runIntervalMinutes: 30, bookingCutoffMinutes: 10 }
export type IndomieBatchSettingsValue = typeof DEFAULT_INDOMIE_BATCH_SETTINGS
export async function getIndomieBatchSettings(): Promise<IndomieBatchSettingsValue> {
  const saved = await IndomieBatchSettings.findOne({ key: 'default' }).lean()
  if (!saved) return { ...DEFAULT_INDOMIE_BATCH_SETTINGS }
  return { startMinute: saved.startMinute, endMinute: saved.endMinute, runIntervalMinutes: saved.runIntervalMinutes || 30, bookingCutoffMinutes: saved.bookingCutoffMinutes || 10 }
}
