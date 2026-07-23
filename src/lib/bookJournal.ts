import type { BookJournalEntryRecord, JournalEntryLabel } from "@/types";

export interface CreateBookJournalEntryRecordInput {
  bookId: string;
  userId: string;
  label: JournalEntryLabel;
  attribution?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  noteDate?: string | null;
  isFavorite?: boolean;
  parentEntryId?: string | null;
}

export interface BookJournalEntryRecordFieldsInput {
  label: JournalEntryLabel;
  attribution?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  noteDate?: string | null;
  isFavorite?: boolean;
  parentEntryId?: string | null;
}

export interface NormalizedBookJournalEntryRecordInput {
  book_id: string;
  user_id: string;
  label: JournalEntryLabel;
  attribution: string | null;
  content: string;
  tags?: string[];
  page_start: number | null;
  is_favorite: boolean;
  entry_date: string;
  parent_entry_id?: string | null;
}

export interface NormalizedBookJournalEntryRecordFields {
  label: JournalEntryLabel;
  attribution: string | null;
  content: string;
  tags?: string[] | null;
  page_start: number | null;
  is_favorite: boolean;
  entry_date: string;
  parent_entry_id?: string | null;
}

export interface UpdateBookJournalEntryRecordInput extends BookJournalEntryRecordFieldsInput {
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

export function bookJournalEntryErrorToError(error: unknown): Error {
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

export function formatBookJournalEntryRecordPageRange(
  note: Pick<BookJournalEntryRecord, "page_start">,
): string | null {
  if (!note.page_start) return null;
  return `p. ${note.page_start}`;
}

export function normalizeBookJournalEntryRecordFields(
  input: BookJournalEntryRecordFieldsInput,
): NormalizedBookJournalEntryRecordFields {
  const content = input.content.trim();
  const pageStart = normalizePageValue(input.pageStart, "Start page");
  const normalizedTags = normalizeTags(input.tags);

  if (!content) {
    throw new Error("Note content is required");
  }

  const fields: NormalizedBookJournalEntryRecordFields = {
    label: input.label,
    attribution:
      input.label === "quote" ? input.attribution?.trim() || null : null,
    content,
    page_start: pageStart,
    is_favorite: Boolean(input.isFavorite),
    entry_date: normalizeNoteDate(input.noteDate),
  };

  if (Object.prototype.hasOwnProperty.call(input, "tags")) {
    fields.tags = normalizedTags;
  }

  if (Object.prototype.hasOwnProperty.call(input, "parentEntryId")) {
    fields.parent_entry_id = input.parentEntryId ?? null;
  }

  return fields;
}

export function normalizeBookJournalEntryRecordInput(
  input: CreateBookJournalEntryRecordInput,
): NormalizedBookJournalEntryRecordInput {
  const { tags, ...fields } = normalizeBookJournalEntryRecordFields(input);
  const payload: NormalizedBookJournalEntryRecordInput = {
    book_id: input.bookId,
    user_id: input.userId,
    ...fields,
  };

  if (tags) {
    payload.tags = tags;
  }

  if (input.parentEntryId) {
    payload.parent_entry_id = input.parentEntryId;
  }

  return payload;
}

export function sortBookJournalEntryRecords(journalEntries: BookJournalEntryRecord[]): BookJournalEntryRecord[] {
  return [...journalEntries].sort((a, b) => {
    const aDate = a.entry_date ?? a.created_at;
    const bDate = b.entry_date ?? b.created_at;
    const dateCompare = bDate.localeCompare(aDate);
    if (dateCompare !== 0) return dateCompare;
    return b.created_at.localeCompare(a.created_at);
  });
}

export async function fetchBookJournalEntryRecords(bookId: string): Promise<BookJournalEntryRecord[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("book_journal")
    .select("*")
    .eq("book_id", bookId)
    .is("parent_entry_id", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw bookJournalEntryErrorToError(error);
  return sortBookJournalEntryRecords((data ?? []) as BookJournalEntryRecord[]);
}

export async function fetchAllBookJournalEntryRecords(): Promise<BookJournalEntryRecord[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("book_journal")
    .select("*")
    .is("parent_entry_id", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw bookJournalEntryErrorToError(error);
  return sortBookJournalEntryRecords((data ?? []) as BookJournalEntryRecord[]);
}

export async function createBookJournalEntryRecord(
  input: CreateBookJournalEntryRecordInput,
): Promise<BookJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const payload = normalizeBookJournalEntryRecordInput(input);
  let { data, error } = await supabase
    .from("book_journal")
    .insert(payload)
    .select()
    .single();

  if (error && "tags" in payload && isMissingTagsColumnError(error)) {
    const { tags: _tags, ...payloadWithoutTags } = payload;
    const retry = await supabase
      .from("book_journal")
      .insert(payloadWithoutTags)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw bookJournalEntryErrorToError(error);
  return data as BookJournalEntryRecord;
}

export async function updateBookJournalEntryRecord(
  input: UpdateBookJournalEntryRecordInput,
): Promise<BookJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const payload = normalizeBookJournalEntryRecordFields(input);
  let { data, error } = await supabase
    .from("book_journal")
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
      .from("book_journal")
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

  if (error) throw bookJournalEntryErrorToError(error);
  return data as BookJournalEntryRecord;
}

export async function updateBookJournalEntryRecordFavorite(
  noteId: string,
  isFavorite: boolean,
): Promise<BookJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("book_journal")
    .update({
      is_favorite: isFavorite,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .eq("label", "quote")
    .select()
    .single();

  if (error) throw bookJournalEntryErrorToError(error);
  return data as BookJournalEntryRecord;
}

export async function deleteBookJournalEntryRecord(noteId: string): Promise<void> {
  const { supabase } = await import("./supabase");
  const { error } = await supabase.from("book_journal").delete().eq("id", noteId);

  if (error) throw bookJournalEntryErrorToError(error);
}

export async function createBookJournalReply(
  parentId: string,
  input: Omit<CreateBookJournalEntryRecordInput, "bookId" | "userId" | "parentEntryId"> & {
    bookId?: string;
    userId?: string;
  },
): Promise<BookJournalEntryRecord> {
  const parent = await fetchBookJournalEntryRecord(parentId);
  return createBookJournalEntryRecord({
    ...input,
    bookId: input.bookId ?? parent.book_id,
    userId: input.userId ?? parent.user_id,
    parentEntryId: parentId,
  });
}

export async function fetchBookJournalEntryRecord(entryId: string): Promise<BookJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("book_journal")
    .select("*")
    .eq("id", entryId)
    .single();

  if (error) throw bookJournalEntryErrorToError(error);
  return data as BookJournalEntryRecord;
}

export async function getBookJournalReplies(entryId: string): Promise<BookJournalEntryRecord[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("book_journal")
    .select("*")
    .eq("parent_entry_id", entryId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw bookJournalEntryErrorToError(error);
  return (data ?? []) as BookJournalEntryRecord[];
}

export async function updateBookJournalReply(
  input: UpdateBookJournalEntryRecordInput,
): Promise<BookJournalEntryRecord> {
  return updateBookJournalEntryRecord(input);
}

export async function deleteBookJournalReply(entryId: string): Promise<void> {
  return deleteBookJournalEntryRecord(entryId);
}
