import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "./_lib/auth.js";
import { json, methodNotAllowed } from "./_lib/http.js";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET") {
    methodNotAllowed(response, "GET");
    return;
  }

  try {
    const userId = await authenticate(request);
    if (!userId) {
      json(response, 401, { error: "Unauthorized." });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!profile) {
      json(response, 404, { error: "Profile not found." });
      return;
    }

    json(response, 200, {
      user_id: userId,
      display_name: profile.display_name,
      username: profile.username,
    });
  } catch (error) {
    console.error("GET /api/me failed", error);
    json(response, 500, { error: "Internal server error." });
  }
}
