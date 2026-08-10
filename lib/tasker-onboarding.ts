import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createElement } from "react";
import { ObjectId } from "mongodb";

import Tasker, { type ITasker } from "@/models/tasker";
import { User } from "@/models/user";
import clientPromise, { connectDB } from "@/lib/db";
import { normalizeEmail } from "@/lib/email-normalization";
import { sendTransactionalEmail } from "@/lib/email";
import { getEmailSiteUrl } from "@/lib/email-config";
import TaskerApprovalEmail from "@/emails/taskerApprovalEmail";

export const TASKER_ONBOARDING_TOKEN_TTL_HOURS = 48;
export const TASKER_ONBOARDING_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

export type TaskerOnboardingState =
  | "ready"
  | "expired"
  | "used"
  | "invalid"
  | "not-approved";

function hashOnboardingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newOnboardingToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashOnboardingToken(token),
    expiresAt: new Date(
      Date.now() + TASKER_ONBOARDING_TOKEN_TTL_HOURS * 60 * 60 * 1000
    ),
  };
}

function getUserIdConditions(userId: string) {
  const conditions: Record<string, unknown>[] = [{ userId }];
  if (ObjectId.isValid(userId)) conditions.push({ userId: new ObjectId(userId) });
  return conditions;
}

export async function getCredentialProviders(userId: string) {
  const client = await clientPromise;
  const accounts = await client
    .db()
    .collection("account")
    .find(
      { $or: getUserIdConditions(userId) },
      { projection: { providerId: 1, password: 1 } }
    )
    .toArray();

  return {
    hasCredential: accounts.some(
      (account) =>
        account.providerId === "credential" &&
        typeof account.password === "string" &&
        account.password.length > 0
    ),
    hasGoogle: accounts.some((account) => account.providerId === "google"),
  };
}

export async function getTaskerOnboardingByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    return { state: "invalid" as const, tasker: null };
  }

  await connectDB();
  const tasker = await Tasker.findOne({
    onboardingTokenHash: hashOnboardingToken(token),
  }).select(
    "+onboardingTokenHash +onboardingTokenExpiresAt +onboardingEmailSentAt +onboardingTokenUsedAt"
  );

  if (!tasker) return { state: "invalid" as const, tasker: null };
  if (tasker.onboardingTokenUsedAt || tasker.accountLinkedAt) {
    return { state: "used" as const, tasker };
  }
  if (!tasker.isVerified || tasker.isRejected) {
    return { state: "not-approved" as const, tasker };
  }
  if (
    !tasker.onboardingTokenExpiresAt ||
    tasker.onboardingTokenExpiresAt.getTime() <= Date.now()
  ) {
    return { state: "expired" as const, tasker };
  }

  return { state: "ready" as const, tasker };
}

async function getTaskerIdentity(tasker: ITasker) {
  const linkedUser = tasker.userId
    ? await User.findById(tasker.userId).select("name email").lean()
    : null;
  const email = normalizeEmail(tasker.email || linkedUser?.email);
  const name = String(
    tasker.firstName || tasker.fullName || linkedUser?.name || "there"
  )
    .trim()
    .split(/\s+/)[0];
  return { email, name };
}

export async function issueTaskerOnboardingLink(
  tasker: ITasker
) {
  const now = new Date();
  const { email, name } = await getTaskerIdentity(tasker);
  if (!email) return { sent: false, reason: "missing-email" as const };

  const { token, tokenHash, expiresAt } = newOnboardingToken();
  const onboardingUrl = new URL("/tasker/onboarding", getEmailSiteUrl());
  onboardingUrl.searchParams.set("token", token);

  const reservation = await Tasker.updateOne(
    {
      _id: tasker._id,
      accountLinkedAt: { $exists: false },
      $or: [
        { onboardingEmailSentAt: { $exists: false } },
        {
          onboardingEmailSentAt: {
            $lte: new Date(now.getTime() - TASKER_ONBOARDING_RESEND_COOLDOWN_MS),
          },
        },
      ],
    },
    {
      $set: {
        onboardingTokenHash: tokenHash,
        onboardingTokenExpiresAt: expiresAt,
        onboardingEmailSentAt: now,
      },
      $unset: { onboardingTokenUsedAt: 1 },
    }
  );

  if (reservation.modifiedCount !== 1) {
    return { sent: false, reason: "cooldown" as const };
  }

  try {
    await sendTransactionalEmail({
      to: email,
      subject: "Continue your SwiftDU Tasker onboarding",
      react: createElement(TaskerApprovalEmail, {
        name,
        onboardingUrl: onboardingUrl.toString(),
        expiresInHours: TASKER_ONBOARDING_TOKEN_TTL_HOURS,
      }),
      tags: [
        { name: "email_type", value: "tasker_approval" },
        { name: "auth_flow", value: "tasker_onboarding" },
      ],
    });
    return { sent: true, reason: "sent" as const };
  } catch (error) {
    // Do not leave a usable link in the database when delivery failed.
    await Tasker.updateOne(
      { _id: tasker._id, onboardingTokenHash: tokenHash },
      {
        $unset: {
          onboardingTokenHash: 1,
          onboardingTokenExpiresAt: 1,
          onboardingEmailSentAt: 1,
        },
      }
    );
    throw error;
  }
}

export async function completeTaskerAccountLink(
  tasker: ITasker,
  userId: string
) {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) throw new Error("ACCOUNT_NOT_FOUND");

  const applicationEmail = normalizeEmail(tasker.email);
  if (!applicationEmail || normalizeEmail(user.email) !== applicationEmail) {
    throw new Error("EMAIL_MISMATCH");
  }

  if (tasker.userId && tasker.userId.toString() !== user.id) {
    throw new Error("APPLICATION_ALREADY_LINKED");
  }

  if (
    user.taskerId &&
    user.taskerId.toString() !== tasker._id.toString() &&
    user.role === "tasker"
  ) {
    throw new Error("ACCOUNT_ALREADY_TASKER");
  }

  const anotherProfile = await Tasker.findOne({
    _id: { $ne: tasker._id },
    userId: user._id,
  }).select("_id");
  if (anotherProfile) throw new Error("ACCOUNT_ALREADY_LINKED");

  const linkedAt = tasker.accountLinkedAt || new Date();
  await Tasker.updateOne(
    {
      _id: tasker._id,
      $or: [{ userId: { $exists: false } }, { userId: null }, { userId: user._id }],
    },
    {
      $set: {
        userId: user._id,
        accountLinkedAt: linkedAt,
        taskerMode: "training",
      },
    }
  );

  const userUpdates: Record<string, unknown> = {
    role: "tasker",
    taskerId: tasker._id.toString(),
  };
  if (!user.phone && tasker.phone) userUpdates.phone = tasker.phone;
  if (!user.location && tasker.location) userUpdates.location = tasker.location;
  if (!user.name?.trim() && tasker.fullName) userUpdates.name = tasker.fullName;

  await User.updateOne(
    { _id: user._id, email: user.email },
    { $set: userUpdates }
  );

  await Tasker.updateOne(
    { _id: tasker._id, userId: user._id },
    {
      $set: { onboardingTokenUsedAt: new Date() },
      $unset: { onboardingTokenExpiresAt: 1 },
    }
  );

  return { userId: user.id, taskerId: tasker._id.toString() };
}
