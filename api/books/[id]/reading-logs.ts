import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth.js";
import { getBookId, getProgressPercent, parseReadingLogPayload } from "../../_lib/books.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin.js";

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

    const { data, error } = await getSupabaseAdmin().rpc("save_legacy_reading_log", {
      owner_id: userId,
      target_book: bookId,
      requested_page: payload.current_page,
      minutes: payload.reading_time_minutes,
      activity_at: payload.logged_at ?? null,
      today: getTodayLocalDate(),
    });

    if (error?.code === "P0002" || error?.code === "22023") {
      json(response, error.code === "P0002" ? 404 : 400, { error: error.message });
      return;
    }
    if (error) throw error;

    json(response, 201, {
      log: data.log,
      book: {
        ...data.book,
        percent: getProgressPercent(data.book.current_page, data.book.total_pages),
      },
    });
  } catch (error) {
    console.error("POST /api/books/:id/reading-logs failed", error);
    json(response, 500, { error: "Internal server error." });
  }
}
