import { getSafeNextPath } from "@/lib/profile-completion";

const RETURN_KEYS = ["next", "callbackUrl", "callbackURL", "redirect"] as const;
const ERROR_KEYS = ["error", "error_description", "magicLinkError"] as const;

export function getLegacyAuthRedirect(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  const requestedPath = RETURN_KEYS.map((key) => first(searchParams[key])).map(getSafeNextPath).find(Boolean);
  if (requestedPath) params.set("next", requestedPath);

  for (const key of ERROR_KEYS) {
    const value = first(searchParams[key]);
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `/auth?${query}` : "/auth";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
