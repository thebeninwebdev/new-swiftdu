import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
  userId: string;
  taskType: string;
  description: string;
  amount: number;
  commission: number;
  platformFee: number;
  taskerFee: number;
  totalAmount: number;
  deadlineValue: number;
  deadlineUnit: 'mins' | 'hours' | 'days';
  location: string;
  store?: string;
  packaging?: string;
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled';
  taskerId?: string;
  taskerName?: string;
  acceptedBy?: string;
  acceptedAt?: Date;
  paidAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  hasPaid: boolean;
  updatedAt: Date;
  taskerHasPaid:boolean;
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
    commission: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      required: true,
      default: 100,
    },
    taskerFee: {
      type: Number,
      required: true,
      default: 50,
    },
    totalAmount: {
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
    taskerHasPaid: {
      type: Boolean,
      default: false,
    },
    store: String,
    packaging: String,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'paid', 'completed', 'cancelled'],
      default: 'pending',
    },
    taskerId: {
      type: String,
      index: true,
    },
    acceptedBy: {
      type: String,
      index: true,
    },
    acceptedAt: Date,
    paidAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    hasPaid: {
      type: Boolean,
      default: false
    },
    taskerName: String,
  },
  { timestamps: true }
);



export const Order = mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);
