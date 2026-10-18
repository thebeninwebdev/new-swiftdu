import mongoose, { Schema, type Model } from 'mongoose'
export interface IAcademicSemester { _id?: mongoose.Types.ObjectId; name: string; startDate: Date; endDate: Date }
export interface IAcademicSession { name: string; startDate: Date; endDate: Date; semesters: IAcademicSemester[]; isActive: boolean; createdBy?: string; updatedBy?: string }
const semesterSchema = new Schema<IAcademicSemester>({ name: { type: String, required: true, trim: true }, startDate: { type: Date, required: true }, endDate: { type: Date, required: true } })
const schema = new Schema<IAcademicSession>({ name: { type: String, required: true, trim: true, unique: true }, startDate: { type: Date, required: true, index: true }, endDate: { type: Date, required: true, index: true }, semesters: { type: [semesterSchema], default: [] }, isActive: { type: Boolean, default: false }, createdBy: String, updatedBy: String }, { timestamps: true })
schema.index({ startDate: 1, endDate: 1 })
export const AcademicSession = (mongoose.models.AcademicSession as Model<IAcademicSession> | undefined) || mongoose.model<IAcademicSession>('AcademicSession', schema)
