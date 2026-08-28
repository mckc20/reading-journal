import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth.js";
import { getBookId, getProgressPercent } from "../../_lib/books.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin.js";

const BOOK_FIELDS = "id, title, status, current_page, total_pages, date_started, date_finished";
const LAST_SESSION_FIELDS = "current_page, reading_time_minutes, logged_at";

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

    const bookId = getBookId(request);
    if (!bookId) {
      json(response, 404, { error: "Book not found." });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data: book, error: bookError } = await admin
      .from("books")
      .select(BOOK_FIELDS)
      .eq("id", bookId)
      .eq("user_id", userId)
      .maybeSingle();

    if (bookError) throw bookError;
    if (!book) {
      json(response, 404, { error: "Book not found." });
      return;
    }

    const { data: lastSession, error: logError } = await admin
      .from("reading_logs")
      .select(LAST_SESSION_FIELDS)
      .eq("book_id", book.id)
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (logError) throw logError;

    json(response, 200, {
      book_id: book.id,
      title: book.title,
      status: book.status,
      current_page: book.current_page,
      total_pages: book.total_pages,
      percent: getProgressPercent(book.current_page, book.total_pages),
      date_started: book.date_started,
      date_finished: book.date_finished,
      last_session: lastSession,
    });
  } catch (error) {
    console.error("GET /api/books/:id/progress failed", error);
    json(response, 500, { error: "Internal server error." });
  }
}
