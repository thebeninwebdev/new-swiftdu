import mongoose, { Schema, type Document } from 'mongoose'

export const WHATSAPP_FLOW_VERSION = 2

export type WhatsAppSessionStep =
  | 'MENU' | 'SERVICE' | 'RESTAURANT_MODE' | 'VENDOR' | 'DESCRIPTION' | 'AMOUNT'
  | 'RESTAURANT_PEOPLE' | 'PACKAGING' | 'TAKEAWAY_COUNT' | 'PRINTING_TYPE'
  | 'PRINTING_PAGES' | 'PRINTING_EDITING' | 'WATER_BAGS' | 'INDOMIE_PACKS'
  | 'INDOMIE_EGGS' | 'PARENT_LOCATION' | 'EXACT_LOCATION' | 'ROOM_NUMBER'
  | 'DELIVERY_DETAIL' | 'REVIEW'

export type WhatsAppOrderDraft = {
  taskType?: 'restaurant' | 'shopping' | 'printing' | 'water' | 'indomie'
  cafeInquiry?: boolean
  vendorId?: string
  deliveryPricingVendorId?: string
  vendorDisplayName?: string
  parentLocationId?: string
  exactLocationId?: string
  parentLocationName?: string
  exactLocationName?: string
  parentLocationType?: string
  requiresRoomNumber?: boolean
  roomNumber?: string
  deliveryLocation?: string
  description?: string
  amountInput?: number
  restaurantPeopleCount?: number
  restaurantTakeawayCount?: number
  packaging?: 'takeaway' | 'cellophane' | 'mixed'
  waterBags?: number
  printingServiceType?: 'printing' | 'photocopying'
  printingNeedsEditing?: boolean
  numberOfPages?: number
  indomiePacks?: number
  eggCount?: number
  expectedIndomieMode?: 'normal' | 'batching' | 'closed'
  lastQuotedFingerprint?: string
  listPage?: number
}

export interface IWhatsAppSession extends Document {
  phone: string
  userId?: string
  name?: string
  flowVersion: number
  step: WhatsAppSessionStep
  data: WhatsAppOrderDraft
  revision: number
  lastMessageId?: string
  createdAt: Date
  updatedAt: Date
}

const schema = new Schema<IWhatsAppSession>({
  phone: { type: String, required: true, unique: true, index: true },
  userId: { type: String, index: true },
  name: String,
  flowVersion: { type: Number, default: WHATSAPP_FLOW_VERSION, required: true },
  step: { type: String, required: true, default: 'MENU' },
  data: { type: Schema.Types.Mixed, default: {} },
  revision: { type: Number, default: 0 },
  lastMessageId: String,
}, { timestamps: true, optimisticConcurrency: true })

export const WhatsAppSession = mongoose.models.WhatsAppSession ||
  mongoose.model<IWhatsAppSession>('WhatsAppSession', schema)
