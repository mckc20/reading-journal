import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../_lib/auth.js";
import {
  addAutomaticStatusDates,
  API_BOOK_FIELDS,
  getBookId,
  parseBookUpdatePayload,
  toApiBook,
} from "../_lib/books.js";
import { json, methodNotAllowed } from "../_lib/http.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

const DATE_FIELDS = "date_started, date_finished";

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
  if (request.method !== "PATCH") {
    methodNotAllowed(response, "PATCH");
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

    let requestedUpdate;
    try {
      requestedUpdate = parseBookUpdatePayload(parseRequestBody(request.body));
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : "Invalid request body." });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data: existingBook, error: existingBookError } = await admin
      .from("books")
      .select(DATE_FIELDS)
      .eq("id", bookId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingBookError) throw existingBookError;
    if (!existingBook) {
      json(response, 404, { error: "Book not found." });
      return;
    }

    const update = addAutomaticStatusDates(requestedUpdate, existingBook, getTodayLocalDate());
    if (Object.keys(update).length === 0) {
      const { data: book, error: bookError } = await admin
        .from("books")
        .select(API_BOOK_FIELDS)
        .eq("id", bookId)
        .eq("user_id", userId)
        .maybeSingle();

      if (bookError) throw bookError;
      if (!book) {
        json(response, 404, { error: "Book not found." });
        return;
      }

      json(response, 200, toApiBook(book));
      return;
    }

    const { data: book, error: updateError } = await admin
      .from("books")
      .update(update)
      .eq("id", bookId)
      .eq("user_id", userId)
      .select(API_BOOK_FIELDS)
      .maybeSingle();

    if (updateError) throw updateError;
    if (!book) {
      json(response, 404, { error: "Book not found." });
      return;
    }

    json(response, 200, toApiBook(book));
  } catch (error) {
    console.error("PATCH /api/books/:id failed", error);
    json(response, 500, { error: "Internal server error." });
  }
}
