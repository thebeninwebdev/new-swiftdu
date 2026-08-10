import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/email-normalization";
import {
  completeTaskerAccountLink,
  getCredentialProviders,
  getTaskerOnboardingByToken,
} from "@/lib/tasker-onboarding";
import { User } from "@/models/user";

function stateMessage(state: string) {
  if (state === "expired") return "This onboarding link has expired. Request a new link to continue.";
  if (state === "used") return "This onboarding link has already been used.";
  if (state === "not-approved") return "This Tasker application is not available for onboarding.";
  return "This onboarding link is invalid.";
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const responses: Record<string, { status: number; message: string }> = {
    EMAIL_MISMATCH: {
      status: 403,
      message: "The signed-in account does not match this Tasker application.",
    },
    APPLICATION_ALREADY_LINKED: {
      status: 409,
      message: "This Tasker application is already linked to another account.",
    },
    ACCOUNT_ALREADY_LINKED: {
      status: 409,
      message: "This account is already connected to another Tasker profile.",
    },
    ACCOUNT_ALREADY_TASKER: {
      status: 409,
      message: "This account already has an active Tasker profile.",
    },
    ACCOUNT_NOT_FOUND: {
      status: 404,
      message: "We could not find that SwiftDU account.",
    },
  };
  const response = responses[code];
  if (response) {
    return NextResponse.json({ error: response.message, code }, { status: response.status });
  }
  console.error("[Tasker onboarding]", error);
  return NextResponse.json(
    { error: "We could not complete Tasker onboarding right now. Please try again." },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") || "";
    const result = await getTaskerOnboardingByToken(token);
    if (result.state !== "ready" || !result.tasker) {
      return NextResponse.json(
        { state: result.state, error: stateMessage(result.state) },
        { status: result.state === "invalid" ? 404 : 410 }
      );
    }

    const applicationEmail = normalizeEmail(result.tasker.email);
    const user = applicationEmail
      ? await User.findOne({ email: applicationEmail }).select("_id email").lean()
      : null;
    const providers = user
      ? await getCredentialProviders(user._id.toString())
      : { hasCredential: false, hasGoogle: false };
    const session = await auth.api.getSession({ headers: request.headers });
    const sessionEmail = normalizeEmail(session?.user?.email);

    return NextResponse.json({
      state: "ready",
      applicant: {
        name: result.tasker.fullName || "Tasker applicant",
        email: applicationEmail,
      },
      account: user
        ? {
            exists: true,
            hasCredential: providers.hasCredential,
            hasGoogle: providers.hasGoogle,
          }
        : { exists: false, hasCredential: false, hasGoogle: false },
      session: session?.user
        ? {
            authenticated: true,
            matches: sessionEmail === applicationEmail,
            email: sessionEmail,
          }
        : { authenticated: false, matches: false },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    const action = typeof body?.action === "string" ? body.action : "";
    const result = await getTaskerOnboardingByToken(token);

    if (result.state !== "ready" || !result.tasker) {
      return NextResponse.json(
        { state: result.state, error: stateMessage(result.state) },
        { status: result.state === "invalid" ? 404 : 410 }
      );
    }

    if (action === "complete-existing") {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Sign in to the matching SwiftDU account first.", code: "AUTH_REQUIRED" },
          { status: 401 }
        );
      }

      const link = await completeTaskerAccountLink(result.tasker, session.user.id);
      return NextResponse.json({ ok: true, ...link, redirectTo: "/tasker-dashboard" });
    }

    if (action === "create-password") {
      const password = typeof body?.password === "string" ? body.password : "";
      if (password.length < 8 || password.length > 128) {
        return NextResponse.json(
          { error: "Use a password between 8 and 128 characters." },
          { status: 400 }
        );
      }

      const email = normalizeEmail(result.tasker.email);
      const existingUser = await User.findOne({ email }).select("_id").lean();
      if (existingUser) {
        return NextResponse.json(
          {
            error: "A SwiftDU account already exists for this application. Sign in instead.",
            code: "ACCOUNT_EXISTS",
          },
          { status: 409 }
        );
      }

      const signup = await auth.api.signUpEmail({
        headers: request.headers,
        body: {
          name: String(result.tasker.fullName || "SwiftDU Tasker").trim(),
          email,
          password,
          phone: result.tasker.phone,
          location: result.tasker.location,
        },
      });

      // Better Auth returns a synthetic success for duplicate signups when email
      // verification is required. Verify the persisted user and credential before linking.
      const persistedUser = await User.findOne({ email });
      if (!persistedUser || persistedUser.id !== signup.user.id) {
        return NextResponse.json(
          {
            error: "A SwiftDU account already exists for this application. Sign in instead.",
            code: "ACCOUNT_EXISTS",
          },
          { status: 409 }
        );
      }

      const providers = await getCredentialProviders(persistedUser.id);
      if (!providers.hasCredential) {
        throw new Error("CREDENTIAL_NOT_CREATED");
      }

      // Possession of the single-purpose link proves control of the approval email.
      persistedUser.emailVerified = true;
      await persistedUser.save();
      const link = await completeTaskerAccountLink(result.tasker, persistedUser.id);

      return NextResponse.json({
        ok: true,
        ...link,
        email,
        redirectTo: "/tasker-dashboard",
      });
    }

    return NextResponse.json({ error: "Invalid onboarding action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
