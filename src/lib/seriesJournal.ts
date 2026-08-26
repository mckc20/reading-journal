import type { JournalEntryLabel, SeriesJournalEntryRecord } from "@/types";
import { withJournalMedia } from "@/lib/journalMedia";

export interface CreateSeriesJournalEntryRecordInput {
  seriesId: string;
  userId: string;
  label?: JournalEntryLabel;
  attribution?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  isFavorite?: boolean;
  noteDate?: string | null;
  parentEntryId?: string | null;
}

export interface UpdateSeriesJournalEntryRecordInput {
  noteId: string;
  label?: JournalEntryLabel;
  attribution?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  isFavorite?: boolean;
  noteDate?: string | null;
  parentEntryId?: string | null;
}

export interface NormalizedSeriesJournalEntryRecordFields {
  label: JournalEntryLabel;
  attribution: string | null;
  content: string;
  tags?: string[] | null;
  page_start: number | null;
  is_favorite: boolean;
  entry_date: string;
  parent_entry_id?: string | null;
}

export interface NormalizedSeriesJournalEntryRecordInput extends NormalizedSeriesJournalEntryRecordFields {
  series_id: string;
  user_id: string;
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
  const unique = new Map<string, string>();
  value
    .map((tag) => tag.trim())
    .filter(Boolean)
    .forEach((tag) => unique.set(tag.toLocaleLowerCase(), tag));
  return unique.size > 0 ? [...unique.values()] : null;
}

function normalizeLabel(value: JournalEntryLabel | undefined): JournalEntryLabel {
  return value === "quote" ? "quote" : "note";
}

function normalizePageValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Page must be a positive whole number");
  return parsed;
}

export function seriesJournalEntryErrorToError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return new Error(message);
    }
  }

  return new Error("Series note request failed");
}

export function normalizeSeriesJournalEntryRecordFields(
  input: Pick<CreateSeriesJournalEntryRecordInput, "label" | "attribution" | "content" | "tags" | "pageStart" | "isFavorite" | "noteDate"> & {
    parentEntryId?: string | null;
  },
): NormalizedSeriesJournalEntryRecordFields {
  const content = input.content.trim();
  if (!content) throw new Error("Note content is required");
  const label = normalizeLabel(input.label);

  const fields: NormalizedSeriesJournalEntryRecordFields = {
    label,
    attribution: label === "quote" ? input.attribution?.trim() || null : null,
    content,
    page_start: normalizePageValue(input.pageStart),
    is_favorite: Boolean("isFavorite" in input ? input.isFavorite : false),
    entry_date: normalizeNoteDate(input.noteDate),
  };

  if (Object.prototype.hasOwnProperty.call(input, "tags")) {
    fields.tags = normalizeTags(input.tags);
  }

  if (Object.prototype.hasOwnProperty.call(input, "parentEntryId")) {
    fields.parent_entry_id = input.parentEntryId ?? null;
  }

  return fields;
}

export function normalizeSeriesJournalEntryRecordInput(
  input: CreateSeriesJournalEntryRecordInput,
): NormalizedSeriesJournalEntryRecordInput {
  const payload: NormalizedSeriesJournalEntryRecordInput = {
    series_id: input.seriesId,
    user_id: input.userId,
    ...normalizeSeriesJournalEntryRecordFields(input),
  };

  if (input.parentEntryId) {
    payload.parent_entry_id = input.parentEntryId;
  }

  return payload;
}

export function sortSeriesJournalEntryRecords(journalEntries: SeriesJournalEntryRecord[]): SeriesJournalEntryRecord[] {
  return [...journalEntries].sort((a, b) => {
    const dateCompare = b.entry_date.localeCompare(a.entry_date);
    if (dateCompare !== 0) return dateCompare;
    return b.created_at.localeCompare(a.created_at);
  });
}

export async function fetchSeriesJournalEntryRecords(seriesId: string): Promise<SeriesJournalEntryRecord[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("series_journal")
    .select("*")
    .eq("series_id", seriesId)
    .is("parent_entry_id", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw seriesJournalEntryErrorToError(error);
  return sortSeriesJournalEntryRecords(await withJournalMedia("series_note", (data ?? []) as SeriesJournalEntryRecord[]));
}

export async function fetchAllSeriesJournalEntryRecords(
  options: { includeReplies?: boolean } = {},
): Promise<SeriesJournalEntryRecord[]> {
  const { supabase } = await import("./supabase");
  let query = supabase
    .from("series_journal")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (!options.includeReplies) query = query.is("parent_entry_id", null);
  const { data, error } = await query;

  if (error) throw seriesJournalEntryErrorToError(error);
  return sortSeriesJournalEntryRecords(await withJournalMedia("series_note", (data ?? []) as SeriesJournalEntryRecord[]));
}

export async function createSeriesJournalEntryRecord(input: CreateSeriesJournalEntryRecordInput): Promise<SeriesJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const payload = normalizeSeriesJournalEntryRecordInput(input);
  const { data, error } = await supabase
    .from("series_journal")
    .insert(payload)
    .select()
    .single();

  if (error) throw seriesJournalEntryErrorToError(error);
  return (await withJournalMedia("series_note", [data as SeriesJournalEntryRecord]))[0];
}

export async function updateSeriesJournalEntryRecord(input: UpdateSeriesJournalEntryRecordInput): Promise<SeriesJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const payload = normalizeSeriesJournalEntryRecordFields(input);
  const { data, error } = await supabase
    .from("series_journal")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.noteId)
    .select()
    .single();

  if (error) throw seriesJournalEntryErrorToError(error);
  return (await withJournalMedia("series_note", [data as SeriesJournalEntryRecord]))[0];
}

export async function deleteSeriesJournalEntryRecord(noteId: string): Promise<void> {
  const { supabase } = await import("./supabase");
  const { error } = await supabase.from("series_journal").delete().eq("id", noteId);
  if (error) throw seriesJournalEntryErrorToError(error);
}

export async function fetchSeriesJournalEntryRecord(entryId: string): Promise<SeriesJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("series_journal")
    .select("*")
    .eq("id", entryId)
    .single();

  if (error) throw seriesJournalEntryErrorToError(error);
  return (await withJournalMedia("series_note", [data as SeriesJournalEntryRecord]))[0];
}

export async function createSeriesJournalReply(
  parentId: string,
  input: Omit<CreateSeriesJournalEntryRecordInput, "seriesId" | "userId" | "parentEntryId"> & {
    seriesId?: string;
    userId?: string;
  },
): Promise<SeriesJournalEntryRecord> {
  const parent = await fetchSeriesJournalEntryRecord(parentId);
  return createSeriesJournalEntryRecord({
    ...input,
    seriesId: input.seriesId ?? parent.series_id,
    userId: input.userId ?? parent.user_id,
    parentEntryId: parentId,
  });
}

export async function getSeriesJournalReplies(entryId: string): Promise<SeriesJournalEntryRecord[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("series_journal")
    .select("*")
    .eq("parent_entry_id", entryId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw seriesJournalEntryErrorToError(error);
  return withJournalMedia("series_note", (data ?? []) as SeriesJournalEntryRecord[]);
}

export async function updateSeriesJournalReply(
  input: UpdateSeriesJournalEntryRecordInput,
): Promise<SeriesJournalEntryRecord> {
  return updateSeriesJournalEntryRecord(input);
}

export async function deleteSeriesJournalReply(entryId: string): Promise<void> {
  return deleteSeriesJournalEntryRecord(entryId);
}
