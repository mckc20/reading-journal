import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUserSession } from "../_lib/auth.js";
import { json, methodNotAllowed } from "../_lib/http.js";
import { recommendationCandidateKey } from "../_lib/recommendations.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import type { RecommendationItem } from "../../src/types/recommendations.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") { methodNotAllowed(response, "POST"); return; }
  try {
    const userId = await authenticateUserSession(request);
    const item = request.body?.item as RecommendationItem | undefined;
    if (!userId || !item || typeof item.title !== "string" || !Array.isArray(item.authors)) { json(response, 400, { error: "A valid recommendation is required." }); return; }
    const { error } = await getSupabaseAdmin().from("recommendation_dismissals").upsert({ user_id: userId, candidate_key: recommendationCandidateKey(item) }, { onConflict: "user_id,candidate_key" });
    if (error) throw error;
    json(response, 200, { dismissed: true });
  } catch (error) {
    console.error("Recommendation dismissal API failed", error instanceof Error ? error.message : "unknown error");
    json(response, 500, { error: "Could not remove this recommendation." });
  }
}
