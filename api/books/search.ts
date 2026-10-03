import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth.js";
import { parseBookSearchQuery, parseBookListOptions, toApiBook } from "../_lib/books.js";
import { json, methodNotAllowed } from "../_lib/http.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

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

    let searchQuery;
    let options;
    try {
      searchQuery = parseBookSearchQuery(request);
      options = parseBookListOptions(request);
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : "Invalid search query." });
      return;
    }

    const admin = getSupabaseAdmin();
    let query = admin
      .from("books")
      .select(BOOK_FIELDS)
      .eq("user_id", userId)
      .ilike("title", `%${searchQuery}%`)
      .order("created_at", { ascending: false })
      .limit(options.limit);
    query = options.status ? query.eq("status", options.status) : query.neq("status", "Wishlist");
    const { data, error } = await query;

    if (error) throw error;

    json(response, 200, (data ?? []).map(toApiBook));
  } catch (error) {
    console.error("GET /api/books/search failed", error);
    json(response, 500, { error: "Internal server error." });
  }
}
