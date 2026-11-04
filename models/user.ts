import { Schema, Document, models, model, deleteModel } from "mongoose";

export type ExcoRole = "CFO" | "CMO" | "COO" | "CTO";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";
export type CustomerPhoneType = "primary" | "whatsapp" | "alternate";

export interface IUserPhone {
  number: string;
  normalizedNumber: string;
  type: CustomerPhoneType;
  verified?: boolean;
}

export interface IUser extends Document {
  name?: string;
  email: string;
  emailVerified: boolean;
  password?: string;
  role: "user" | "admin" | "tasker";
  phone?: string;
  location?: string;
  defaultLocation?: string;
  defaultLocationId?: string;
  defaultRoomNumber?: string;
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
  excoRole?: ExcoRole;
  firstOrderBonusOrderId?: string;
  firstOrderBonusConsumedAt?: Date;
  firstOrderBonusVersion?: number;
  serviceFeeDiscountEnabled?: boolean;
  serviceFeeDiscountGrantedByUserId?: string;
  serviceFeeDiscountGrantedByName?: string;
  serviceFeeDiscountGrantedByPhone?: string;
  serviceFeeDiscountGrantedAt?: Date;
  serviceFeeDiscountRemainingOrders?: number;
  phones?: IUserPhone[];
  customerSource?: "website" | "staff_whatsapp" | "staff_telegram";
  createdByStaffId?: string;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  telegramEnabled?: boolean;
  telegramLinkedAt?: Date;
  telegramRevokedAt?: Date;
}

const UserPhoneSchema = new Schema<IUserPhone>(
  {
    number: { type: String, required: true, trim: true },
    normalizedNumber: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: ["primary", "whatsapp", "alternate"], required: true },
    verified: { type: Boolean, default: false },
  },
  { _id: false }
);

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
    phones: {
      type: [UserPhoneSchema],
      default: undefined,
    },
    customerSource: {
      type: String,
      enum: ["website", "staff_whatsapp", "staff_telegram"],
      default: "website",
      index: true,
    },
    createdByStaffId: { type: String, required: false, index: true },
    telegramUserId: { type: String, required: false, unique: true, sparse: true, index: true },
    telegramUsername: { type: String, required: false, trim: true },
    telegramFirstName: { type: String, required: false, trim: true },
    telegramLastName: { type: String, required: false, trim: true },
    telegramEnabled: { type: Boolean, default: false, index: true },
    telegramLinkedAt: { type: Date, required: false },
    telegramRevokedAt: { type: Date, required: false },
    location: {
      type: String,
      required: false,
    },
    defaultLocation: {
      type: String,
      required: false,
    },
    defaultLocationId: { type: String, required: false },
    defaultRoomNumber: { type: String, required: false, trim: true, maxlength: 40 },
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
    excoRole: {
      type: String,
      enum: ["CFO", "CMO", "COO", "CTO"],
      required: false,
    },
    firstOrderBonusOrderId: String,
    firstOrderBonusConsumedAt: Date,
    firstOrderBonusVersion: { type: Number, default: 0 },
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

UserSchema.index({ "phones.normalizedNumber": 1 }, { unique: true, sparse: true });


// Refresh the development model after adding bonus fields.
if (
  models.user &&
  (!models.user.schema.path('firstOrderBonusOrderId') ||
    !models.user.schema.path('telegramUserId') ||
    !models.user.schema.path('telegramRevokedAt') ||
    !models.user.schema.path('phones'))
) {
  // Mongoose clears both its global registry and default connection registry.
  deleteModel('user');
}

export const User =
  models.user || model<IUser>("user", UserSchema);
