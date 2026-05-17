import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { normalizeExcoRole } from "@/lib/exco-constants";
import DryCleaner from "@/models/dry-cleaner";

type DryCleanerPricing = {
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

type DryCleanerAvailability = {
  acceptingDays: string[];
  expectedDeliveryDays: number;
  cutoffTime: string;
  temporarilyClosed: boolean;
};

const VALID_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizePricing(value: Partial<DryCleanerPricing> | undefined) {
  if (!value) return null;

  const pricing = {
    shirt: numberValue(value.shirt),
    trouser: numberValue(value.trouser),
    hoodieMin: numberValue(value.hoodieMin),
    hoodieMax: numberValue(value.hoodieMax),
    bedsheetMin: numberValue(value.bedsheetMin),
    bedsheetMax: numberValue(value.bedsheetMax),
    duvetMin: numberValue(value.duvetMin),
    duvetMax: numberValue(value.duvetMax),
    underwear: numberValue(value.underwear),
    shoes: numberValue(value.shoes),
    doesNotWashShirt: value.doesNotWashShirt === true,
    doesNotWashTrouser: value.doesNotWashTrouser === true,
    doesNotWashHoodie: value.doesNotWashHoodie === true,
    doesNotWashBedsheet: value.doesNotWashBedsheet === true,
    doesNotWashDuvet: value.doesNotWashDuvet !== false,
    doesNotWashUnderwear: value.doesNotWashUnderwear !== false,
    doesNotWashShoes: value.doesNotWashShoes !== false,
  };

  if (Object.values(pricing).some((item) => item === null)) return null;
  if (Number(pricing.hoodieMin) > Number(pricing.hoodieMax)) return null;
  if (Number(pricing.bedsheetMin) > Number(pricing.bedsheetMax)) return null;
  if (Number(pricing.duvetMin) > Number(pricing.duvetMax)) return null;

  return pricing as DryCleanerPricing;
}

function normalizeAvailability(value: Partial<DryCleanerAvailability> | undefined) {
  if (!value) return null;

  const acceptingDays = Array.isArray(value.acceptingDays)
    ? [...new Set(value.acceptingDays.map((day) => String(day).toLowerCase()))].filter((day) =>
        VALID_DAYS.includes(day)
      )
    : [];

  const expectedDeliveryDays = Math.round(Number(value.expectedDeliveryDays));
  const cutoffTime = String(value.cutoffTime || "");

  if (acceptingDays.length === 0 || !Number.isFinite(expectedDeliveryDays)) return null;
  if (expectedDeliveryDays < 1 || expectedDeliveryDays > 14) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoffTime)) return null;

  return {
    acceptingDays,
    expectedDeliveryDays,
    cutoffTime,
    temporarilyClosed: Boolean(value.temporarilyClosed),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const excoRole = normalizeExcoRole(
      (session?.user as { excoRole?: string | null } | undefined)?.excoRole
    );

    if (!session?.user || (session.user.role !== "admin" && excoRole !== "COO")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const body = await req.json();
    const { action, pricing, availability } = body as {
      action?: string;
      pricing?: Partial<DryCleanerPricing>;
      availability?: Partial<DryCleanerAvailability>;
    };

    if (
      action !== undefined &&
      !["approve", "reject", "reopen", "close"].includes(action)
    ) {
      return NextResponse.json(
        { error: 'action must be "approve", "reject", "reopen", or "close".' },
        { status: 400 }
      );
    }

    const nextPricing = pricing === undefined ? undefined : normalizePricing(pricing);
    const nextAvailability =
      availability === undefined ? undefined : normalizeAvailability(availability);

    if (pricing !== undefined && !nextPricing) {
      return NextResponse.json({ error: "Provide valid dry cleaner prices." }, { status: 400 });
    }

    if (availability !== undefined && !nextAvailability) {
      return NextResponse.json(
        { error: "Provide valid availability days, cutoff time, and delivery days." },
        { status: 400 }
      );
    }

    if (action === undefined && !nextPricing && !nextAvailability) {
      return NextResponse.json(
        { error: "Provide an action, pricing, or availability update." },
        { status: 400 }
      );
    }

    const dryCleaner = await DryCleaner.findById(id);
    if (!dryCleaner) {
      return NextResponse.json({ error: "Dry cleaner not found." }, { status: 404 });
    }

    if (action === "approve") dryCleaner.status = "approved";
    if (action === "reject") dryCleaner.status = "rejected";
    if (action === "close") dryCleaner.availability.temporarilyClosed = true;
    if (action === "reopen") dryCleaner.availability.temporarilyClosed = false;
    if (nextPricing) dryCleaner.pricing = nextPricing;
    if (nextAvailability) dryCleaner.availability = nextAvailability;

    await dryCleaner.save();

    return NextResponse.json({
      message: "Dry cleaner updated successfully.",
      dryCleaner: {
        id: dryCleaner._id,
        status: dryCleaner.status,
        pricing: dryCleaner.pricing,
        availability: dryCleaner.availability,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/admin/dry-cleaners/[id]]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
