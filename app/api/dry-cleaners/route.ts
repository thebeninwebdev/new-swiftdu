import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import DryCleaner, { type AvailabilityDay } from "@/models/dry-cleaner";
import { User } from "@/models/user";

const VALID_DAYS: AvailabilityDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function toNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function normalizeDays(value: unknown): AvailabilityDay[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((day) => String(day).toLowerCase())
      .filter((day): day is AvailabilityDay => VALID_DAYS.includes(day as AvailabilityDay))
  )];
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const {
      userId,
      businessName,
      ownerName,
      phone,
      location,
      businessLogo,
      businessLogoPublicId,
      pricing = {},
      availability = {},
    } = body;

    if (!userId || !businessName || !ownerName || !phone || !location) {
      return NextResponse.json(
        { error: "Business name, owner name, phone, location, and user are required." },
        { status: 400 }
      );
    }

    if (!/^(\+234|0)[789][01]\d{8}$/.test(String(phone))) {
      return NextResponse.json(
        { error: "Invalid phone number. Must be a valid Nigerian number." },
        { status: 400 }
      );
    }

    const acceptingDays = normalizeDays(availability.acceptingDays);
    if (acceptingDays.length === 0) {
      return NextResponse.json(
        { error: "Select at least one day for accepting clothes." },
        { status: 400 }
      );
    }

    const cutoffTime = String(availability.cutoffTime || "17:00");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoffTime)) {
      return NextResponse.json(
        { error: "Cutoff time must use HH:mm format." },
        { status: 400 }
      );
    }

    const nextPricing = {
      shirt: toNumber(pricing.shirt, 500),
      trouser: toNumber(pricing.trouser, 500),
      hoodieMin: toNumber(pricing.hoodieMin, 500),
      hoodieMax: toNumber(pricing.hoodieMax, 1000),
      bedsheetMin: toNumber(pricing.bedsheetMin, 1000),
      bedsheetMax: toNumber(pricing.bedsheetMax, 1500),
      duvetMin: toNumber(pricing.duvetMin, 2000),
      duvetMax: toNumber(pricing.duvetMax, 2500),
      underwear: toNumber(pricing.underwear, 500),
      shoes: toNumber(pricing.shoes, 500),
      doesNotWashShirt: pricing.doesNotWashShirt === true,
      doesNotWashTrouser: pricing.doesNotWashTrouser === true,
      doesNotWashHoodie: pricing.doesNotWashHoodie === true,
      doesNotWashBedsheet: pricing.doesNotWashBedsheet === true,
      doesNotWashDuvet: pricing.doesNotWashDuvet !== false,
      doesNotWashUnderwear: pricing.doesNotWashUnderwear !== false,
      doesNotWashShoes: pricing.doesNotWashShoes !== false,
    };

    if (
      nextPricing.hoodieMin > nextPricing.hoodieMax ||
      nextPricing.bedsheetMin > nextPricing.bedsheetMax ||
      nextPricing.duvetMin > nextPricing.duvetMax
    ) {
      return NextResponse.json(
        { error: "Minimum prices cannot be higher than maximum prices." },
        { status: 400 }
      );
    }

    const [existingByUser, existingByPhone, existingByBusiness] = await Promise.all([
      DryCleaner.findOne({ userId }),
      DryCleaner.findOne({ phone: String(phone).trim() }),
      DryCleaner.findOne({ businessName: String(businessName).trim() }),
    ]);

    if (existingByUser) {
      return NextResponse.json(
        { error: "A dry cleaner application already exists for this account." },
        { status: 409 }
      );
    }

    if (existingByPhone) {
      return NextResponse.json(
        { error: "This phone number is already registered to another dry cleaner." },
        { status: 409 }
      );
    }

    if (existingByBusiness) {
      return NextResponse.json(
        { error: "This business name is already registered." },
        { status: 409 }
      );
    }

    const dryCleaner = await DryCleaner.create({
      userId,
      businessName: String(businessName).trim(),
      ownerName: String(ownerName).trim(),
      phone: String(phone).trim(),
      location: String(location).trim(),
      ...(businessLogo ? { businessLogo: String(businessLogo) } : {}),
      ...(businessLogoPublicId ? { businessLogoPublicId: String(businessLogoPublicId) } : {}),
      status: "pending",
      pricing: nextPricing,
      availability: {
        acceptingDays,
        expectedDeliveryDays: Math.min(
          Math.max(Math.round(toNumber(availability.expectedDeliveryDays, 2)), 1),
          14
        ),
        cutoffTime,
        temporarilyClosed: Boolean(availability.temporarilyClosed),
      },
    });

    await User.findByIdAndUpdate(userId, { dryCleanerId: dryCleaner._id.toString() });

    return NextResponse.json(
      {
        message: "Dry cleaner application submitted successfully.",
        dryCleaner: {
          id: dryCleaner._id,
          businessName: dryCleaner.businessName,
          status: dryCleaner.status,
          createdAt: dryCleaner.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/dry-cleaners]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
