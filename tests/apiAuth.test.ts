import assert from "node:assert/strict";
import test from "node:test";
import { getBearerToken, hashApiKey } from "../api/_lib/auth";

test("reads a bearer API key from an Authorization header", () => {
  assert.equal(getBearerToken("Bearer rjk_live_example"), "rjk_live_example");
  assert.equal(getBearerToken("bearer   rjk_live_example  "), "rjk_live_example");
});

test("rejects missing or malformed Authorization headers", () => {
  assert.equal(getBearerToken(undefined), null);
  assert.equal(getBearerToken(["Bearer rjk_live_example"]), null);
  assert.equal(getBearerToken("Basic rjk_live_example"), null);
  assert.equal(getBearerToken("Bearer"), null);
});

test("uses the same SHA-256 hex representation as browser key creation", () => {
  assert.equal(
    hashApiKey("rjk_live_test"),
    "37c65818160c0ea144643d76730eb4a1cf1d0f0d17b0789eb2be7ee58f017d67",
  );
});
