import { Schema, Document, models, model } from "mongoose";

export type ExcoRole = "CFO" | "CMO" | "COO" | "CTO";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export interface IUser extends Document {
  name?: string;
  email: string;
  emailVerified: boolean;
  password?: string;
  role: "user" | "admin" | "tasker";
  phone?: string;
  location?: string;
  defaultLocation?: string;
  profileImage?: string;
  profileImagePublicId?: string;
  gender?: Gender;
  dateOfBirth?: Date;
  birthdayDay?: number;
  birthdayMonth?: number;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  isSuspended?: boolean;
  isExco?: boolean;
  testOrderMode?: boolean;
  taskerId?: string;
  dryCleanerId?: string;
  excoRole?: ExcoRole;
  serviceFeeDiscountEnabled?: boolean;
  serviceFeeDiscountGrantedByUserId?: string;
  serviceFeeDiscountGrantedByName?: string;
  serviceFeeDiscountGrantedByPhone?: string;
  serviceFeeDiscountGrantedAt?: Date;
  serviceFeeDiscountRemainingOrders?: number;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    isExco: {
      type: Boolean,
      default: false,
      index: true,
    },
    testOrderMode: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
    },
    role: {
      type: String,
      enum: ["user", "admin", "tasker"],
      default: "user",
    },
    phone: {
      type: String,
      required: false,
    },
    location: {
      type: String,
      required: false,
    },
    defaultLocation: {
      type: String,
      required: false,
    },
    profileImage: {
      type: String,
      required: false,
    },
    profileImagePublicId: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      required: false,
    },
    dateOfBirth: {
      type: Date,
      required: false,
    },
    birthdayDay: {
      type: Number,
      min: 1,
      max: 31,
      required: false,
    },
    birthdayMonth: {
      type: Number,
      min: 1,
      max: 12,
      required: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    taskerId: {
      type: String,
      required: false,
    },
    dryCleanerId: {
      type: String,
      required: false,
    },
    excoRole: {
      type: String,
      enum: ["CFO", "CMO", "COO", "CTO"],
      required: false,
    },
    serviceFeeDiscountEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    serviceFeeDiscountGrantedByUserId: {
      type: String,
      required: false,
    },
    serviceFeeDiscountGrantedByName: {
      type: String,
      required: false,
    },
    serviceFeeDiscountGrantedByPhone: {
      type: String,
      required: false,
    },
    serviceFeeDiscountGrantedAt: {
      type: Date,
      required: false,
    },
    serviceFeeDiscountRemainingOrders: {
      type: Number,
      default: 0,
      min: 0,
    }
  },
  {
    timestamps: true,
    collection: "user", // 👈 forces MongoDB collection name to "user"
  }
);


export const User =
  models.user || model<IUser>("user", UserSchema);
