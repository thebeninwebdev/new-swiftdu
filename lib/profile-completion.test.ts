import assert from "node:assert/strict";
import test from "node:test";

import { getPostAuthRedirect, getPostProfileCompletionPath, getSafeNextPath } from "./profile-completion";

test("post-auth redirects preserve safe destinations for customers and admins", () => {
  const telegram = "/telegram/connect?token=" + "a".repeat(43);
  assert.equal(getPostAuthRedirect({ role: "user" }, telegram), telegram);
  assert.equal(getPostAuthRedirect({ role: "user", isExco: true }, telegram), telegram);
  assert.equal(getPostAuthRedirect({ role: "user", excoRole: "CFO" }, "/dashboard/orders?tab=open"), "/dashboard/orders?tab=open");
  assert.equal(getPostAuthRedirect({ role: "admin" }, "/admin/users"), "/admin/users");
});

test("taskers always land on the tasker dashboard after sign-in or profile completion", () => {
  const taskDetail = "/tasker-dashboard/EXAMPLE_ID?preview=true";
  const tasker = { role: "tasker" };

  assert.equal(getPostAuthRedirect(tasker, taskDetail), "/tasker-dashboard");
  assert.equal(getPostProfileCompletionPath(tasker, taskDetail), "/tasker-dashboard");
  assert.equal(getPostAuthRedirect(tasker, "/tasker-dashboard/payment/EXAMPLE_ID"), "/tasker-dashboard");
});

test("external and ambiguous callback paths are rejected", () => {
  assert.equal(getSafeNextPath("https://evil.example/steal"), null);
  assert.equal(getSafeNextPath("//evil.example/steal"), null);
  assert.equal(getSafeNextPath("/\\evil.example/steal"), null);
  assert.equal(getPostAuthRedirect({ role: "user" }, "https://evil.example"), "/");
});