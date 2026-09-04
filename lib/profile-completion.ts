export type RequiredProfileField = "name" | "gender" | "phone" | "defaultLocation";
export type AuthProfileUser = { role?: string | null; name?: string | null; email?: string | null; phone?: string | null; location?: string | null; defaultLocation?: string | null; profileImage?: string | null; gender?: string | null; birthdayDay?: number | null; birthdayMonth?: number | null; dateOfBirth?: string | Date | null; taskerId?: string | null };
export const LOCATIONS = ["Amnesty", "Girls Hostel", "Law Hall", "Staff Quarters"] as const;
export const COMPLETE_PROFILE_PATH = "/complete-profile";
const hasText = (value?: string | null) => Boolean(value?.trim());
export function getDefaultLocation(user?: AuthProfileUser | null) { return user?.defaultLocation?.trim() || user?.location?.trim() || ""; }
export function getMissingRequiredProfileFields(user?: AuthProfileUser | null): RequiredProfileField[] {
  if (!user) return [];
  const missing: RequiredProfileField[] = [];
  if (!hasText(user.name)) missing.push("name");
  if (!hasText(user.gender)) missing.push("gender");
  if (!hasText(user.phone)) missing.push("phone");
  if (!getDefaultLocation(user)) missing.push("defaultLocation");
  return missing;
}
export function isProfileComplete(user?: AuthProfileUser | null) { return getMissingRequiredProfileFields(user).length === 0; }
export function getProfileCompletion(user?: AuthProfileUser | null) {
  const fields: Array<{ field: RequiredProfileField; label: string }> = [{ field: "name", label: "Full name" }, { field: "gender", label: "Gender" }, { field: "phone", label: "WhatsApp number" }, { field: "defaultLocation", label: "Default location" }];
  const missingNames = new Set(getMissingRequiredProfileFields(user));
  const missingFields = fields.filter(({ field }) => missingNames.has(field));
  return { completedFields: fields.length - missingFields.length, totalFields: fields.length, percentage: Math.round(((fields.length - missingFields.length) / fields.length) * 100), missingFields };
}
export function getSignedInDestination(user?: AuthProfileUser | null) { if (user?.role === "admin") return "/admin"; if (user?.role === "tasker") return "/tasker-dashboard"; return "/dashboard"; }
export function getSafeNextPath(nextPath?: string | null) { if (!nextPath?.startsWith("/") || nextPath.startsWith("//") || nextPath.startsWith(COMPLETE_PROFILE_PATH)) return null; return nextPath; }
export function buildCompleteProfilePath(nextPath?: string | null) { const safe = getSafeNextPath(nextPath); return safe ? `${COMPLETE_PROFILE_PATH}?next=${encodeURIComponent(safe)}` : COMPLETE_PROFILE_PATH; }
export function getPostProfileCompletionPath(user?: AuthProfileUser | null, nextPath?: string | null) { return getSafeNextPath(nextPath) ?? getSignedInDestination(user); }
export function getPostAuthRedirect(user?: AuthProfileUser | null, nextPath?: string | null) { if (!user) return "/login"; return isProfileComplete(user) ? getPostProfileCompletionPath(user, nextPath) : buildCompleteProfilePath(nextPath); }
export function normalizePhoneNumber(_dialCode: string, rawPhone: string) { const digits = rawPhone.replace(/\D/g, "").replace(/^0+/, ""); if (!digits) return ""; return digits.startsWith("234") ? `+${digits}` : `+234${digits}`; }
export function isValidBirthday(day?: number | null, month?: number | null) { if (day == null && month == null) return true; if (!Number.isInteger(day) || !Number.isInteger(month) || !day || !month) return false; return day <= new Date(Date.UTC(2024, month, 0)).getUTCDate(); }
