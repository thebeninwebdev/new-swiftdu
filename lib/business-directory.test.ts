import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeBusinessName,
  normalizePhoneNumber,
  normalizeInstagramHandle,
  exactDuplicateReason,
  fuzzyDuplicateLevel,
  decideBusinessReview,
  parseBusinessAIReview,
  validateBusinessInput,
  publicBusinessDTO,
  type BusinessAIReview,
  type BusinessInput,
  type PublicBusiness,
} from "./business-directory";
import { moderateBusinessSubmission } from "./business-submission";
import { isCustomerOperationRoute } from "./operations";
import { proxy } from "../proxy";
import { NextRequest } from "next/server";
const approved: BusinessAIReview = {
  decision: "approve",
  confidence: 0.95,
  appearsGenuine: true,
  imageRelevant: true,
  imageSafe: true,
  category: "Food & Drinks",
  reasons: ["Coherent food offering."],
  flags: [],
  duplicateCandidateId: null,
  duplicateConfidence: 0,
  duplicateDecision: "not_duplicate",
};
test("normalizes names without removing meaningful words", () => {
  assert.equal(
    normalizeBusinessName("  Eseosa’s   Phones! "),
    "eseosas phones",
  );
  assert.equal(normalizeBusinessName("Phone-Store"), "phone store");
});
test("normalizes Nigerian numbers and rejects malformed numbers", () => {
  for (const number of [
    "08012345678",
    "+2348012345678",
    "2348012345678",
    "+234 (801) 234-5678",
  ])
    assert.equal(normalizePhoneNumber(number), "2348012345678");
  for (const number of [
    "123",
    "+18012345678",
    "08012345678foo",
    "2340012345678",
  ])
    assert.equal(normalizePhoneNumber(number), "");
});
test("Instagram accepts only safe profile handles", () => {
  for (const handle of [
    "@swiftdufoods",
    "swiftdufoods",
    "https://instagram.com/swiftdufoods/",
  ])
    assert.equal(normalizeInstagramHandle(handle), "swiftdufoods");
  for (const handle of [
    "javascript:alert(1)",
    "https://evil.test/swiftdufoods",
    "https://instagram.com/p/example",
  ])
    assert.equal(normalizeInstagramHandle(handle), "");
});
const fields = {
  normalizedBusinessName: "food place",
  normalizedPhone: "2348012345678",
  normalizedWhatsapp: "2348098765432",
  normalizedInstagram: "foods",
};
test("exact duplicate checks include cross-field contact matches", () => {
  assert.match(exactDuplicateReason(fields, fields)!, /name/);
  assert.match(
    exactDuplicateReason(fields, {
      ...fields,
      normalizedBusinessName: "other",
    })!,
    /WhatsApp/,
  );
  assert.match(
    exactDuplicateReason(fields, {
      ...fields,
      normalizedBusinessName: "other",
      normalizedPhone: fields.normalizedWhatsapp,
      normalizedWhatsapp: "different",
    })!,
    /WhatsApp/,
  );
  assert.match(
    exactDuplicateReason(fields, {
      ...fields,
      normalizedBusinessName: "other",
      normalizedPhone: "a",
      normalizedWhatsapp: "b",
    })!,
    /Instagram/,
  );
  assert.equal(
    exactDuplicateReason(fields, {
      normalizedBusinessName: "other",
      normalizedPhone: "a",
      normalizedWhatsapp: "b",
    }),
    null,
  );
});
test("fuzzy detection separates strong matches and ambiguous candidates", () => {
  assert.equal(
    fuzzyDuplicateLevel("Eseosa Phones", "EseosaPhones"),
    "duplicate",
  );
  assert.equal(
    fuzzyDuplicateLevel("Eseosa Phones", "Eseosa's Phones"),
    "candidate",
  );
  assert.equal(
    fuzzyDuplicateLevel("Eseosa Phones", "Eseosa Phone Store"),
    "candidate",
  );
  assert.equal(
    fuzzyDuplicateLevel("Eseosa Phones", "Joy Laundry"),
    "different",
  );
});
test("only permitted confident results approve", () => {
  assert.equal(decideBusinessReview(approved), "approve");
  for (const flag of [
    "sexual_services",
    "sexual_content",
    "pornography",
    "phishing",
    "identity_theft",
    "investment_scam",
    "illegal_drugs",
    "fraud",
    "academic_cheating",
    "spam",
  ])
    assert.equal(
      decideBusinessReview({ ...approved, flags: [flag] }),
      "reject",
    );
});
test("uncertain and contradictory results cannot approve", () => {
  for (const change of [
    { decision: "review" as const },
    { confidence: 0.5 },
    { imageRelevant: false },
    { imageSafe: false, confidence: 0.4 },
    { appearsGenuine: false },
    { flags: ["unknown"] },
    { duplicateDecision: "uncertain" as const },
    { duplicateConfidence: 0.5 },
  ])
    assert.equal(decideBusinessReview({ ...approved, ...change }), "review");
});
test("malformed output and fabricated candidate IDs are never trusted", () => {
  for (const value of [
    null,
    {},
    { ...approved, confidence: "0.9" },
    { ...approved, imageSafe: "true" },
    { ...approved, reasons: ["a".repeat(201)] },
  ])
    assert.equal(parseBusinessAIReview(value, []), null);
  const result = parseBusinessAIReview(
    {
      ...approved,
      duplicateCandidateId: "fake",
      duplicateDecision: "likely_duplicate",
      duplicateConfidence: 1,
    },
    [],
  );
  assert.equal(result?.duplicateCandidateId, null);
  assert.equal(decideBusinessReview(result), "review");
});
test("moderation boundary fails closed using mocked AI", async () => {
  const input = {} as BusinessInput;
  assert.equal(
    (
      await moderateBusinessSubmission(
        input,
        Buffer.alloc(0),
        "image/webp",
        [],
        async () => approved,
      )
    ).outcome,
    "approve",
  );
  for (const mock of [
    async () => ({ nonsense: true }),
    async () => {
      throw new Error("quota");
    },
  ])
    assert.equal(
      (
        await moderateBusinessSubmission(
          input,
          Buffer.alloc(0),
          "image/webp",
          [],
          mock,
        )
      ).outcome,
      "unavailable",
    );
});
test("form enforces limits, required contacts and honeypot", () => {
  const form = new FormData();
  for (const [k, v] of Object.entries({
    businessName: "Campus Foods",
    ownerName: "Eseosa",
    description: "Fresh meals for the WDU community.",
    productsServices: "Rice,Snacks",
    phone: "08012345678",
    whatsapp: "08012345678",
  }))
    form.set(k, v);
  assert.equal(validateBusinessInput(form).category, "Other");
  form.set("website", "spam");
  assert.throws(() => validateBusinessInput(form));
  form.set("website", "");
  form.set("businessName", "a".repeat(81));
  assert.throws(() => validateBusinessInput(form));
});
test("public DTO allowlist excludes internal metadata", () => {
  const result = publicBusinessDTO({
    businessName: "Test",
    moderation: approved,
    pendingImage: "private",
    normalizedPhone: "internal",
  } as unknown as PublicBusiness);
  assert.equal("moderation" in result, false);
  assert.equal("pendingImage" in result, false);
  assert.equal("normalizedPhone" in result, false);
});
test("directory stays public with operations disabled, including nested routes", async (t) => {
  const original = process.env.OPERATIONS_ENABLED;
  process.env.OPERATIONS_ENABLED = "false";
  t.after(() => {
    if (original === undefined) delete process.env.OPERATIONS_ENABLED;
    else process.env.OPERATIONS_ENABLED = original;
  });
  for (const path of [
    "/businesses",
    "/businesses/example",
    "/api/businesses",
    "/admin/businesses",
  ])
    assert.equal(isCustomerOperationRoute(path), false);
  for (const path of ["/businesses", "/businesses/example"]) {
    const response = await proxy(
      new NextRequest(`https://swiftdu.test${path}`),
    );
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("location"), null);
  }
});
