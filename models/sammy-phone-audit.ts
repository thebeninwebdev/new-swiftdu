import { createHash } from 'node:crypto'
import { Schema, model, models } from 'mongoose'

export function fingerprintSammyPhone(number: string) { return createHash('sha256').update(number).digest('hex') }
const schema = new Schema({ customerId: { type: String, required: true, index: true }, staffId: { type: String, required: true, index: true }, phoneFingerprint: { type: String, required: true }, phoneType: { type: String, enum: ['alternate', 'whatsapp'], required: true }, verified: { type: Boolean, required: true }, action: { type: String, enum: ['phone_added'], required: true } }, { timestamps: true })
export const SammyPhoneAudit = models.SammyPhoneAudit || model('SammyPhoneAudit', schema)