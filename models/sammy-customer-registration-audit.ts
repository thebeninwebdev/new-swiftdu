import { createHash } from 'node:crypto'
import { Schema, model, models } from 'mongoose'

export function fingerprintSammyRegistrationValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

const schema = new Schema({
  staffId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  phoneFingerprint: { type: String, required: true },
  emailFingerprint: { type: String, required: true },
  hostelId: { type: String, required: true },
  action: { type: String, enum: ['customer_created', 'customer_email_added', 'customer_room_updated', 'customer_room_cleared'], required: true },
}, { timestamps: true })

export const SammyCustomerRegistrationAudit = models.SammyCustomerRegistrationAudit ||
  model('SammyCustomerRegistrationAudit', schema)
