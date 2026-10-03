import {
  APPROVAL_CONFIDENCE,
  BUSINESS_CATEGORIES,
  PROHIBITED_FLAGS,
} from "./business-directory-policy";

export function normalizeBusinessName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function normalizePhoneNumber(value: string) {
  if (!/^[+\d\s()-]+$/.test(value)) return "";
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "234" + digits.slice(1);
  return /^234[789]\d{9}$/.test(digits) ? digits : "";
}
export function normalizeInstagramHandle(value: string) {
  let handle = value.trim().toLowerCase();
  if (/^https?:\/\//.test(handle)) {
    try {
      const url = new URL(handle);
      if (!["instagram.com", "www.instagram.com"].includes(url.hostname))
        return "";
      handle = url.pathname.replace(/^\/|\/$/g, "");
    } catch {
      return "";
    }
  }
  handle = handle.replace(/^@/, "");
  return /^[a-z0-9._]{1,30}$/.test(handle) &&
    !["p", "reel", "explore", "accounts"].includes(handle)
    ? handle
    : "";
}
export function createBusinessSlug(name: string, suffix: string) {
  return `${normalizeBusinessName(name).replace(/\s+/g, "-").slice(0, 80)}-${suffix}`;
}
export function calculateNameSimilarity(a: string, b: string) {
  const left = normalizeBusinessName(a).replace(/\s/g, "");
  const right = normalizeBusinessName(b).replace(/\s/g, "");
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let i = 0; i < left.length - 1; i++) {
    const p = left.slice(i, i + 2);
    pairs.set(p, (pairs.get(p) ?? 0) + 1);
  }
  let matches = 0;
  for (let i = 0; i < right.length - 1; i++) {
    const p = right.slice(i, i + 2);
    const n = pairs.get(p) ?? 0;
    if (n) {
      matches++;
      pairs.set(p, n - 1);
    }
  }
  return (2 * matches) / (left.length + right.length - 2);
}
export function fuzzyDuplicateLevel(a: string, b: string) {
  const score = calculateNameSimilarity(a, b);
  return score >= 0.94
    ? "duplicate"
    : score >= 0.55
      ? "candidate"
      : "different";
}
export interface BusinessInput {
  businessName: string;
  ownerName: string;
  description: string;
  productsServices: string[];
  category: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  location: string;
  normalizedBusinessName: string;
  normalizedPhone: string;
  normalizedWhatsapp: string;
  normalizedInstagram?: string | null;
}
export function validateBusinessInput(form: FormData): BusinessInput {
  const read = (key: string, max: number, min = 0) => {
    const raw = form.get(key);
    if (raw !== null && typeof raw !== "string")
      throw new Error(`Invalid ${key}.`);
    const value = (raw ?? "").trim();
    if (
      value.length > max ||
      value.length < min ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    )
      throw new Error(`Please check ${key} (${min}–${max} characters).`);
    return value;
  };
  if (read("website", 200))
    throw new Error("Unable to accept this submission.");
  const businessName = read("businessName", 80, 2),
    ownerName = read("ownerName", 80, 2),
    description = read("description", 400, 15);
  if (![businessName, ownerName, description].every((v) => /\p{L}{2}/u.test(v)))
    throw new Error("Please enter meaningful business details.");
  const productsServices = read("productsServices", 1000, 2)
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (
    !productsServices.length ||
    productsServices.length > 12 ||
    productsServices.some((v) => v.length > 80 || !/\p{L}/u.test(v))
  )
    throw new Error("Add 1–12 products/services, up to 80 characters each.");
  const phone = normalizePhoneNumber(read("phone", 30, 1)),
    whatsapp = normalizePhoneNumber(read("whatsapp", 30, 1));
  if (!phone || !whatsapp)
    throw new Error("Enter valid Nigerian phone and WhatsApp numbers.");
  const email = read("email", 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  const rawInstagram = read("instagram", 160),
    instagram = normalizeInstagramHandle(rawInstagram);
  if (rawInstagram && !instagram)
    throw new Error("Enter a valid Instagram handle or profile URL.");
  const category = read("category", 60) || "Other";
  if (!(BUSINESS_CATEGORIES as readonly string[]).includes(category))
    throw new Error("Select a directory category.");
  return {
    businessName,
    ownerName,
    description,
    productsServices,
    category,
    phone,
    whatsapp,
    email,
    instagram,
    location: read("location", 120),
    normalizedBusinessName: normalizeBusinessName(businessName),
    normalizedPhone: phone,
    normalizedWhatsapp: whatsapp,
    ...(instagram ? { normalizedInstagram: instagram } : {}),
  };
}
export type DuplicateFields = Pick<
  BusinessInput,
  | "normalizedBusinessName"
  | "normalizedPhone"
  | "normalizedWhatsapp"
  | "normalizedInstagram"
>;
export function exactDuplicateReason(
  input: DuplicateFields,
  existing: DuplicateFields,
) {
  if (input.normalizedBusinessName === existing.normalizedBusinessName)
    return "This business name has already been submitted.";
  const contacts = [existing.normalizedPhone, existing.normalizedWhatsapp];
  if (contacts.includes(input.normalizedWhatsapp))
    return "The WhatsApp number is already connected to another business.";
  if (contacts.includes(input.normalizedPhone))
    return "The phone number is already connected to another business.";
  if (
    input.normalizedInstagram &&
    input.normalizedInstagram === existing.normalizedInstagram
  )
    return "The Instagram account is already connected to another business.";
  return null;
}
export interface BusinessAIReview {
  decision: "approve" | "reject" | "review";
  confidence: number;
  appearsGenuine: boolean;
  imageRelevant: boolean;
  imageSafe: boolean;
  category: string;
  reasons: string[];
  flags: string[];
  duplicateCandidateId: string | null;
  duplicateConfidence: number;
  duplicateDecision: "not_duplicate" | "likely_duplicate" | "uncertain";
}
export function parseBusinessAIReview(
  value: unknown,
  candidateIds: string[],
): BusinessAIReview | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    !["approve", "reject", "review"].includes(String(v.decision)) ||
    !["not_duplicate", "likely_duplicate", "uncertain"].includes(
      String(v.duplicateDecision),
    )
  )
    return null;
  if (
    !["confidence", "duplicateConfidence"].every(
      (k) =>
        typeof v[k] === "number" &&
        Number.isFinite(v[k]) &&
        Number(v[k]) >= 0 &&
        Number(v[k]) <= 1,
    )
  )
    return null;
  if (
    !["appearsGenuine", "imageRelevant", "imageSafe"].every(
      (k) => typeof v[k] === "boolean",
    )
  )
    return null;
  if (!(BUSINESS_CATEGORIES as readonly unknown[]).includes(v.category))
    return null;
  if (
    !["reasons", "flags"].every(
      (k) =>
        Array.isArray(v[k]) &&
        v[k].length <= 12 &&
        v[k].every((s: unknown) => typeof s === "string" && s.length <= 200),
    )
  )
    return null;
  if (
    v.duplicateCandidateId !== null &&
    typeof v.duplicateCandidateId !== "string"
  )
    return null;
  const result = { ...v } as unknown as BusinessAIReview;
  if (
    result.duplicateCandidateId &&
    !candidateIds.includes(result.duplicateCandidateId)
  )
    result.duplicateCandidateId = null;
  return result;
}
export function decideBusinessReview(review: BusinessAIReview | null) {
  if (!review) return "unavailable";
  if (
    (!review.imageSafe ||
      review.flags.some((f) =>
        (PROHIBITED_FLAGS as readonly string[]).includes(f),
      )) &&
    review.confidence >= APPROVAL_CONFIDENCE
  )
    return "reject";
  if (
    review.duplicateCandidateId &&
    review.duplicateDecision === "likely_duplicate" &&
    review.duplicateConfidence >= 0.9
  )
    return "duplicate";
  if (
    review.decision === "approve" &&
    review.confidence >= APPROVAL_CONFIDENCE &&
    review.appearsGenuine &&
    review.imageSafe &&
    review.imageRelevant &&
    review.flags.length === 0 &&
    review.duplicateDecision === "not_duplicate" &&
    review.duplicateConfidence < 0.3
  )
    return "approve";
  return "review";
}
export interface PublicBusiness {
  businessName: string;
  ownerName: string;
  description: string;
  productsServices: string[];
  category: string;
  imageUrl: string;
  phone: string;
  whatsapp: string;
  instagram?: string;
  email?: string;
  location?: string;
  slug: string;
  createdAt: string;
}
export function publicBusinessDTO(b: PublicBusiness) {
  return {
    businessName: b.businessName,
    ownerName: b.ownerName,
    description: b.description,
    productsServices: b.productsServices,
    category: b.category,
    imageUrl: b.imageUrl,
    phone: b.phone,
    whatsapp: b.whatsapp,
    instagram: b.instagram,
    email: b.email,
    location: b.location,
    slug: b.slug,
    createdAt: b.createdAt,
  };
}
export function escapeBusinessSearch(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
