export type RequiredProfileField = "name" | "phone" | "location";

export type AuthProfileUser = {
  role?: string | null;
  name?: string | null;
  phone?: string | null;
  location?: string | null;
  taskerId?: string | null;
};

export const COUNTRY_CODES = [
  { code: "NG", dial: "+234", flag: "🇳🇬" },
  { code: "US", dial: "+1", flag: "🇺🇸" },
  { code: "GB", dial: "+44", flag: "🇬🇧" },
  { code: "CA", dial: "+1", flag: "🇨🇦" },
  { code: "AU", dial: "+61", flag: "🇦🇺" },
  { code: "DE", dial: "+49", flag: "🇩🇪" },
  { code: "FR", dial: "+33", flag: "🇫🇷" },
  { code: "ES", dial: "+34", flag: "🇪🇸" },
] as const;

export type CountryCodeOption = (typeof COUNTRY_CODES)[number];

export const LOCATIONS = [
  { value: "", label: "Select your hostel / location", disabled: true },
  { value: "Amnesty", label: "Amnesty", disabled: false },
  { value: "Girls Hostel", label: "Girls Hostel", disabled: false },
  { value: "Law Hall", label: "Law Hall", disabled: false },
  { value: "Staff Quarters", label: "Staff Quarters", disabled: false },
] as const;

export const DEFAULT_COUNTRY_CODE: CountryCodeOption = COUNTRY_CODES[0];
export const COMPLETE_PROFILE_PATH = "/signup/complete-profile";

const hasText = (value?: string | null) => Boolean(value?.trim());

export function getMissingRequiredProfileFields(
  user?: AuthProfileUser | null
): RequiredProfileField[] {
  if (!user) {
    return [];
  }

  const missing: RequiredProfileField[] = [];

  if (!hasText(user.name)) {
    missing.push("name");
  }

  // Phone and location are required for the mobile-first user flow even when
  // Google does not provide them during social sign-up.
  if (user.role !== "admin") {
    if (!hasText(user.phone)) {
      missing.push("phone");
    }

    if (!hasText(user.location)) {
      missing.push("location");
    }
  }

  return missing;
}

export function isProfileComplete(user?: AuthProfileUser | null) {
  return getMissingRequiredProfileFields(user).length === 0;
}

export function getSignedInDestination(user?: AuthProfileUser | null) {
  return user?.role === "admin" ? "/admin" : "/dashboard";
}

export function getSafeNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return null;
  }

  if (nextPath.startsWith(COMPLETE_PROFILE_PATH)) {
    return null;
  }

  return nextPath;
}

export function buildCompleteProfilePath(nextPath?: string | null) {
  const safeNext = getSafeNextPath(nextPath);

  if (!safeNext) {
    return COMPLETE_PROFILE_PATH;
  }

  return `${COMPLETE_PROFILE_PATH}?next=${encodeURIComponent(safeNext)}`;
}

export function getPostProfileCompletionPath(
  user?: AuthProfileUser | null,
  nextPath?: string | null
) {
  return getSafeNextPath(nextPath) ?? getSignedInDestination(user);
}

export function getPostAuthRedirect(
  user?: AuthProfileUser | null,
  nextPath?: string | null
) {
  if (!user) {
    return "/login";
  }

  if (!isProfileComplete(user)) {
    return buildCompleteProfilePath(nextPath);
  }

  return getPostProfileCompletionPath(user, nextPath);
}

export function normalizePhoneNumber(dialCode: string, rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "");
  const dialDigits = dialCode.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith(dialDigits)) {
    return `+${digits}`;
  }

  return `${dialCode}${digits.replace(/^0+/, "")}`;
}
