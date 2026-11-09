import MessageTemplate, { type IMessageTemplate } from '@/models/message-template'
import { DEFAULT_MESSAGE_TEMPLATES } from './message-templates'

export async function seedDefaultTemplatesIfEmpty(): Promise<IMessageTemplate[]> {
  const count = await MessageTemplate.countDocuments()
  if (count > 0) {
    return MessageTemplate.find().sort({ displayOrder: 1, createdAt: 1 })
  }

  // Idempotently insert defaults
  await MessageTemplate.insertMany(DEFAULT_MESSAGE_TEMPLATES)
  return MessageTemplate.find().sort({ displayOrder: 1, createdAt: 1 })
}
