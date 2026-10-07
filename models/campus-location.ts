import mongoose, { Schema, type Document, type Model } from 'mongoose'
import { CAMPUS_LOCATION_TYPES, type CampusLocationType } from '@/lib/campus-location'

export interface ICampusLocation extends Document {
  name: string; normalizedName: string; parentLocationId?: mongoose.Types.ObjectId | null
  type: CampusLocationType; coordinates: { latitude: number; longitude: number; accuracy?: number; capturedAt: Date }
  active: boolean; source: 'admin_manual' | 'delivery_learning'; observationCount: number; confidence?: number; createdBy: string; createdAt: Date; updatedAt: Date
}

const coordinateSchema = new Schema({ latitude: { type: Number, required: true, min: -90, max: 90 }, longitude: { type: Number, required: true, min: -180, max: 180 }, accuracy: { type: Number, min: 0 }, capturedAt: { type: Date, required: true } }, { _id: false })
const campusLocationSchema = new Schema<ICampusLocation>({
  name: { type: String, required: true, trim: true, maxlength: 120 }, normalizedName: { type: String, required: true, trim: true, maxlength: 140 },
  parentLocationId: { type: Schema.Types.ObjectId, ref: 'CampusLocation', default: null, index: true }, type: { type: String, enum: CAMPUS_LOCATION_TYPES, required: true, index: true }, coordinates: { type: coordinateSchema, required: true },
  active: { type: Boolean, default: true, index: true }, source: { type: String, enum: ['admin_manual', 'delivery_learning'], default: 'admin_manual' }, observationCount: { type: Number, default: 1, min: 0 }, confidence: { type: Number, min: 0, max: 1 }, createdBy: { type: String, required: true, index: true },
}, { timestamps: true })
campusLocationSchema.index({ parentLocationId: 1, normalizedName: 1 }, { unique: true })
campusLocationSchema.index({ type: 1, active: 1 })
const CampusLocation: Model<ICampusLocation> = mongoose.models.CampusLocation || mongoose.model<ICampusLocation>('CampusLocation', campusLocationSchema)
export default CampusLocation
