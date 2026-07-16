import type { BookNoteLabel, SeriesNote } from "@/types";

export interface CreateSeriesNoteInput {
  seriesId: string;
  userId: string;
  label?: BookNoteLabel;
  title?: string;
  quoteSpeaker?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  isFavorite?: boolean;
  noteDate?: string | null;
}

export interface UpdateSeriesNoteInput {
  noteId: string;
  label?: BookNoteLabel;
  title?: string;
  quoteSpeaker?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  isFavorite?: boolean;
  noteDate?: string | null;
}

export interface NormalizedSeriesNoteFields {
  label: BookNoteLabel;
  title: string | null;
  quote_speaker: string | null;
  content: string;
  tags?: string[] | null;
  page_start: number | null;
  is_favorite: boolean;
  note_date: string;
}

export interface NormalizedSeriesNoteInput extends NormalizedSeriesNoteFields {
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

function normalizeLabel(value: BookNoteLabel | undefined): BookNoteLabel {
  return value === "quote" ? "quote" : "note";
}

function normalizePageValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Page must be a positive whole number");
  return parsed;
}

export function seriesNoteErrorToError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return new Error(message);
    }
  }

  return new Error("Series note request failed");
}

export function normalizeSeriesNoteFields(
  input: Pick<CreateSeriesNoteInput, "label" | "title" | "quoteSpeaker" | "content" | "tags" | "pageStart" | "isFavorite" | "noteDate">,
): NormalizedSeriesNoteFields {
  const content = input.content.trim();
  if (!content) throw new Error("Note content is required");
  const label = normalizeLabel(input.label);

  const fields: NormalizedSeriesNoteFields = {
    label,
    title: label === "quote" ? null : input.title?.trim() || null,
    quote_speaker: label === "quote" ? input.quoteSpeaker?.trim() || null : null,
    content,
    page_start: normalizePageValue(input.pageStart),
    is_favorite: Boolean("isFavorite" in input ? input.isFavorite : false),
    note_date: normalizeNoteDate(input.noteDate),
  };

  if (Object.prototype.hasOwnProperty.call(input, "tags")) {
    fields.tags = normalizeTags(input.tags);
  }

  return fields;
}

export function normalizeSeriesNoteInput(
  input: CreateSeriesNoteInput,
): NormalizedSeriesNoteInput {
  return {
    series_id: input.seriesId,
    user_id: input.userId,
    ...normalizeSeriesNoteFields(input),
  };
}

export function sortSeriesNotes(notes: SeriesNote[]): SeriesNote[] {
  return [...notes].sort((a, b) => {
    const dateCompare = b.note_date.localeCompare(a.note_date);
    if (dateCompare !== 0) return dateCompare;
    return b.created_at.localeCompare(a.created_at);
  });
}

export async function fetchSeriesNotes(seriesId: string): Promise<SeriesNote[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("series_notes")
    .select("*")
    .eq("series_id", seriesId)
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw seriesNoteErrorToError(error);
  return sortSeriesNotes((data ?? []) as SeriesNote[]);
}

export async function createSeriesNote(input: CreateSeriesNoteInput): Promise<SeriesNote> {
  const { supabase } = await import("./supabase");
  const payload = normalizeSeriesNoteInput(input);
  const { data, error } = await supabase
    .from("series_notes")
    .insert(payload)
    .select()
    .single();

  if (error) throw seriesNoteErrorToError(error);
  return data as SeriesNote;
}

export async function updateSeriesNote(input: UpdateSeriesNoteInput): Promise<SeriesNote> {
  const { supabase } = await import("./supabase");
  const payload = normalizeSeriesNoteFields(input);
  const { data, error } = await supabase
    .from("series_notes")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.noteId)
    .select()
    .single();

  if (error) throw seriesNoteErrorToError(error);
  return data as SeriesNote;
}

export async function deleteSeriesNote(noteId: string): Promise<void> {
  const { supabase } = await import("./supabase");
  const { error } = await supabase.from("series_notes").delete().eq("id", noteId);
  if (error) throw seriesNoteErrorToError(error);
}
