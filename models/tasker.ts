import mongoose, { Schema, Document } from "mongoose";

export interface ITasker extends Document {
  userId?: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone: string;
  location: string;

  profileImage?: string;
  studentId: string;
  level?: string;
  availability?: string[];
  motivation?: string;
  motivationOther?: string;

  isVerified: boolean;
  isRejected?: boolean;
  taskerMode?: "training" | "live";
  onboardingTokenHash?: string;
  onboardingTokenExpiresAt?: Date;
  onboardingEmailSentAt?: Date;
  onboardingTokenUsedAt?: Date;
  accountLinkedAt?: Date;

  rating: number;
  completedTasks: number;
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
      required: false,
      ref: "user", 
    },

    firstName: {
      type: String,
      required: false,
      trim: true,
    },

    lastName: {
      type: String,
      required: false,
      trim: true,
    },

    fullName: {
      type: String,
      required: false,
      trim: true,
    },

    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      index: true,
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

    level: {
      type: String,
      required: false,
    },

    availability: {
      type: [String],
      required: false,
      default: [],
    },

    motivation: {
      type: String,
      required: false,
    },

    motivationOther: {
      type: String,
      required: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isRejected: {
      type: Boolean,
      default: false,
    },

    taskerMode: {
      type: String,
      enum: ["training", "live"],
      index: true,
    },

    onboardingTokenHash: {
      type: String,
      required: false,
      select: false,
      index: true,
      unique: true,
      sparse: true,
    },

    onboardingTokenExpiresAt: {
      type: Date,
      required: false,
      select: false,
    },

    onboardingEmailSentAt: {
      type: Date,
      required: false,
      select: false,
    },

    onboardingTokenUsedAt: {
      type: Date,
      required: false,
      select: false,
    },

    accountLinkedAt: {
      type: Date,
      required: false,
    },

    rating: {
      type: Number,
      default: 0,
    },

    completedTasks: {
      type: Number,
      default: 0,
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
        default: "",
      },
      accountNumber: {
        type: String,
        default: "",
      },
      accountName: {
        type: String,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  }
);

export default  mongoose.models.Tasker ||
  mongoose.model<ITasker>("Tasker", TaskerSchema);
