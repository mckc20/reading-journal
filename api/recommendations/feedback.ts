import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUserSession } from "../_lib/auth.js";
import { json, methodNotAllowed } from "../_lib/http.js";
import { recommendationCandidateKey } from "../_lib/recommendations.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import type { RecommendationItem } from "../../src/types/recommendations.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST" && request.method !== "DELETE") {
    methodNotAllowed(response, "POST, DELETE");
    return;
  }

  try {
    const userId = await authenticateUserSession(request);
    if (!userId) {
      json(response, 401, { error: "A valid signed-in session is required." });
      return;
    }

    const admin = getSupabaseAdmin();
    if (request.method === "DELETE") {
      const candidateKey = typeof request.body?.candidate_key === "string" ? request.body.candidate_key : "";
      if (!candidateKey) {
        json(response, 400, { error: "A recommendation key is required." });
        return;
      }
      const { error } = await admin.from("recommendation_feedback")
        .delete().eq("user_id", userId).eq("candidate_key", candidateKey);
      if (error) throw error;
    } else {
      const item = request.body?.item as RecommendationItem | undefined;
      if (!isRecommendationItem(item)) {
        json(response, 400, { error: "A valid recommendation is required." });
        return;
      }
      const candidateKey = recommendationCandidateKey(item);
      const { error } = await admin.from("recommendation_feedback").upsert({
        user_id: userId,
        candidate_key: candidateKey,
        title: item.title.slice(0, 500),
        authors: item.authors.slice(0, 20),
        genres: item.genres.slice(0, 40),
        item,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,candidate_key" });
      if (error) throw error;
    }

    const { data, error } = await admin.from("recommendation_feedback")
      .select("candidate_key,title,authors,genres,item")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    json(response, 200, { feedback: data ?? [] });
  } catch (error) {
    console.error("Recommendation feedback API failed", error instanceof Error ? error.message : "unknown error");
    json(response, 500, { error: "Could not save recommendation feedback." });
  }
}

function isRecommendationItem(value: unknown): value is RecommendationItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecommendationItem>;
  return typeof item.id === "string" && typeof item.title === "string" &&
    Array.isArray(item.authors) && item.authors.every((author) => typeof author === "string") &&
    Array.isArray(item.genres) && item.genres.every((genre) => typeof genre === "string") &&
    typeof item.sourceUrl === "string" && typeof item.source === "string";
}
