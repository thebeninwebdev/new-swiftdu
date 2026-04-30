import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const analyticsEventSchema = new Schema(
  {
    visitorId: { type: String, required: true, index: true },
    page: { type: String, required: true, index: true },
    referrer: { type: String, default: "Direct", index: true },
    country: { type: String, default: "Unknown", index: true },
    city: { type: String, default: "Unknown" },
    ipAddress: { type: String, default: "Unknown", index: true },
    browser: { type: String, default: "Unknown" },
    os: { type: String, default: "Unknown" },
    device: { type: String, default: "Desktop", index: true },
    eventType: { type: String, default: "page_view", index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    versionKey: false,
  }
);

analyticsEventSchema.index({ createdAt: -1, page: 1 });
analyticsEventSchema.index({ visitorId: 1, page: 1, eventType: 1, createdAt: -1 });

export type AnalyticsEvent = InferSchemaType<typeof analyticsEventSchema>;

export const AnalyticsEventModel =
  (mongoose.models.AnalyticsEvent as Model<AnalyticsEvent>) ||
  mongoose.model<AnalyticsEvent>("AnalyticsEvent", analyticsEventSchema);
