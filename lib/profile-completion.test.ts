import assert from "node:assert/strict";
import test from "node:test";

import { getPostAuthRedirect, getSafeNextPath } from "./profile-completion";

test("post-auth redirects preserve safe Telegram and ordinary deep links for every account type", () => {
  const telegram = "/telegram/connect?token=" + "a".repeat(43);
  assert.equal(getPostAuthRedirect({ role: "user" }, telegram), telegram);
  assert.equal(getPostAuthRedirect({ role: "user", isExco: true }, telegram), telegram);
  assert.equal(getPostAuthRedirect({ role: "user", excoRole: "CFO" }, "/dashboard/orders?tab=open"), "/dashboard/orders?tab=open");
});

test("external and ambiguous callback paths are rejected", () => {
  assert.equal(getSafeNextPath("https://evil.example/steal"), null);
  assert.equal(getSafeNextPath("//evil.example/steal"), null);
  assert.equal(getSafeNextPath("/\\evil.example/steal"), null);
  assert.equal(getPostAuthRedirect({ role: "user" }, "https://evil.example"), "/");
});