import type { ApiKeySummary } from "@/types";

const API_KEY_START = "rjk_live_";
const API_KEY_SECRET_LENGTH = 32;
const API_KEY_PREFIX_LENGTH = 12;

type ApiKeyRow = ApiKeySummary;

export type CreatedApiKey = {
  key: ApiKeySummary;
  rawKey: string;
};

async function getSupabase() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure key generation is unavailable in this browser.");
  }

  return globalThis.crypto;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
}

function normalizeApiKeyRow(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    created_at: row.created_at,
    last_used_at: row.last_used_at ?? null,
  };
}

export function getApiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, API_KEY_PREFIX_LENGTH);
}

export function generateApiKey(): string {
  const crypto = requireWebCrypto();
  const randomBytes = crypto.getRandomValues(new Uint8Array(24));
  const secret = toBase64Url(randomBytes);

  if (secret.length !== API_KEY_SECRET_LENGTH) {
    throw new Error("Could not generate a secure API key.");
  }

  return `${API_KEY_START}${secret}`;
}

export async function hashApiKey(rawKey: string): Promise<string> {
  const crypto = requireWebCrypto();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createApiKey(userId: string, name: string): Promise<CreatedApiKey> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("A name is required for this API key.");

  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      name: cleanName,
      key_prefix: getApiKeyPrefix(rawKey),
      key_hash: keyHash,
    })
    .select("id, name, key_prefix, created_at, last_used_at")
    .single();

  if (error) throw error;

  return { key: normalizeApiKeyRow(data), rawKey };
}

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const supabase = await getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("You must be signed in to manage API keys.");

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(normalizeApiKeyRow);
}

export async function revokeApiKey(id: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);

  if (error) throw error;
}
