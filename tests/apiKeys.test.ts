import assert from "node:assert/strict";
import test from "node:test";
import { generateApiKey, getApiKeyPrefix, hashApiKey } from "../src/lib/apiKeys";

test("generates URL-safe Reading Journal API keys", () => {
  const key = generateApiKey();

  assert.match(key, /^rjk_live_[A-Za-z0-9_-]{32}$/);
  assert.notEqual(key, generateApiKey());
});

test("derives a safe display prefix without exposing the full key", () => {
  assert.equal(getApiKeyPrefix("rjk_live_abc123456789"), "rjk_live_abc");
});

test("hashes API keys with SHA-256 hex", async () => {
  assert.equal(
    await hashApiKey("rjk_live_test"),
    "37c65818160c0ea144643d76730eb4a1cf1d0f0d17b0789eb2be7ee58f017d67",
  );
});
