import { getSafeContinuationReference } from "@/lib/auth-continuation-reference";

export function buildAuthContinuationPath(
  reference?: string | null,
  options: { newUser?: boolean } = {},
) {
  const params = new URLSearchParams();
  const safeReference = getSafeContinuationReference(reference);
  if (safeReference) params.set("continuation", safeReference);
  if (options.newUser) params.set("new", "1");
  const query = params.toString();
  return query ? `/auth/continue?${query}` : "/auth/continue";
}

export function buildAuthErrorPath(
  reference?: string | null,
  options: { magicLink?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (options.magicLink) params.set("magicLinkError", "true");
  const safeReference = getSafeContinuationReference(reference);
  if (safeReference) params.set("continuation", safeReference);
  const query = params.toString();
  return query ? `/auth?${query}` : "/auth";
}

export function buildAuthCallbackPaths(
  reference?: string | null,
  options: { magicLink?: boolean } = {},
) {
  return {
    callbackURL: buildAuthContinuationPath(reference),
    newUserCallbackURL: buildAuthContinuationPath(reference, { newUser: true }),
    errorCallbackURL: buildAuthErrorPath(reference, options),
  };
}
