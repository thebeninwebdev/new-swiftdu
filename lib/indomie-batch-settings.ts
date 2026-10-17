import { IndomieBatchSettings } from '@/models/indomie-batch-settings'
export const DEFAULT_INDOMIE_BATCH_SETTINGS = { startMinute: 18 * 60, endMinute: 21 * 60, windowMinutes: 15 }
export async function getIndomieBatchSettings() { const saved = await IndomieBatchSettings.findOne({ key: 'default' }).lean(); return saved ? { startMinute: saved.startMinute, endMinute: saved.endMinute, windowMinutes: saved.windowMinutes } : DEFAULT_INDOMIE_BATCH_SETTINGS }
