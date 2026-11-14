import assert from "node:assert/strict";
import test from "node:test";

import { getPostAuthRedirect, getPostProfileCompletionPath, getSafeNextPath, getSignedInDestination } from "./profile-completion";

test("returning users receive the centralized role-aware destination", () => {
  assert.equal(getSignedInDestination({ role: "tasker" }), "/tasker-dashboard");
  assert.equal(getSignedInDestination({ role: "user" }), "/dashboard");
  assert.equal(getSignedInDestination({ role: "admin" }), "/admin");
  assert.equal(getSignedInDestination({ role: "user", excoRole: "CFO" }), "/admin");
});

test("post-auth redirects preserve safe destinations for customers and admins", () => {
  const telegram = "/telegram/connect?token=" + "a".repeat(43);
  assert.equal(getPostAuthRedirect({ role: "user" }, telegram), telegram);
  assert.equal(getPostAuthRedirect({ role: "user", isExco: true }, telegram), telegram);
  assert.equal(getPostAuthRedirect({ role: "user", excoRole: "CFO" }, "/dashboard/orders?tab=open"), "/dashboard/orders?tab=open");
  assert.equal(getPostAuthRedirect({ role: "admin" }, "/admin/users"), "/admin/users");
});

test("taskers retain tasker deep links and otherwise land on the tasker dashboard", () => {
  const taskDetail = "/tasker-dashboard/EXAMPLE_ID?preview=true";
  const tasker = { role: "tasker" };

  assert.equal(getPostAuthRedirect(tasker, taskDetail), taskDetail);
  assert.equal(getPostProfileCompletionPath(tasker, taskDetail), taskDetail);
  assert.equal(getPostAuthRedirect(tasker, "/tasker-dashboard/payment/EXAMPLE_ID"), "/tasker-dashboard/payment/EXAMPLE_ID");
  assert.equal(getPostAuthRedirect(tasker, "/dashboard"), "/tasker-dashboard");
});

test("external and ambiguous callback paths are rejected", () => {
  assert.equal(getSafeNextPath("https://evil.example/steal"), null);
  assert.equal(getSafeNextPath("//evil.example/steal"), null);
  assert.equal(getSafeNextPath("/\\evil.example/steal"), null);
  assert.equal(getPostAuthRedirect({ role: "user" }, "https://evil.example"), "/dashboard");
});
