// Server implementation: imported only by API routes and the manual backfill.
import { GoogleGenAI } from "@google/genai";
import Business from "../models/business";
import {
  escapeBusinessSearch,
  publicBusinessDTO,
  type PublicBusiness,
} from "./business-directory";

export const BUSINESS_EMBEDDING_DIMENSIONS = 768;
export const BUSINESS_VECTOR_INDEX = "business_semantic_search";
export const BUSINESS_SEARCH_SELECTION =
  "+searchText +searchEmbedding +searchEmbeddingModel +searchEmbeddingUpdatedAt";
const publicFilter = { status: "approved", isVisible: true };
const publicFields =
  "businessName ownerName description productsServices category imageUrl phone whatsapp instagram email location slug createdAt";
const limit = 12;
// Atlas cosine scores are (1 + cosine similarity) / 2. Calibrate with real listings.
const minimumScore = 0.65;
type SearchableBusiness = Pick<
  PublicBusiness,
  "businessName" | "category" | "description" | "productsServices"
> & {
  location?: string | null;
  searchText?: string;
  searchEmbedding?: number[] | null;
  searchEmbeddingModel?: string;
};
const clean = (text: string) =>
  text.normalize("NFKC").replace(/\s+/g, " ").trim();
export const businessEmbeddingModel = () =>
  process.env.GEMINI_BUSINESS_EMBEDDING_MODEL || "gemini-embedding-2";

export function buildBusinessSearchText(business: SearchableBusiness) {
  return [
    `Business: ${clean(business.businessName)}`,
    `Category: ${clean(business.category)}`,
    `About: ${clean(business.description)}`,
    `Products and services: ${business.productsServices.map(clean).join(", ")}`,
    ...(business.location ? [`Location: ${clean(business.location)}`] : []),
  ].join("\n");
}
export function validateBusinessSearchQuery(value: unknown) {
  if (typeof value !== "string")
    throw new Error("Enter what you need (2–200 characters).");
  const query = value.trim();
  if (
    query.length < 2 ||
    query.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(query) ||
    !/[\p{L}\p{N}]/u.test(query)
  )
    throw new Error("Enter what you need (2–200 characters).");
  return query;
}
export function validBusinessEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === BUSINESS_EMBEDDING_DIMENSIONS &&
    value.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    value.some((n) => n !== 0)
  );
}
export async function generateBusinessEmbedding(
  text: string,
  kind: "query" | "document",
  model = businessEmbeddingModel(),
) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Embeddings unavailable");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const legacy = model.replace(/^models\//, "") === "gemini-embedding-001";
  const response = await ai.models.embedContent({
    model,
    contents: legacy
      ? text
      : kind === "query"
        ? `task: search result | query: ${text}`
        : `title: none | text: ${text}`,
    config: {
      outputDimensionality: BUSINESS_EMBEDDING_DIMENSIONS,
      ...(legacy
        ? {
            taskType:
              kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
          }
        : {}),
      httpOptions: { timeout: 8000 },
    },
  });
  const vector = response.embeddings?.[0]?.values;
  if (!validBusinessEmbedding(vector)) throw new Error("Invalid embedding");
  return vector;
}
export function hasCurrentBusinessEmbedding(business: SearchableBusiness) {
  return (
    business.searchText === buildBusinessSearchText(business) &&
    business.searchEmbeddingModel === businessEmbeddingModel() &&
    validBusinessEmbedding(business.searchEmbedding)
  );
}
export async function prepareBusinessEmbedding(business: SearchableBusiness) {
  if (hasCurrentBusinessEmbedding(business)) return {};
  const searchText = buildBusinessSearchText(business);
  const searchEmbeddingModel = businessEmbeddingModel();
  try {
    const searchEmbedding = await generateBusinessEmbedding(
      searchText,
      "document",
      searchEmbeddingModel,
    );
    return {
      searchText,
      searchEmbedding,
      searchEmbeddingModel,
      searchEmbeddingUpdatedAt: new Date(),
    };
  } catch {
    console.warn(
      "[business search] Embedding deferred; run the backfill to retry.",
    );
    return {
      searchText: "",
      searchEmbedding: [],
      searchEmbeddingModel: "",
      searchEmbeddingUpdatedAt: null,
    };
  }
}
// Keep fallback useful for sentences without turning generic request words into
// matches. Require every remaining term so unrelated businesses do not flood in.
const requestWords = new Set(
  "a an the i me my we our us you your someone somebody anyone please need want looking look find help get build make buy where who can could would to for from in on at of with and or that is are do does".split(
    " ",
  ),
);
export function businessSearchTerms(query: string) {
  return [
    ...new Set(
      clean(query)
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) || [],
    ),
  ].filter((term) => term.length >= 2 && !requestWords.has(term));
}
export async function searchBusinesses(rawQuery: string) {
  const query = validateBusinessSearchQuery(rawQuery);
  const regex = { $regex: escapeBusinessSearch(query), $options: "i" };
  const exact = await Business.find({
    ...publicFilter,
    businessName: { $regex: `^${escapeBusinessSearch(query)}$`, $options: "i" },
  })
    .select(publicFields)
    .limit(limit)
    .lean();
  const direct = await Business.find({
    ...publicFilter,
    productsServices: regex,
  })
    .select(publicFields)
    .sort({ _id: 1 })
    .limit(limit)
    .lean();
  const searchFields = [
    "businessName",
    "category",
    "description",
    "productsServices",
  ];
  const phraseMatches = searchFields.map((key) => ({ [key]: regex }));
  const terms = businessSearchTerms(query);
  const lexical = await Business.find({
    ...publicFilter,
    $or: [
      ...phraseMatches,
      ...(terms.length
        ? [
            {
              $and: terms.map((term) => ({
                $or: searchFields.map((key) => ({
                  [key]: {
                    $regex: String.raw`\b${escapeBusinessSearch(term)}`,
                    $options: "i",
                  },
                })),
              })),
            },
          ]
        : []),
    ],
  })
    .select(publicFields)
    .sort({ _id: 1 })
    .limit(limit)
    .lean();
  let semantic: { _id: unknown; score: number }[] = [];
  try {
    const queryVector = await generateBusinessEmbedding(query, "query");
    semantic = await Business.aggregate<{ _id: unknown; score: number }>([
      {
        $vectorSearch: {
          index: BUSINESS_VECTOR_INDEX,
          path: "searchEmbedding",
          queryVector,
          numCandidates: 240,
          limit,
          filter: {
            ...publicFilter,
            searchEmbeddingModel: businessEmbeddingModel(),
          },
        },
      },
      { $project: { _id: 1, score: { $meta: "vectorSearchScore" } } },
      { $match: { score: { $gte: minimumScore } } },
    ]).option({ maxTimeMS: 5000 });
  } catch {
    console.warn(
      "[business search] Semantic search unavailable; using lexical results.",
    );
  }
  const ids = [
    ...new Map(
      [...exact, ...direct, ...semantic, ...lexical].map((b) => [
        String(b._id),
        b._id,
      ]),
    ).values(),
  ];
  // Recheck live visibility because Atlas search indexes update asynchronously.
  const records = await Business.find({ ...publicFilter, _id: { $in: ids } })
    .select(publicFields)
    .lean();
  const byId = new Map(records.map((b) => [String(b._id), b]));
  return ids
    .flatMap((id) => {
      const b = byId.get(String(id));
      return b
        ? [
            publicBusinessDTO({
              ...b,
              createdAt: b.createdAt.toISOString(),
              instagram: b.instagram ?? undefined,
              email: b.email ?? undefined,
              location: b.location ?? undefined,
            }),
          ]
        : [];
    })
    .slice(0, limit);
}
