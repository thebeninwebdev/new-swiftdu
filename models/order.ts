import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
  userId: string;
  taskType: string;
  description: string;
  amount: number;
  deadlineValue: number;
  deadlineUnit: 'mins' | 'hours' | 'days';
  location: string;
  store?: string;
  packaging?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  taskerId?: string;
  taskerName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    taskType: {
      type: String,
      required: true,
      enum: ['restaurant', 'printing', 'shopping', 'others'],
    },
    description: {
      type: String,
      required: true,
      minlength: 10,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    deadlineValue: {
      type: Number,
      required: true,
      min: 1,
    },
    deadlineUnit: {
      type: String,
      required: true,
      enum: ['mins', 'hours', 'days'],
    },
    location: {
      type: String,
      required: true,
    },
    store: String,
    packaging: String,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    taskerId: {
      type: String,
      index: true,
    },
    taskerName: String,
  },
  { timestamps: true }
);

export const Order = mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);
