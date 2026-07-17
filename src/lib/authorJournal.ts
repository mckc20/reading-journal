import type { AuthorJournalEntryRecord, JournalEntryLabel, JournalEntryLink } from "@/types";

export interface CreateAuthorJournalEntryRecordInput {
  authorId: string;
  userId: string;
  label?: JournalEntryLabel;
  title?: string;
  quoteSpeaker?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  isFavorite?: boolean;
  noteDate?: string | null;
  parentEntryId?: string | null;
}

export interface UpdateAuthorJournalEntryRecordInput {
  noteId: string;
  label?: JournalEntryLabel;
  title?: string;
  quoteSpeaker?: string;
  content: string;
  tags?: string[] | null;
  pageStart?: string | number | null;
  isFavorite?: boolean;
  noteDate?: string | null;
  parentEntryId?: string | null;
}

export interface NormalizedAuthorJournalEntryRecordFields {
  label: JournalEntryLabel;
  title: string | null;
  quote_speaker: string | null;
  content: string;
  tags?: string[] | null;
  page_start: number | null;
  is_favorite: boolean;
  entry_date: string;
  parent_entry_id?: string | null;
}

export interface NormalizedAuthorJournalEntryRecordInput extends NormalizedAuthorJournalEntryRecordFields {
  author_id: string;
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

export function authorJournalEntryErrorToError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return new Error(message);
    }
  }

  return new Error("Author note request failed");
}

export function normalizeAuthorJournalEntryRecordFields(
  input: Pick<CreateAuthorJournalEntryRecordInput, "label" | "title" | "quoteSpeaker" | "content" | "tags" | "pageStart" | "isFavorite" | "noteDate"> & {
    parentEntryId?: string | null;
  },
): NormalizedAuthorJournalEntryRecordFields {
  const content = input.content.trim();
  if (!content) throw new Error("Note content is required");
  const label = normalizeLabel(input.label);

  const fields: NormalizedAuthorJournalEntryRecordFields = {
    label,
    title: label === "quote" ? null : input.title?.trim() || null,
    quote_speaker: label === "quote" ? input.quoteSpeaker?.trim() || null : null,
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

export function normalizeAuthorJournalEntryRecordInput(
  input: CreateAuthorJournalEntryRecordInput,
): NormalizedAuthorJournalEntryRecordInput {
  const payload: NormalizedAuthorJournalEntryRecordInput = {
    author_id: input.authorId,
    user_id: input.userId,
    ...normalizeAuthorJournalEntryRecordFields(input),
  };

  if (input.parentEntryId) {
    payload.parent_entry_id = input.parentEntryId;
  }

  return payload;
}

export function sortAuthorJournalEntryRecords(journalEntries: AuthorJournalEntryRecord[]): AuthorJournalEntryRecord[] {
  return [...journalEntries].sort((a, b) => {
    const dateCompare = b.entry_date.localeCompare(a.entry_date);
    if (dateCompare !== 0) return dateCompare;
    return b.created_at.localeCompare(a.created_at);
  });
}

export async function fetchAuthorJournalEntryRecords(authorId: string): Promise<AuthorJournalEntryRecord[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("author_journal")
    .select("*")
    .eq("author_id", authorId)
    .is("parent_entry_id", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw authorJournalEntryErrorToError(error);
  return sortAuthorJournalEntryRecords((data ?? []) as AuthorJournalEntryRecord[]);
}

export async function createAuthorJournalEntryRecord(input: CreateAuthorJournalEntryRecordInput): Promise<AuthorJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const payload = normalizeAuthorJournalEntryRecordInput(input);
  const { data, error } = await supabase
    .from("author_journal")
    .insert(payload)
    .select()
    .single();

  if (error) throw authorJournalEntryErrorToError(error);
  return data as AuthorJournalEntryRecord;
}

export async function updateAuthorJournalEntryRecord(input: UpdateAuthorJournalEntryRecordInput): Promise<AuthorJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const payload = normalizeAuthorJournalEntryRecordFields(input);
  const { data, error } = await supabase
    .from("author_journal")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.noteId)
    .select()
    .single();

  if (error) throw authorJournalEntryErrorToError(error);
  return data as AuthorJournalEntryRecord;
}

export async function deleteAuthorJournalEntryRecord(noteId: string): Promise<void> {
  const { supabase } = await import("./supabase");
  const { error } = await supabase.from("author_journal").delete().eq("id", noteId);
  if (error) throw authorJournalEntryErrorToError(error);
}

export async function fetchAuthorJournalEntryRecord(entryId: string): Promise<AuthorJournalEntryRecord> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("author_journal")
    .select("*")
    .eq("id", entryId)
    .single();

  if (error) throw authorJournalEntryErrorToError(error);
  return data as AuthorJournalEntryRecord;
}

export async function createAuthorJournalReply(
  parentId: string,
  input: Omit<CreateAuthorJournalEntryRecordInput, "authorId" | "userId" | "parentEntryId"> & {
    authorId?: string;
    userId?: string;
  },
): Promise<AuthorJournalEntryRecord> {
  const parent = await fetchAuthorJournalEntryRecord(parentId);
  return createAuthorJournalEntryRecord({
    ...input,
    authorId: input.authorId ?? parent.author_id,
    userId: input.userId ?? parent.user_id,
    parentEntryId: parentId,
  });
}

export async function getAuthorJournalReplies(entryId: string): Promise<AuthorJournalEntryRecord[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("author_journal")
    .select("*")
    .eq("parent_entry_id", entryId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw authorJournalEntryErrorToError(error);
  return (data ?? []) as AuthorJournalEntryRecord[];
}

export async function updateAuthorJournalReply(
  input: UpdateAuthorJournalEntryRecordInput,
): Promise<AuthorJournalEntryRecord> {
  return updateAuthorJournalEntryRecord(input);
}

export async function deleteAuthorJournalReply(entryId: string): Promise<void> {
  return deleteAuthorJournalEntryRecord(entryId);
}

function orderedEntryPair(entryA: string, entryB: string): { entry_a_id: string; entry_b_id: string } {
  if (entryA === entryB) throw new Error("An entry cannot be linked to itself");
  return entryA.localeCompare(entryB) < 0
    ? { entry_a_id: entryA, entry_b_id: entryB }
    : { entry_a_id: entryB, entry_b_id: entryA };
}

function isDuplicateLinkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return code === "23505" || message.toLocaleLowerCase().includes("duplicate");
}

export async function linkAuthorJournalEntries(entryA: string, entryB: string): Promise<JournalEntryLink> {
  const { supabase } = await import("./supabase");
  const payload = orderedEntryPair(entryA, entryB);
  const { data, error } = await supabase
    .from("author_journal_entry_links")
    .insert(payload)
    .select()
    .single();

  if (error && isDuplicateLinkError(error)) {
    const existing = await supabase
      .from("author_journal_entry_links")
      .select("*")
      .eq("entry_a_id", payload.entry_a_id)
      .eq("entry_b_id", payload.entry_b_id)
      .single();
    if (existing.error) throw authorJournalEntryErrorToError(existing.error);
    return existing.data as JournalEntryLink;
  }

  if (error) throw authorJournalEntryErrorToError(error);
  return data as JournalEntryLink;
}

export async function unlinkAuthorJournalEntries(entryA: string, entryB: string): Promise<void> {
  const { supabase } = await import("./supabase");
  const pair = orderedEntryPair(entryA, entryB);
  const { error } = await supabase
    .from("author_journal_entry_links")
    .delete()
    .eq("entry_a_id", pair.entry_a_id)
    .eq("entry_b_id", pair.entry_b_id);

  if (error) throw authorJournalEntryErrorToError(error);
}

export async function getRelatedAuthorJournalEntries(entryId: string): Promise<AuthorJournalEntryRecord[]> {
  const { supabase } = await import("./supabase");
  const { data: links, error: linksError } = await supabase
    .from("author_journal_entry_links")
    .select("*")
    .or(`entry_a_id.eq.${entryId},entry_b_id.eq.${entryId}`)
    .order("created_at", { ascending: false });

  if (linksError) throw authorJournalEntryErrorToError(linksError);
  const relatedIds = ((links ?? []) as JournalEntryLink[])
    .map((link) => (link.entry_a_id === entryId ? link.entry_b_id : link.entry_a_id));
  if (relatedIds.length === 0) return [];

  const { data, error } = await supabase.from("author_journal").select("*").in("id", relatedIds);
  if (error) throw authorJournalEntryErrorToError(error);
  const entriesById = new Map(((data ?? []) as AuthorJournalEntryRecord[]).map((entry) => [entry.id, entry]));
  return relatedIds.map((id) => entriesById.get(id)).filter((entry): entry is AuthorJournalEntryRecord => Boolean(entry));
}
