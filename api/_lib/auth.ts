import { createHash } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

type ApiKeyAuthRow = {
  id: string;
  user_id: string;
};

export function getBearerToken(authorization: string | string[] | undefined): string | null {
  if (typeof authorization !== "string") return null;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export async function authenticate(request: VercelRequest): Promise<string | null> {
  const rawKey = getBearerToken(request.headers.authorization);
  if (!rawKey) return null;

  const admin = getSupabaseAdmin();
  const keyHash = hashApiKey(rawKey);
  const { data, error } = await admin
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle<ApiKeyAuthRow>();

  if (error) throw error;
  if (!data) return null;

  const { error: updateError } = await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  if (updateError) throw updateError;

  return data.user_id;
}

/** Verify a short-lived Supabase web session token. Kept separate from API-key auth. */
export async function authenticateUserSession(
  request: VercelRequest,
  verify: (accessToken: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>
    = (accessToken) => getSupabaseAdmin().auth.getUser(accessToken),
): Promise<string | null> {
  const accessToken = getBearerToken(request.headers.authorization);
  if (!accessToken) return null;

  const { data, error } = await verify(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}
