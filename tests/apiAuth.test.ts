import assert from "node:assert/strict";
import test from "node:test";
import { authenticateUserSession, getBearerToken, hashApiKey } from "../api/_lib/auth";
import type { VercelRequest } from "@vercel/node";

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

test("verifies Supabase session tokens separately from programmatic API keys", async () => {
  let verifiedToken = "";
  const request = { headers: { authorization: "Bearer eyJ-user-session" } } as VercelRequest;
  const userId = await authenticateUserSession(request, async (token) => {
    verifiedToken = token;
    return { data: { user: { id: "user-123" } }, error: null };
  });
  assert.equal(verifiedToken, "eyJ-user-session");
  assert.equal(userId, "user-123");
});

test("rejects absent or invalid Supabase session tokens", async () => {
  const verify = async () => ({ data: { user: null }, error: new Error("invalid token") });
  assert.equal(await authenticateUserSession({ headers: {} } as VercelRequest, verify), null);
  assert.equal(await authenticateUserSession({ headers: { authorization: "Bearer bad-token" } } as VercelRequest, verify), null);
});
