import mongoose, { Schema } from 'mongoose'

const schema = new Schema({
  taskerId: { type: String, required: true, index: true },
  startedAt: { type: Date, required: true },
  endedAt: Date,
  open: { type: Boolean, required: true, default: true },
})
schema.index({ taskerId: 1, open: 1 }, { unique: true, partialFilterExpression: { open: true } })

export const TaskerWorkSession = mongoose.models.TaskerWorkSession || mongoose.model('TaskerWorkSession', schema)
