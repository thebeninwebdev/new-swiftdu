import mongoose, { Schema, Document } from "mongoose";

export type DryCleanerStatus = "pending" | "approved" | "rejected";
export type AvailabilityDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface IDryCleaner extends Document {
  userId: mongoose.Types.ObjectId;
  businessName: string;
  ownerName: string;
  phone: string;
  location: string;
  businessLogo?: string;
  businessLogoPublicId?: string;
  status: DryCleanerStatus;
  pricing: {
    shirt: number;
    trouser: number;
    hoodieMin: number;
    hoodieMax: number;
    bedsheetMin: number;
    bedsheetMax: number;
    duvetMin: number;
    duvetMax: number;
    underwear: number;
    shoes: number;
    doesNotWashShirt: boolean;
    doesNotWashTrouser: boolean;
    doesNotWashHoodie: boolean;
    doesNotWashBedsheet: boolean;
    doesNotWashDuvet: boolean;
    doesNotWashUnderwear: boolean;
    doesNotWashShoes: boolean;
  };
  availability: {
    acceptingDays: AvailabilityDay[];
    expectedDeliveryDays: number;
    cutoffTime: string;
    temporarilyClosed: boolean;
  };
  notes?: string;
}

const DAY_VALUES: AvailabilityDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DryCleanerSchema = new Schema<IDryCleaner>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "user",
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    businessLogo: {
      type: String,
    },
    businessLogoPublicId: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    pricing: {
      shirt: { type: Number, required: true, default: 500, min: 0 },
      trouser: { type: Number, required: true, default: 500, min: 0 },
      hoodieMin: { type: Number, required: true, default: 500, min: 0 },
      hoodieMax: { type: Number, required: true, default: 1000, min: 0 },
      bedsheetMin: { type: Number, required: true, default: 1000, min: 0 },
      bedsheetMax: { type: Number, required: true, default: 1500, min: 0 },
      duvetMin: { type: Number, required: true, default: 2000, min: 0 },
      duvetMax: { type: Number, required: true, default: 2500, min: 0 },
      underwear: { type: Number, required: true, default: 500, min: 0 },
      shoes: { type: Number, required: true, default: 500, min: 0 },
      doesNotWashShirt: { type: Boolean, default: false },
      doesNotWashTrouser: { type: Boolean, default: false },
      doesNotWashHoodie: { type: Boolean, default: false },
      doesNotWashBedsheet: { type: Boolean, default: false },
      doesNotWashDuvet: { type: Boolean, default: true },
      doesNotWashUnderwear: { type: Boolean, default: true },
      doesNotWashShoes: { type: Boolean, default: true },
    },
    availability: {
      acceptingDays: {
        type: [String],
        enum: DAY_VALUES,
        required: true,
        default: ["monday", "wednesday", "friday"],
      },
      expectedDeliveryDays: {
        type: Number,
        required: true,
        default: 2,
        min: 1,
        max: 14,
      },
      cutoffTime: {
        type: String,
        required: true,
        default: "17:00",
      },
      temporarilyClosed: {
        type: Boolean,
        default: false,
      },
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.DryCleaner ||
  mongoose.model<IDryCleaner>("DryCleaner", DryCleanerSchema);
