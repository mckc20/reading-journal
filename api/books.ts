import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "./_lib/auth.js";
import { parseBookListOptions, toApiBook } from "./_lib/books.js";
import { json, methodNotAllowed } from "./_lib/http.js";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

const BOOK_FIELDS = "id, title, status, current_page, total_pages, book_authors(position, authors(name))";

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

    let options;
    try {
      options = parseBookListOptions(request);
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : "Invalid query parameters." });
      return;
    }

    const admin = getSupabaseAdmin();
    let query = admin
      .from("books")
      .select(BOOK_FIELDS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(options.limit);

    if (options.status) query = query.eq("status", options.status);

    const { data, error } = await query;
    if (error) throw error;

    json(response, 200, (data ?? []).map(toApiBook));
  } catch (error) {
    console.error("GET /api/books failed", error);
    json(response, 500, { error: "Internal server error." });
  }
}
