import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

test("magic-link verification preserves server-backed destinations across browser contexts", { timeout: 120_000 }, async (t) => {
  const database = await MongoMemoryServer.create();
  process.env.MONGODB_URI = database.getUri("auth-magic-continuation");
  process.env.AUTH_SEND_REAL_EMAILS = "false";
  process.env.BETTER_AUTH_SECRET = "magic-continuation-test-secret-32-characters";
  process.env.SWIFTDU_BASE_URL = "http://localhost:3000";
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  await mongoose.connect(process.env.MONGODB_URI);

  const { User } = await import("@/models/user");
  const { AuthContinuation } = await import("@/models/auth-continuation");
  const { createAuthContinuation, resolveAuthContinuation } = await import("@/lib/auth-continuation");
  const { buildAuthCallbackPaths } = await import("@/lib/auth-continuation-paths");
  const { auth } = await import("@/lib/auth");
  const { GET: continueAuth } = await import("@/app/auth/continue/route");
  const { GET: getSession } = await import("@/app/api/auth/get-session/route");
  const { closeMongoClient } = await import("@/lib/db");

  const capture = globalThis as typeof globalThis & {
    __captureSwiftDUMagicLink?: (url: string) => void;
  };
  t.after(async () => {
    delete capture.__captureSwiftDUMagicLink;
    await Promise.allSettled([mongoose.disconnect(), closeMongoClient(), database.stop()]);
  });

  async function requestLink(email: string, reference?: string | null) {
    let link = "";
    capture.__captureSwiftDUMagicLink = (value) => { link = value; };
    await auth.api.signInMagicLink({
      body: { email, ...buildAuthCallbackPaths(reference, { magicLink: true }) },
      headers: new Headers(),
    });
    assert.ok(link);
    return link;
  }

  async function verifyInFreshBrowser(link: string) {
    const response = await auth.handler(new Request(link, { method: "GET", redirect: "manual" }));
    assert.equal(response.status, 302);
    const setCookies = (response.headers as Headers & { getSetCookie?: () => string[] })
      .getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
    const cookie = setCookies.filter(Boolean).map((value) => value.split(";")[0]).join("; ");
    return { response, cookie, setCookies };
  }

  async function followContinuation(location: string, cookie: string) {
    return continueAuth(new NextRequest(location, { headers: { cookie } }));
  }

  await User.create({
    email: "existing-magic@example.test",
    emailVerified: true,
    name: "Synthetic Existing",
    role: "tasker",
    gender: "other",
    phone: "+2348012345678",
    defaultLocation: "Amnesty",
  });
  const existingReference = await createAuthContinuation("/tasker-dashboard/EXAMPLE_ID?preview=true");
  assert.ok(existingReference);
  const existingLink = await requestLink("existing-magic@example.test", existingReference);
  assert.equal(new URL(existingLink).searchParams.get("callbackURL"), `/auth/continue?continuation=${existingReference}`);
  const existing = await verifyInFreshBrowser(existingLink);
  assert.equal(existing.response.headers.get("location"), `http://localhost:3000/auth/continue?continuation=${existingReference}`);
  const final = await followContinuation(existing.response.headers.get("location")!, existing.cookie);
  assert.equal(final.headers.get("location"), "http://localhost:3000/tasker-dashboard/EXAMPLE_ID?preview=true");
  assert.equal(await resolveAuthContinuation(existingReference), null);

  const sessionResponse = await getSession(new NextRequest("http://localhost:3000/api/auth/get-session", {
    headers: { cookie: existing.cookie },
  }));
  assert.match(sessionResponse.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(sessionResponse.headers.get("cdn-cache-control"), "no-store");
  const cookieText = existing.setCookies.join("; ");
  assert.match(cookieText, /HttpOnly/i);
  assert.match(cookieText, /SameSite=Lax/i);
  assert.match(cookieText, /Max-Age=2592000/i);

  const newReference = await createAuthContinuation("/dashboard/orders?tab=open");
  assert.ok(newReference);
  const created = await verifyInFreshBrowser(await requestLink("new-magic@example.test", newReference));
  assert.equal(created.response.headers.get("location"), `http://localhost:3000/auth/continue?continuation=${newReference}&new=1`);
  const profile = await followContinuation(created.response.headers.get("location")!, created.cookie);
  assert.equal(profile.headers.get("location"), `http://localhost:3000/complete-profile?continuation=${newReference}`);
  assert.equal(await resolveAuthContinuation(newReference), "/dashboard/orders?tab=open");
  assert.equal(await resolveAuthContinuation(newReference, { consume: true }), "/dashboard/orders?tab=open");

  await User.create({ email: "plain-magic@example.test", emailVerified: true, name: "Synthetic Plain", role: "admin" });
  const plain = await verifyInFreshBrowser(await requestLink("plain-magic@example.test"));
  assert.equal(plain.response.headers.get("location"), "http://localhost:3000/auth/continue");
  const plainFinal = await followContinuation(plain.response.headers.get("location")!, plain.cookie);
  assert.equal(plainFinal.headers.get("location"), "http://localhost:3000/admin");

  const expired = await createAuthContinuation("/dashboard?tab=expired");
  assert.ok(expired);
  const expiredRecord = await AuthContinuation.findOne({ destination: "/dashboard?tab=expired" });
  assert.ok(expiredRecord);
  expiredRecord.expiresAt = new Date(0);
  await expiredRecord.save();
  assert.equal(await resolveAuthContinuation(expired), null);
  assert.equal(await resolveAuthContinuation("not-a-reference"), null);
  const fallback = await followContinuation(
    "http://localhost:3000/auth/continue?continuation=" + "z".repeat(32),
    existing.cookie,
  );
  assert.equal(fallback.headers.get("location"), "http://localhost:3000/tasker-dashboard");
  assert.equal(await createAuthContinuation("https://evil.example/steal"), null);
  assert.equal(await createAuthContinuation("/%252f%252fevil.example"), null);

  const reused = await auth.handler(new Request(existingLink, { method: "GET", redirect: "manual" }));
  assert.equal(reused.status, 302);
  const errorLocation = new URL(reused.headers.get("location")!);
  assert.equal(errorLocation.pathname, "/auth");
  assert.equal(errorLocation.searchParams.get("magicLinkError"), "true");
  assert.match(errorLocation.searchParams.get("error") ?? "", /INVALID|ATTEMPTS/i);
});
