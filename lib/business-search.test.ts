import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import Business from "../models/business";
import {
  buildBusinessSearchText,
  businessSearchTerms,
  hasCurrentBusinessEmbedding,
  prepareBusinessEmbedding,
  searchBusinesses,
  validateBusinessSearchQuery,
  validBusinessEmbedding,
} from "./business-search";
const fixture = {
  businessName: "Ese Graphics",
  category: "Design",
  description:
    "Graphic designer helping students and businesses with branding and visual design.",
  productsServices: [
    "Logo design",
    "Posters",
    "Branding",
    "Social media graphics",
    "Flyers",
  ],
  location: "WDU Campus",
};
const vector = (index: number) =>
  Array.from({ length: 768 }, (_, i) => (i === index ? 1 : 0));
test("search text is deterministic and includes only discovery fields", () => {
  const input = {
    ...fixture,
    phone: "private-phone",
    email: "private-email",
    moderation: "private-review",
  };
  assert.equal(
    buildBusinessSearchText(input),
    "Business: Ese Graphics\nCategory: Design\nAbout: Graphic designer helping students and businesses with branding and visual design.\nProducts and services: Logo design, Posters, Branding, Social media graphics, Flyers\nLocation: WDU Campus",
  );
  assert.equal(
    buildBusinessSearchText({ ...fixture, businessName: "  Ese   Graphics " }),
    buildBusinessSearchText(fixture),
  );
  assert.doesNotMatch(buildBusinessSearchText(input), /private/);
});
test("queries reject empty, oversized, control and punctuation-only input", () => {
  for (const q of [
    null,
    undefined,
    1,
    "",
    " ",
    "a",
    "x".repeat(201),
    "ab\u0000",
    ".*",
  ])
    assert.throws(() => validateBusinessSearchQuery(q));
  assert.equal(validateBusinessSearchQuery("  flyer  "), "flyer");
  assert.equal(validateBusinessSearchQuery("a".repeat(200)).length, 200);
});
test("fallback extracts service terms from natural-language requests", () => {
  assert.deepEqual(businessSearchTerms("someone to build me a website"), [
    "website",
  ]);
  assert.deepEqual(
    businessSearchTerms("Please find someone for website design"),
    ["website", "design"],
  );
  assert.deepEqual(businessSearchTerms("someone to help me"), []);
  assert.deepEqual(businessSearchTerms("website.* website"), ["website"]);
});
test("embedding freshness includes text, dimensions and model", () => {
  const current = {
    ...fixture,
    searchText: buildBusinessSearchText(fixture),
    searchEmbedding: vector(0),
    searchEmbeddingModel: "gemini-embedding-2",
  };
  assert.equal(hasCurrentBusinessEmbedding(current), true);
  assert.equal(
    hasCurrentBusinessEmbedding({ ...current, description: "Changed" }),
    false,
  );
  assert.equal(
    hasCurrentBusinessEmbedding({ ...current, searchEmbeddingModel: "old" }),
    false,
  );
  for (const v of [
    [],
    [1],
    vector(0).map(() => 0),
    [...vector(0).slice(1), NaN],
  ])
    assert.equal(validBusinessEmbedding(v), false);
});
test(
  "hybrid retrieval, fallback, live visibility, and embedding lifecycle",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri("search_test"));
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-only";
    const realFetch = globalThis.fetch;
    t.after(async () => {
      globalThis.fetch = realFetch;
      if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalKey;
      await mongoose.disconnect();
      await mongo.stop();
    });
    let calls = 0,
      unavailable = false,
      queryVector = vector(0);
    globalThis.fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      const request = body.requests?.[0] || body;
      assert.equal(request.outputDimensionality, 768);
      assert.equal(request.taskType, undefined);
      assert.match(JSON.stringify(request), /task: search result|title: none/);
      if (unavailable) throw new Error("provider failure with private data");
      return Response.json(
        body.requests
          ? { embeddings: [{ values: queryVector }] }
          : { embedding: { values: queryVector } },
      );
    };
    const fields = await prepareBusinessEmbedding(fixture);
    assert.equal(fields.searchEmbedding?.length, 768);
    assert.deepEqual(
      await prepareBusinessEmbedding({ ...fixture, ...fields }),
      {},
    );
    assert.equal(calls, 1);
    unavailable = true;
    assert.deepEqual(
      (await prepareBusinessEmbedding({ ...fixture, description: "Changed" }))
        .searchEmbedding,
      [],
    );
    unavailable = false;
    const offerings = [
      fixture,
      {
        ...fixture,
        businessName: "Beauty by Ada",
        productsServices: ["Braiding", "knotless braids", "wig installation"],
      },
      {
        ...fixture,
        businessName: "Print Hub",
        productsServices: ["Printing", "photocopying", "binding"],
      },
    ];
    const records: {
      _id: mongoose.Types.ObjectId;
      searchEmbedding?: number[] | null;
    }[] = [];
    for (let i = 0; i < 6; i++) {
      records.push(
        await Business.create({
          ...offerings[i % 3],
          businessName:
            i < 3 ? offerings[i].businessName : `Private Flyers ${i}`,
          normalizedBusinessName: `unique-${i}`,
          ownerName: "Owner",
          phone: `phone-${i}`,
          whatsapp: `phone-${i}`,
          normalizedPhone: `phone-${i}`,
          normalizedWhatsapp: `phone-${i}`,
          contactKeys: [`phone-${i}`],
          slug: `listing-${i}`,
          status: i === 4 ? "review" : i === 5 ? "rejected" : "approved",
          isVisible: i !== 3,
          searchEmbedding: vector(i % 3),
          searchEmbeddingModel: "gemini-embedding-2",
        }),
      );
    }
    // Memory MongoDB has no Atlas engine. Deterministic cosine retrieval tests our
    // pipeline contract, result ranking and live visibility recheck without Gemini.
    const aggregate = t.mock.method(
      Business,
      "aggregate",
      (pipeline: mongoose.PipelineStage[]) =>
        ({
          option: async () => {
            const stage = pipeline[0] as {
              $vectorSearch: {
                filter: object;
                queryVector: number[];
                limit: number;
                path: string;
              };
            };
            assert.deepEqual(stage.$vectorSearch.filter, {
              status: "approved",
              isVisible: true,
              searchEmbeddingModel: "gemini-embedding-2",
            });
            assert.equal(stage.$vectorSearch.path, "searchEmbedding");
            const candidates = records.map((b) => ({
              _id: b._id,
              score:
                (1 +
                  b.searchEmbedding!.reduce(
                    (sum, value, i) =>
                      sum + value * stage.$vectorSearch.queryVector[i],
                    0,
                  )) /
                2,
            }));
            return candidates
              .filter((b) => b.score >= 0.65)
              .sort((a, b) => b.score - a.score)
              .slice(0, stage.$vectorSearch.limit);
          },
        }) as unknown as ReturnType<typeof Business.aggregate>,
    );
    for (const [index, q] of [
      "someone to build me a flyer",
      "I need someone to make my hair",
      "where can I print my assignment",
    ].entries()) {
      queryVector = vector(index);
      const result = await searchBusinesses(q);
      assert.equal(result[0].businessName, offerings[index].businessName);
      assert.equal(result.length, 1); // Stale hidden/review/rejected candidates removed.
      for (const key of [
        "searchText",
        "searchEmbedding",
        "searchEmbeddingModel",
        "score",
        "moderation",
      ])
        assert.equal(key in result[0], false);
    }
    queryVector = vector(1);
    assert.equal(
      (await searchBusinesses("Ese Graphics"))[0].businessName,
      "Ese Graphics",
    );
    await Business.create({
      ...fixture,
      businessName: "Web Studio",
      description: "We build modern websites and web applications.",
      productsServices: ["Webites", "banners"],
      normalizedBusinessName: "web-studio",
      ownerName: "Owner",
      phone: "web-phone",
      whatsapp: "web-phone",
      normalizedPhone: "web-phone",
      normalizedWhatsapp: "web-phone",
      contactKeys: ["web-phone"],
      slug: "web-studio",
      status: "approved",
      isVisible: true,
    });
    unavailable = true;
    assert.equal(
      (await searchBusinesses("someone to build me a website"))[0].businessName,
      "Web Studio",
    );
    assert.equal((await searchBusinesses("someone to help me")).length, 0);
    assert.equal((await searchBusinesses("website catering")).length, 0);
    assert.equal(
      (await searchBusinesses("Flyers"))[0].businessName,
      "Ese Graphics",
    );
    assert.equal((await searchBusinesses("Private Flyers")).length, 0);
    assert.equal((await searchBusinesses("nonexistent offering")).length, 0);
    unavailable = false;
    aggregate.mock.restore(); // Actual missing Atlas engine must also fall back.
    assert.equal(
      (await searchBusinesses("someone to build me a website"))[0].businessName,
      "Web Studio",
    );
    await Business.updateOne({ slug: "web-studio" }, { isVisible: false });
    assert.equal(
      (await searchBusinesses("someone to build me a website")).length,
      0,
    );
    assert.equal(
      (await searchBusinesses("Flyers"))[0].businessName,
      "Ese Graphics",
    );
  },
);
