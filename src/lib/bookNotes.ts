import type { BookNote, BookNoteLabel } from "@/types";

export interface CreateBookNoteInput {
  bookId: string;
  userId: string;
  label: BookNoteLabel;
  title?: string;
  quoteSpeaker?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  noteDate?: string | null;
  isFavorite?: boolean;
}

export interface BookNoteFieldsInput {
  label: BookNoteLabel;
  title?: string;
  quoteSpeaker?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  noteDate?: string | null;
  isFavorite?: boolean;
}

export interface NormalizedBookNoteInput {
  book_id: string;
  user_id: string;
  label: BookNoteLabel;
  title: string | null;
  quote_speaker: string | null;
  content: string;
  tags?: string[];
  page_start: number | null;
  is_favorite: boolean;
  note_date: string;
}

export interface NormalizedBookNoteFields {
  label: BookNoteLabel;
  title: string | null;
  quote_speaker: string | null;
  content: string;
  tags?: string[] | null;
  page_start: number | null;
  is_favorite: boolean;
  note_date: string;
}

export interface UpdateBookNoteInput extends BookNoteFieldsInput {
  noteId: string;
}

export function getProgressNoteDate(
  showLoggedAtEditor: boolean,
  selectedLoggedAt: string,
): string | null {
  if (!showLoggedAtEditor || !selectedLoggedAt) return null;

  const noteDate = selectedLoggedAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(noteDate) ? noteDate : null;
}

function normalizePageValue(
  value: string | number | null | undefined,
  fieldLabel: string,
): number | null {
  if (value === null || value === undefined) return null;

  const normalizedValue = typeof value === "string" ? value.trim() : value;
  if (normalizedValue === "") return null;

  const page =
    typeof normalizedValue === "number" ? normalizedValue : Number(normalizedValue);

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`${fieldLabel} must be a whole page number greater than 0`);
  }

  return page;
}

function getTodayLocalDate(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function normalizeNoteDate(value: string | null | undefined): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return getTodayLocalDate();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new Error("Note date must use the YYYY-MM-DD format");
  }

  return normalizedValue;
}

function normalizeTags(value: string[] | null | undefined): string[] | null {
  if (!value) return null;
  const tags = value
    .map((tag) => tag.trim())
    .filter(Boolean);
  const uniqueTags = Array.from(new Set(tags));
  return uniqueTags.length > 0 ? uniqueTags : null;
}

export function bookNoteErrorToError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return new Error(message);
    }
  }

  return new Error("Book note request failed");
}

function isMissingTagsColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return message.includes("'tags' column") || message.includes('"tags" column');
}

export function formatBookNotePageRange(
  note: Pick<BookNote, "page_start">,
): string | null {
  if (!note.page_start) return null;
  return `p. ${note.page_start}`;
}

export function normalizeBookNoteFields(
  input: BookNoteFieldsInput,
): NormalizedBookNoteFields {
  const content = input.content.trim();
  const pageStart = normalizePageValue(input.pageStart, "Start page");
  const normalizedTags = normalizeTags(input.tags);

  if (!content) {
    throw new Error("Note content is required");
  }

  const fields: NormalizedBookNoteFields = {
    label: input.label,
    title: input.label === "quote" ? null : input.title?.trim() || null,
    quote_speaker:
      input.label === "quote" ? input.quoteSpeaker?.trim() || null : null,
    content,
    page_start: pageStart,
    is_favorite: Boolean(input.isFavorite),
    note_date: normalizeNoteDate(input.noteDate),
  };

  if (Object.prototype.hasOwnProperty.call(input, "tags")) {
    fields.tags = normalizedTags;
  }

  return fields;
}

export function normalizeBookNoteInput(
  input: CreateBookNoteInput,
): NormalizedBookNoteInput {
  const { tags, ...fields } = normalizeBookNoteFields(input);
  const payload: NormalizedBookNoteInput = {
    book_id: input.bookId,
    user_id: input.userId,
    ...fields,
  };

  if (tags) {
    payload.tags = tags;
  }

  return payload;
}

export function sortBookNotes(notes: BookNote[]): BookNote[] {
  return [...notes].sort((a, b) => {
    const aDate = a.note_date ?? a.created_at;
    const bDate = b.note_date ?? b.created_at;
    const dateCompare = bDate.localeCompare(aDate);
    if (dateCompare !== 0) return dateCompare;
    return b.created_at.localeCompare(a.created_at);
  });
}

export async function fetchBookNotes(bookId: string): Promise<BookNote[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("book_notes")
    .select("*")
    .eq("book_id", bookId)
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw bookNoteErrorToError(error);
  return sortBookNotes((data ?? []) as BookNote[]);
}

export async function fetchAllBookNotes(): Promise<BookNote[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("book_notes")
    .select("*")
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw bookNoteErrorToError(error);
  return sortBookNotes((data ?? []) as BookNote[]);
}

export async function createBookNote(
  input: CreateBookNoteInput,
): Promise<BookNote> {
  const { supabase } = await import("./supabase");
  const payload = normalizeBookNoteInput(input);
  let { data, error } = await supabase
    .from("book_notes")
    .insert(payload)
    .select()
    .single();

  if (error && "tags" in payload && isMissingTagsColumnError(error)) {
    const { tags: _tags, ...payloadWithoutTags } = payload;
    const retry = await supabase
      .from("book_notes")
      .insert(payloadWithoutTags)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw bookNoteErrorToError(error);
  return data as BookNote;
}

export async function updateBookNote(
  input: UpdateBookNoteInput,
): Promise<BookNote> {
  const { supabase } = await import("./supabase");
  const payload = normalizeBookNoteFields(input);
  let { data, error } = await supabase
    .from("book_notes")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.noteId)
    .select()
    .single();

  if (error && "tags" in payload && isMissingTagsColumnError(error)) {
    const { tags: _tags, ...payloadWithoutTags } = payload;
    const retry = await supabase
      .from("book_notes")
      .update({
        ...payloadWithoutTags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.noteId)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw bookNoteErrorToError(error);
  return data as BookNote;
}

export async function updateBookNoteFavorite(
  noteId: string,
  isFavorite: boolean,
): Promise<BookNote> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("book_notes")
    .update({
      is_favorite: isFavorite,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .eq("label", "quote")
    .select()
    .single();

  if (error) throw bookNoteErrorToError(error);
  return data as BookNote;
}

export async function deleteBookNote(noteId: string): Promise<void> {
  const { supabase } = await import("./supabase");
  const { error } = await supabase.from("book_notes").delete().eq("id", noteId);

  if (error) throw bookNoteErrorToError(error);
}
