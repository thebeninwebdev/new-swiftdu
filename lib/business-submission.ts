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
    const result = parseBusinessAIReview(
      await review(input, image, mime, candidates),
      candidates.map((c) => c.id),
    );
    return { outcome: decideBusinessReview(result), review: result };
  } catch {
    return { outcome: "unavailable" as const, review: null };
  }
}
