import { createHash, randomBytes } from "node:crypto";
import { getSafeContinuationReference } from "@/lib/auth-continuation-reference";
import { connectDB } from "@/lib/db";
import { getSafeNextPath } from "@/lib/profile-completion";
import { AuthContinuation } from "@/models/auth-continuation";

export const AUTH_CONTINUATION_TTL_MS = 15 * 60 * 1000;

function hashReference(reference: string) {
  return createHash("sha256").update(reference).digest("hex");
}

export async function createAuthContinuation(nextPath?: string | null) {
  const destination = getSafeNextPath(nextPath);
  if (!destination) return null;

  await connectDB();
  const reference = randomBytes(24).toString("base64url");
  await AuthContinuation.create({
    referenceHash: hashReference(reference),
    destination,
    expiresAt: new Date(Date.now() + AUTH_CONTINUATION_TTL_MS),
  });
  return reference;
}

export async function resolveAuthContinuation(
  value?: string | null,
  options: { consume?: boolean; now?: Date } = {},
) {
  const reference = getSafeContinuationReference(value);
  if (!reference) return null;

  await connectDB();
  const now = options.now ?? new Date();
  const filter = {
    referenceHash: hashReference(reference),
    expiresAt: { $gt: now },
  };
  const record = options.consume
    ? await AuthContinuation.findOneAndDelete(filter).lean()
    : await AuthContinuation.findOne(filter).lean();

  return getSafeNextPath(record?.destination);
}
