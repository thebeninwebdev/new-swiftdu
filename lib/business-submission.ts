import {
  decideBusinessReview,
  parseBusinessAIReview,
  type BusinessInput,
} from "./business-directory";
import type { DuplicateCandidate } from "./business-ai-review";

// Injectable boundary keeps moderation failure behavior testable without real API calls.
export async function moderateBusinessSubmission(
  input: BusinessInput,
  image: Buffer,
  mime: string,
  candidates: DuplicateCandidate[],
  review: (
    input: BusinessInput,
    image: Buffer,
    mime: string,
    candidates: DuplicateCandidate[],
  ) => Promise<unknown>,
) {
  try {
    let raw: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        raw = await review(input, image, mime, candidates);
        break;
      } catch (error) {
        const status = error && typeof error === "object" && "status" in error
          ? Number(error.status) : 0;
        if (attempt === 0 && [429, 500, 502, 503, 504].includes(status)) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        throw error;
      }
    }
    const result = parseBusinessAIReview(
      raw,
      candidates.map((c) => c.id),
    );
    return { outcome: decideBusinessReview(result), review: result };
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error
      ? Number(error.status) : 0;
    // Never log provider response bodies: they can include submitted data or credentials.
    console.warn("[business moderation] Gemini request failed", { status: status || "unknown" });
    return {
      outcome: "unavailable" as const,
      review: null,
      error: [429, 503].includes(status)
        ? "Automatic safety checks are busy right now. Please wait a minute and submit again. Your listing has not been published."
        : "Automatic safety checks could not complete. Please try again shortly. Your listing has not been published.",
    };
  }
}
