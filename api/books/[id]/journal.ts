import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate } from "../../_lib/auth.js";
import { getBookId, parseBookJournalPayload } from "../../_lib/books.js";
import { json, methodNotAllowed } from "../../_lib/http.js";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin.js";

const ENTRY_FIELDS = "id, public_id, label, attribution, content, tags, page_start, is_favorite, entry_date, created_at, updated_at";

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
      payload = parseBookJournalPayload(parseRequestBody(request.body));
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : "Invalid request body." });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data: book, error: bookError } = await admin
      .from("books")
      .select("id")
      .eq("id", bookId)
      .eq("user_id", userId)
      .maybeSingle();

    if (bookError) throw bookError;
    if (!book) {
      json(response, 404, { error: "Book not found." });
      return;
    }

    const { data: entry, error: insertError } = await admin
      .from("book_journal")
      .insert({
        user_id: userId,
        book_id: bookId,
        label: payload.label,
        attribution: payload.quote_speaker,
        content: payload.content,
        tags: payload.tags,
        page_start: payload.page_start,
        is_favorite: false,
        entry_date: getTodayLocalDate(),
      })
      .select(ENTRY_FIELDS)
      .single();

    if (insertError) throw insertError;

    json(response, 201, {
      id: entry.id,
      public_id: entry.public_id,
      label: entry.label,
      content: entry.content,
      quote_speaker: entry.label === "quote" ? entry.attribution : null,
      page_start: entry.page_start,
      tags: entry.tags,
      entry_date: entry.entry_date,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    });
  } catch (error) {
    console.error("POST /api/books/:id/journal failed", error);
    json(response, 500, { error: "Internal server error." });
  }
}
