import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthCallbackPaths, buildAuthContinuationPath } from "./auth-continuation-paths";
import { AUTH_SESSION_SETTINGS, getAuthCookieAttributes, SESSION_RESPONSE_HEADERS } from "./auth-session-config";
import { getSafeNextPath } from "./profile-completion";

const reference = "a".repeat(32);

test("auth callbacks carry only an opaque continuation reference", () => {
  const callbacks = buildAuthCallbackPaths(reference, { magicLink: true });
  assert.equal(callbacks.callbackURL, `/auth/continue?continuation=${reference}`);
  assert.equal(callbacks.newUserCallbackURL, `/auth/continue?continuation=${reference}&new=1`);
  assert.equal(callbacks.errorCallbackURL, `/auth?magicLinkError=true&continuation=${reference}`);
  assert.ok(!JSON.stringify(callbacks).includes("preview"));
  assert.deepEqual(buildAuthCallbackPaths(), {
    callbackURL: "/auth/continue",
    newUserCallbackURL: "/auth/continue?new=1",
    errorCallbackURL: "/auth",
  });
  assert.equal(buildAuthCallbackPaths(reference).callbackURL, buildAuthContinuationPath(reference));
});

test("safe destinations retain ordinary queries and reject encoded redirects", () => {
  assert.equal(getSafeNextPath("/tasker-dashboard/EXAMPLE_ID?preview=true"), "/tasker-dashboard/EXAMPLE_ID?preview=true");
  for (const unsafe of [
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "/%2f%2fevil.example/steal",
    "/%252f%252fevil.example/steal",
    "/orders?next=https%3A%2F%2Fevil.example",
    "/orders?redirect=%252F%252Fevil.example",
    "/orders%ZZ",
  ]) assert.equal(getSafeNextPath(unsafe), null, unsafe);
});

test("session policy remains thirty days with secure lax production cookies and no-store responses", () => {
  assert.deepEqual(AUTH_SESSION_SETTINGS, { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 });
  assert.deepEqual(getAuthCookieAttributes("production"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  assert.match(SESSION_RESPONSE_HEADERS["Cache-Control"], /no-store/);
  assert.equal(SESSION_RESPONSE_HEADERS["CDN-Cache-Control"], "no-store");
  assert.equal(SESSION_RESPONSE_HEADERS.Vary, "Cookie");
});
