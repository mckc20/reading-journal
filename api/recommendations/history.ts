import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUserSession } from "../_lib/auth.js";
import { json, methodNotAllowed } from "../_lib/http.js";
import { recommendationCandidateKey } from "../_lib/recommendations.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import type { RecommendationItem } from "../../src/types/recommendations.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") {
    methodNotAllowed(response, "POST");
    return;
  }

  try {
    const userId = await authenticateUserSession(request);
    if (!userId) {
      json(response, 401, { error: "A valid signed-in session is required." });
      return;
    }
    const requestedKeys: unknown[] = Array.isArray(request.body?.candidate_keys) ? request.body.candidate_keys : [];
    const candidateKeys = [...new Set(requestedKeys.filter((key): key is string => typeof key === "string"))];
    if (candidateKeys.length === 0) {
      json(response, 200, { recorded: 0 });
      return;
    }

    const admin = getSupabaseAdmin();
    const [setResult, feedbackResult] = await Promise.all([
      admin.from("recommendation_sets").select("items").eq("user_id", userId).maybeSingle<{ items: unknown }>(),
      admin.from("recommendation_feedback").select("item").eq("user_id", userId),
    ]);
    if (setResult.error) throw setResult.error;
    if (feedbackResult.error) throw feedbackResult.error;
    const items = [
      ...(Array.isArray(setResult.data?.items) ? setResult.data.items : []),
      ...(feedbackResult.data ?? []).map((row) => row.item),
    ].filter(isRecommendationItem);
    const byKey = new Map(items.map((item) => [recommendationCandidateKey(item), item]));
    const now = new Date().toISOString();
    const rows = candidateKeys.flatMap((candidate_key) => {
      const item = byKey.get(candidate_key);
      return item ? [{ user_id: userId, candidate_key, item, last_seen_at: now }] : [];
    });
    if (rows.length > 0) {
      const { error } = await admin.from("recommendation_history").upsert(rows, { onConflict: "user_id,candidate_key" });
      if (error) throw error;
    }
    json(response, 200, { recorded: rows.length });
  } catch (error) {
    console.error("Recommendation history API failed", error instanceof Error ? error.message : "unknown error");
    json(response, 500, { error: "Could not record displayed recommendations." });
  }
}

function isRecommendationItem(value: unknown): value is RecommendationItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecommendationItem>;
  return typeof item.id === "string" && typeof item.title === "string" &&
    Array.isArray(item.authors) && Array.isArray(item.genres) &&
    typeof item.sourceUrl === "string" && typeof item.source === "string";
}
