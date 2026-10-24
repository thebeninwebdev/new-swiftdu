import "server-only";

import { createElement } from "react";
import { Types } from "mongoose";

import Tasker, { type ITasker } from "@/models/tasker";
import { User } from "@/models/user";
import { connectDB } from "@/lib/db";
import { normalizeEmail } from "@/lib/email-normalization";
import { sendTransactionalEmail } from "@/lib/email";
import { getEmailSiteUrl } from "@/lib/email-config";
import TaskerApprovalEmail from "@/emails/taskerApprovalEmail";

export const TASKER_ONBOARDING_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

export type TaskerAccountLinkErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "EMAIL_MISMATCH"
  | "APPLICATION_ALREADY_LINKED"
  | "ACCOUNT_ALREADY_TASKER"
  | "ACCOUNT_ALREADY_LINKED"
  | "ADMIN_ACCOUNT"
  | "TASKER_ACCOUNT_LINK_CONFLICT"
  | "TASKER_EMAIL_DUPLICATE";

function accountLinkError(code: TaskerAccountLinkErrorCode) {
  return new Error(code);
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

export async function issueTaskerOnboardingLink(tasker: ITasker) {
  const now = new Date();
  const { email, name } = await getTaskerIdentity(tasker);
  if (!email) return { sent: false, reason: "missing-email" as const };

  await synchronizeTaskerAccountLink(tasker);

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
  if (!user) throw accountLinkError("ACCOUNT_NOT_FOUND");

  const applicationEmail = normalizeEmail(tasker.email);
  if (!applicationEmail || normalizeEmail(user.email) !== applicationEmail) {
    throw accountLinkError("EMAIL_MISMATCH");
  }

  if (user.role === "admin") throw accountLinkError("ADMIN_ACCOUNT");

  if (tasker.userId && tasker.userId.toString() !== user.id) {
    throw accountLinkError("APPLICATION_ALREADY_LINKED");
  }

  if (user.taskerId && user.taskerId.toString() !== tasker._id.toString()) {
    throw accountLinkError("TASKER_ACCOUNT_LINK_CONFLICT");
  }

  const anotherProfile = await Tasker.findOne({
    _id: { $ne: tasker._id },
    userId: user._id,
  }).select("_id");
  if (anotherProfile) throw accountLinkError("TASKER_ACCOUNT_LINK_CONFLICT");

  const alreadyLinked =
    tasker.userId?.toString() === user.id &&
    user.role === "tasker" &&
    user.taskerId?.toString() === tasker._id.toString();
  if (alreadyLinked) return { userId: user.id, taskerId: tasker._id.toString() };

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

/**
 * Repairs only an unambiguous relationship: an existing Tasker.userId or a
 * single existing user with the application's normalized email. It never
 * creates a user or replaces a different tasker relationship.
 */
export async function synchronizeTaskerAccountLink(tasker: ITasker) {
  await connectDB();

  if (tasker.userId) {
    const linkedUser = await User.findById(tasker.userId).select("_id email").lean();
    if (!linkedUser) throw accountLinkError("ACCOUNT_NOT_FOUND");
    return completeTaskerAccountLink(tasker, String(linkedUser._id));
  }

  const email = normalizeEmail(tasker.email);
  if (!email) return null;
  const matchingUser = await User.findOne({ email }).select("_id").lean();
  if (!matchingUser) return null;

  return completeTaskerAccountLink(tasker, String(matchingUser._id));
}

/**
 * Reconciles an authenticated user's existing Tasker application. Pending and
 * approved and rejected applications are linked; rejected applications remain
 * blocked by the existing reapplication path after linking.
 */
export async function reconcileTaskerIdentityForUser(userId: string) {
  await connectDB();
  const user = await User.findById(userId).select("_id email taskerId role").lean();
  if (!user) return null;
  if (user.role === "admin") return null;

  const candidates: Record<string, unknown>[] = [{ userId: user._id }];
  if (user.taskerId && Types.ObjectId.isValid(String(user.taskerId))) {
    candidates.push({ _id: user.taskerId, $or: [{ userId: null }, { userId: { $exists: false } }, { userId: user._id }] });
  }

  let tasker = await Tasker.findOne({ $or: candidates });
  if (!tasker && user.taskerId) {
    // A user claiming a different profile is never repaired automatically.
    throw accountLinkError("TASKER_ACCOUNT_LINK_CONFLICT");
  }

  if (!tasker) {
    const email = normalizeEmail(user.email);
    if (!email) return null;
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const applications = (await Tasker.find({
      email: { $regex: `^${escapedEmail}$`, $options: "i" },
    }).limit(3)).filter((application) => normalizeEmail(application.email) === email);
    if (applications.length > 1) throw accountLinkError("TASKER_EMAIL_DUPLICATE");
    tasker = applications[0] || null;
    if (tasker?.userId && String(tasker.userId) !== String(user._id)) {
      throw accountLinkError("TASKER_ACCOUNT_LINK_CONFLICT");
    }
  }
  if (!tasker) return null;

  return completeTaskerAccountLink(tasker, String(user._id));
}
