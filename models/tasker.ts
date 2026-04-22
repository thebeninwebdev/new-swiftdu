import mongoose, { Schema, Document } from "mongoose";

export interface ITasker extends Document {
  userId: mongoose.Types.ObjectId;
  phone: string;
  location: string;

  profileImage?: string;
  studentId: string;

  isVerified: boolean;
  isRejected?: boolean;

  rating: number;
  completedTasks: number;
  isPremium: boolean;
  isSettlementSuspended?: boolean;
  settlementSuspendedAt?: Date | null;

  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

const TaskerSchema = new Schema<ITasker>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "user", 
    },

    phone: {
      type: String,
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    profileImage: {
      type: String,
    },

    studentId: {
      type: String,
      required: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isRejected: {
      type: Boolean,
      default: false,
    },

    rating: {
      type: Number,
      default: 0,
    },

    completedTasks: {
      type: Number,
      default: 0,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    isSettlementSuspended: {
      type: Boolean,
      default: false,
    },
    settlementSuspendedAt: {
      type: Date,
      default: null,
    },

    bankDetails: {
      bankName: {
        type: String,
        required: true,
      },
      accountNumber: {
        type: String,
        required: true,
      },
      accountName: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default  mongoose.models.Tasker ||
  mongoose.model<ITasker>("Tasker", TaskerSchema);
