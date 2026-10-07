import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import sharp from "sharp";
import { validateBusinessImage } from "./business-image-validation";
import { NextRequest } from "next/server";

test(
  "public API validates, moderates, reserves duplicates and hides private records",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri("business_directory_test");
    process.env.GEMINI_API_KEY = "test-only";
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    process.env.OPERATIONS_ENABLED = "false";
    const { default: Business } = await import("../models/business");
    const { GET, POST } = await import("../app/api/businesses/route");
    const { default: clientPromise } = await import("./db");
    const realFetch = globalThis.fetch;
    t.after(async () => {
      globalThis.fetch = realFetch;
      await mongoose.disconnect();
      await (await clientPromise).close();
      await mongo.stop();
    });
    let mode = "approve",
      aiCalls = 0,
      uploads = 0;
    globalThis.fetch = async (url, init) => {
      const address = url instanceof Request ? url.url : String(url);
      if (address.includes("generativelanguage.googleapis.com")) {
        aiCalls++;
        if (mode === "unavailable")
          return Response.json(
            { error: { message: "quota" } },
            { status: 429 },
          );
        const review = {
          decision: mode === "review" ? "review" : "approve",
          confidence: 0.96,
          appearsGenuine: true,
          imageRelevant: true,
          imageSafe: true,
          category: "Food & Drinks",
          reasons: ["Coherent offering."],
          flags: mode === "reject" ? ["fraud"] : mode === "sexual" ? ["sexual_content"] : [],
          duplicateCandidateId: null,
          duplicateConfidence: 0,
          duplicateDecision: "not_duplicate",
        };
        return Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: mode === "malformed" ? "{}" : JSON.stringify(review),
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        });
      }
      if (address.includes("api.cloudinary.com")) {
        assert.equal(new Headers(init?.headers).get("Authorization"),
          `Basic ${Buffer.from("test-key:test-secret").toString("base64")}`);
        assert.equal((init?.body as FormData).has("timestamp"), false);
        assert.equal((init?.body as FormData).has("signature"), false);
        if (address.endsWith("/destroy"))
          return Response.json({ result: "ok" });
        uploads++;
        if (mode === "upload-failure")
          return Response.json({ error: "failure" }, { status: 500 });
        const id = (init?.body as FormData).get("public_id");
        return Response.json({
          public_id: id,
          secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${id}.webp`,
        });
      }
      throw new Error(`Unexpected network request: ${address}`);
    };
    const image = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#6633ee" },
    })
      .png()
      .toBuffer();
    function request(name: string, number: string, badImage = false) {
      const form = new FormData();
      for (const [key, value] of Object.entries({
        businessName: name,
        ownerName: "Campus Owner",
        description: "Fresh meals and snacks for campus students.",
        productsServices: "Rice,Snacks",
        phone: number,
        whatsapp: number,
      }))
        form.set(key, value);
      form.set(
        "image",
        new Blob(
          [new Uint8Array(badImage ? Buffer.from("not an image") : image)],
          { type: "image/png" },
        ),
        "logo.png",
      );
      return new NextRequest("https://swiftdu.test/api/businesses", {
        method: "POST",
        body: form,
      });
    }
    assert.equal(
      (await POST(request("Campus Foods", "08012345678", true))).status,
      400,
    );
    assert.equal(aiCalls, 0);
    const created = await POST(request("Campus Foods", "08012345678"));
    assert.equal(
      created.status,
      201,
      JSON.stringify(await created.clone().json()),
    );
    assert.equal(uploads, 1);
    assert.equal(
      (await POST(request("Campus Foods", "08099999999"))).status,
      409,
    );
    assert.equal(
      (await POST(request("Different Shop", "08012345678"))).status,
      409,
    );
    assert.equal(aiCalls, 1);
    mode = "review";
    assert.equal(
      (await POST(request("Joy Laundry", "08011111111"))).status,
      422,
    );
    assert.equal(uploads, 1);
    assert.equal(await Business.countDocuments({ businessName: "Joy Laundry" }), 0);
    // A corrected submission can retry; uncertain checks do not reserve contacts.
    assert.equal((await POST(request("Joy Laundry", "08011111111"))).status, 422);
    const publicResponse = await GET(
      new NextRequest("https://swiftdu.test/api/businesses"),
    );
    const data = await publicResponse.json();
    assert.equal(data.businesses.length, 1);
    assert.equal(data.businesses[0].moderation, undefined);
    assert.equal(data.businesses[0].normalizedPhone, undefined);
    assert.equal(data.businesses[0].pendingImage, undefined);
    const filtered = await GET(
      new NextRequest(
        "https://swiftdu.test/api/businesses?q=snacks&category=Food%20%26%20Drinks&limit=1",
      ),
    );
    assert.equal((await filtered.json()).total, 1);
    mode = "reject";
    assert.equal(
      (await POST(request("Zed Technology", "08033333333"))).status,
      422,
    );
    mode = "malformed";
    assert.equal(
      (await POST(request("Beauty Studio", "08044444444"))).status,
      503,
    );
    assert.equal(uploads, 1);
    assert.equal(await Business.countDocuments({ businessName: "Beauty Studio" }), 0);
    mode = "unavailable";
    assert.equal((await POST(request("Retry Services", "08066666666"))).status, 503);
    assert.equal(await Business.countDocuments({ businessName: "Retry Services" }), 0);
    mode = "sexual";
    assert.equal((await POST(request("Explicit Studio", "08077777777"))).status, 422);
    assert.equal(await Business.countDocuments({ businessName: "Explicit Studio" }), 0);
    assert.equal(uploads, 1);
    mode = "approve";
    assert.equal((await POST(request("Retry Services", "08066666666"))).status, 201);
    await Business.deleteOne({ businessName: "Retry Services" });
    mode = "upload-failure";
    assert.equal(
      (await POST(request("Photo House", "08055555555"))).status,
      503,
    );
    assert.equal(
      await Business.countDocuments({ businessName: "Photo House" }),
      0,
    );
    // Unique multikey index rejects swapped phone/WhatsApp contacts even under races.
    const base = {
      businessName: "Race Shop",
      normalizedBusinessName: "race shop",
      ownerName: "Owner",
      description: "A valid business description.",
      category: "Other",
      phone: "2348077777777",
      normalizedPhone: "2348077777777",
      whatsapp: "2348088888888",
      normalizedWhatsapp: "2348088888888",
      contactKeys: ["2348077777777", "2348088888888"],
      slug: "race-one",
    };
    const writes = await Promise.allSettled([
      Business.create(base),
      Business.create({
        ...base,
        normalizedBusinessName: "race other",
        slug: "race-two",
        contactKeys: ["2348088888888", "2348077777777"],
      }),
    ]);
    assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
    await Business.updateOne(
      { businessName: "Campus Foods" },
      { isVisible: false },
    );
    assert.equal(
      (
        await (
          await GET(new NextRequest("https://swiftdu.test/api/businesses"))
        ).json()
      ).total,
      0,
    );
  },
);


test("business images decode JPEG/PNG/WebP, resize and convert without enlargement", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const bytes = await sharp({
      create: { width: 1600, height: 800, channels: 3, background: "#6633ee" },
    }).toFormat(format).toBuffer();
    const result = await validateBusinessImage(new File([new Uint8Array(bytes)], "image", { type: `image/${format}` }));
    const metadata = await sharp(result.image).metadata();
    assert.equal(result.mimeType, "image/webp");
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 600);
  }
  const small = await sharp({ create: { width: 10, height: 20, channels: 3, background: "red" } }).png().toBuffer();
  const result = await validateBusinessImage(new File([new Uint8Array(small)], "small.png", { type: "image/png" }));
  const metadata = await sharp(result.image).metadata();
  assert.equal(metadata.width, 10);
  assert.equal(metadata.height, 20);
});

test("business image validation rejects oversized, empty, unsupported and corrupt files", async () => {
  for (const file of [
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
    new File([], "empty.png", { type: "image/png" }),
    new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
    new File(["not an image"], "fake.png", { type: "image/png" }),
  ]) await assert.rejects(() => validateBusinessImage(file));
});
