import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth.js";
import { getBookId, getProgressPercent, getReadingLogBookUpdate, parseReadingLogPayload } from "../../_lib/books.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin.js";

const BOOK_FIELDS = "id, status, current_page, total_pages, date_started, date_finished";
const LOG_FIELDS = "id, current_page, reading_time_minutes, logged_at";

function getTodayLocalDate(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function parseRequestBody(body: unknown): unknown {
  if (typeof body !== "string") return body;

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") {
    methodNotAllowed(response, "POST");
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

    let payload;
    try {
      payload = parseReadingLogPayload(parseRequestBody(request.body));
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : "Invalid request body." });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data: existingBook, error: bookError } = await admin
      .from("books")
      .select(BOOK_FIELDS)
      .eq("id", bookId)
      .eq("user_id", userId)
      .maybeSingle();

    if (bookError) throw bookError;
    if (!existingBook) {
      json(response, 404, { error: "Book not found." });
      return;
    }

    const { data: log, error: insertError } = await admin
      .from("reading_logs")
      .insert({
        book_id: bookId,
        user_id: userId,
        current_page: payload.current_page,
        reading_time_minutes: payload.reading_time_minutes,
        ...(payload.logged_at ? { logged_at: payload.logged_at } : {}),
      })
      .select(LOG_FIELDS)
      .single();

    if (insertError) throw insertError;

    if (existingBook.status === "Paused") {
      const { error: resumeError } = await admin
        .from("book_pause_periods")
        .update({ resumed_at: new Date().toISOString() })
        .eq("book_id", bookId)
        .eq("user_id", userId)
        .is("resumed_at", null);

      if (resumeError) {
        console.error("POST /api/books/:id/reading-logs could not resume paused book", resumeError);
        json(response, 500, { error: "Reading session was saved, but the paused book could not be resumed." });
        return;
      }
    }

    const bookUpdate = getReadingLogBookUpdate(existingBook, payload.current_page, getTodayLocalDate());
    const { data: updatedBook, error: updateError } = await admin
      .from("books")
      .update(bookUpdate)
      .eq("id", bookId)
      .eq("user_id", userId)
      .select(BOOK_FIELDS)
      .maybeSingle();

    if (updateError || !updatedBook) {
      if (updateError) console.error("POST /api/books/:id/reading-logs could not update book", updateError);
      json(response, 500, { error: "Reading session was saved, but the book progress could not be updated." });
      return;
    }

    json(response, 201, {
      log,
      book: {
        id: updatedBook.id,
        status: updatedBook.status,
        current_page: updatedBook.current_page,
        total_pages: updatedBook.total_pages,
        percent: getProgressPercent(updatedBook.current_page, updatedBook.total_pages),
      },
    });
  } catch (error) {
    console.error("POST /api/books/:id/reading-logs failed", error);
    json(response, 500, { error: "Internal server error." });
  }
}
