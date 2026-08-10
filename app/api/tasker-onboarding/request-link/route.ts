import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { isValidEmail, normalizeEmail } from "@/lib/email-normalization";
import {
  getCredentialProviders,
  issueTaskerOnboardingLink,
} from "@/lib/tasker-onboarding";
import Tasker from "@/models/tasker";
import { User } from "@/models/user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    if (!isValidEmail(email)) {
      return NextResponse.json({ activationRequired: false });
    }

    await connectDB();
    const tasker = await Tasker.findOne({
      email,
      isVerified: true,
      isRejected: { $ne: true },
      accountLinkedAt: { $exists: false },
    }).select(
      "+onboardingTokenHash +onboardingTokenExpiresAt +onboardingEmailSentAt +onboardingTokenUsedAt"
    );

    if (!tasker) {
      const user = await User.findOne({ email }).select("_id").lean();
      if (!user) {
        return NextResponse.json({ activationRequired: false, nextAction: "signup" });
      }

      const providers = await getCredentialProviders(user._id.toString());
      return NextResponse.json({
        activationRequired: false,
        nextAction:
          providers.hasGoogle && !providers.hasCredential ? "google" : "login",
      });
    }

    try {
      await issueTaskerOnboardingLink(tasker);
    } catch (error) {
      console.error("[Tasker activation link request] email failed", error);
      return NextResponse.json(
        { activationRequired: true, emailSent: false },
        { status: 503 }
      );
    }

    return NextResponse.json({ activationRequired: true, emailSent: true });
  } catch (error) {
    console.error("[Tasker activation link request]", error);
    return NextResponse.json(
      { error: "We could not check activation status right now." },
      { status: 500 }
    );
  }
}
