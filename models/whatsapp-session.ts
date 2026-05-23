import mongoose, { Schema, Document } from 'mongoose';

export type WhatsAppSessionStep =
  | 'MENU'
  | 'SELECT_STORE'
  | 'ENTER_RESTAURANT_PEOPLE'
  | 'ENTER_DESCRIPTION'
  | 'ENTER_PRICE'
  | 'ENTER_LOCATION'
  | 'CONFIRM_ORDER'
  | 'EDIT_ORDER'
  | 'SUPPORT';

export interface IWhatsAppSession extends Document {
  phone: string;
  name?: string;
  step: WhatsAppSessionStep;
  data: {
    taskType?: 'restaurant' | 'shopping';
    restaurantPeopleCount?: number;
    store?: string;
    description?: string;
    price?: number;
    location?: string;
  };
  lastMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappSessionSchema = new Schema<IWhatsAppSession>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: String,
    step: {
      type: String,
      enum: [
        'MENU',
        'SELECT_STORE',
        'ENTER_RESTAURANT_PEOPLE',
        'ENTER_DESCRIPTION',
        'ENTER_PRICE',
        'ENTER_LOCATION',
        'CONFIRM_ORDER',
        'EDIT_ORDER',
        'SUPPORT',
      ],
      default: 'MENU',
      required: true,
    },
    data: {
      taskType: String,
      restaurantPeopleCount: Number,
      store: String,
      description: String,
      price: Number,
      location: String,
    },
    lastMessageId: String,
  },
  { timestamps: true }
);

export const WhatsAppSession =
  mongoose.models.WhatsAppSession ||
  mongoose.model<IWhatsAppSession>('WhatsAppSession', whatsappSessionSchema);
