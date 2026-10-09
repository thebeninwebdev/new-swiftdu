import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.GEMINI_API_KEY)
    throw new Error("Set GEMINI_API_KEY before running the backfill.");
  const { connectDB, default: clientPromise } = await import("../lib/db");
  try {
    const { default: Business } = await import("../models/business");
    const {
      BUSINESS_SEARCH_SELECTION,
      hasCurrentBusinessEmbedding,
      prepareBusinessEmbedding,
    } = await import("../lib/business-search");
    await connectDB();
    let updated = 0,
      skipped = 0,
      failed = 0;
    const cursor = Business.find({ status: "approved", isVisible: true })
      .select(BUSINESS_SEARCH_SELECTION)
      .sort({ _id: 1 })
      .lean()
      .cursor({ batchSize: 10 });
    for await (const business of cursor) {
      if (hasCurrentBusinessEmbedding(business)) {
        skipped++;
        continue;
      }
      try {
        const fields = await prepareBusinessEmbedding(business);
        if (!fields.searchEmbedding?.length)
          throw new Error("Embedding deferred");
        // A concurrent moderation or content edit must never be overwritten.
        const result = await Business.updateOne(
          {
            _id: business._id,
            updatedAt: business.updatedAt,
            status: "approved",
            isVisible: true,
          },
          { $set: fields },
        );
        if (result.modifiedCount) updated++;
        else skipped++;
      } catch {
        failed++;
      }
      console.log(
        `Embeddings: ${updated} updated, ${skipped} skipped, ${failed} failed`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(
      `Finished: ${updated} updated, ${skipped} skipped, ${failed} failed`,
    );
    if (failed) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    await (await clientPromise).close();
  }
}
main().catch(() => {
  console.error(
    "Backfill failed. Check server environment and database connectivity.",
  );
  process.exitCode = 1;
});
