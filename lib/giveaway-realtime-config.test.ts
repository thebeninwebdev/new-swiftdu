import assert from "node:assert/strict";
import test from "node:test";
import {
  getGiveawayAllowedOrigins,
  isGiveawayOriginAllowed,
} from "@/lib/giveaway-realtime-config";

test("parses only exact valid configured origins", () => {
  assert.deepEqual(
    getGiveawayAllowedOrigins(
      "https://swiftdu.org, https://www.swiftdu.org, invalid, https://swiftdu.org/path",
    ),
    ["https://swiftdu.org", "https://www.swiftdu.org"],
  );
});

test("production allows configured origins and non-browser clients only", () => {
  const allowed = ["https://swiftdu.org"];
  assert.equal(
    isGiveawayOriginAllowed("https://swiftdu.org", allowed, false),
    true,
  );
  assert.equal(
    isGiveawayOriginAllowed("https://preview.vercel.app", allowed, false),
    false,
  );
  assert.equal(isGiveawayOriginAllowed(undefined, allowed, false), true);
});

test("development additionally permits local HTTP origins", () => {
  assert.equal(
    isGiveawayOriginAllowed("http://localhost:3000", [], true),
    true,
  );
  assert.equal(
    isGiveawayOriginAllowed("http://127.0.0.1:3000", [], true),
    true,
  );
  assert.equal(
    isGiveawayOriginAllowed("https://unconfigured.example", [], true),
    false,
  );
});
