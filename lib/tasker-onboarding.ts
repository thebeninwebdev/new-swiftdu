import "server-only";

import { createElement } from "react";

import Tasker, { type ITasker } from "@/models/tasker";
import { User } from "@/models/user";
import { connectDB } from "@/lib/db";
import { normalizeEmail } from "@/lib/email-normalization";
import { sendTransactionalEmail } from "@/lib/email";
import { getEmailSiteUrl } from "@/lib/email-config";
import TaskerApprovalEmail from "@/emails/taskerApprovalEmail";

export const TASKER_ONBOARDING_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

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

export async function issueTaskerOnboardingLink(tasker: ITasker) {
  const now = new Date();
  const { email, name } = await getTaskerIdentity(tasker);
  if (!email) return { sent: false, reason: "missing-email" as const };

  if (!tasker.userId) {
    const existingUser = await User.findOne({ email }).select("_id role");
    if (existingUser && existingUser.role !== "admin") {
      await completeTaskerAccountLink(tasker, existingUser.id);
    }
  }

  const onboardingUrl = new URL("/tasker-dashboard", getEmailSiteUrl()).toString();

  const reservation = await Tasker.updateOne(
    {
      _id: tasker._id,
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
        onboardingEmailSentAt: now,
      },
    }
  );

  if (reservation.modifiedCount !== 1) {
    return { sent: false, reason: "cooldown" as const };
  }

  try {
    await sendTransactionalEmail({
      to: email,
      subject: "Your SwiftDU Tasker account is ready",
      react: createElement(TaskerApprovalEmail, {
        name,
        onboardingUrl,
      }),
      tags: [
        { name: "email_type", value: "tasker_approval" },
        { name: "auth_flow", value: "tasker_dashboard" },
      ],
    });
    return { sent: true, reason: "sent" as const };
  } catch (error) {
    // Do not leave a usable link in the database when delivery failed.
    await Tasker.updateOne(
      { _id: tasker._id, onboardingEmailSentAt: now },
      {
        $unset: { onboardingEmailSentAt: 1 },
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
        taskerMode: tasker.taskerMode || "training",
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

  return { userId: user.id, taskerId: tasker._id.toString() };
}
