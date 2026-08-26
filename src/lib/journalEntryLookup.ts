import { withJournalMedia } from "@/lib/journalMedia";
import {
  authorJournalEntryToJournalEntry,
  bookJournalEntryToJournalEntry,
  seriesJournalEntryToJournalEntry,
  sortJournalEntries,
  type JournalTimelineEntry,
} from "@/lib/journal";
import { extractJournalEntryPublicIds } from "@/lib/journalLinks";
import type {
  AuthorJournalEntryRecord,
  BookJournalEntryRecord,
  SeriesJournalEntryRecord,
} from "@/types";

export type ResolvedJournalEntry =
  | { source: "book_note"; record: BookJournalEntryRecord; href: string }
  | { source: "series_note"; record: SeriesJournalEntryRecord; href: string }
  | { source: "author_note"; record: AuthorJournalEntryRecord; href: string };

export interface JournalBacklink {
  entry: JournalTimelineEntry;
  publicId: string;
  href: string;
}

function errorToJournalEntryLookupError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return new Error(message);
  }
  return new Error("Journal entry request failed");
}

function uniqueEntriesByPublicId(entries: JournalTimelineEntry[]): JournalTimelineEntry[] {
  const unique = new Map<string, JournalTimelineEntry>();

  entries.forEach((entry) => {
    if (entry.source === "generated_book_event") return;
    const publicId = getJournalEntryPublicId(entry);
    if (publicId) unique.set(publicId, entry);
  });

  return sortJournalEntries([...unique.values()]);
}

export function getJournalEntryPublicId(entry: JournalTimelineEntry): string | null {
  if (entry.source === "book_note") return entry.bookJournalEntry.public_id ?? null;
  if (entry.source === "series_note") return entry.seriesJournalEntry.public_id ?? null;
  if (entry.source === "author_note") return entry.authorJournalEntry.public_id ?? null;
  return null;
}

export async function resolveJournalEntryByPublicId(publicId: string): Promise<ResolvedJournalEntry | null> {
  const { supabase } = await import("./supabase");
  const [bookResult, seriesResult, authorResult] = await Promise.all([
    supabase.from("book_journal").select("*").eq("public_id", publicId).maybeSingle(),
    supabase.from("series_journal").select("*").eq("public_id", publicId).maybeSingle(),
    supabase.from("author_journal").select("*").eq("public_id", publicId).maybeSingle(),
  ]);

  if (bookResult.error) throw errorToJournalEntryLookupError(bookResult.error);
  if (seriesResult.error) throw errorToJournalEntryLookupError(seriesResult.error);
  if (authorResult.error) throw errorToJournalEntryLookupError(authorResult.error);

  if (bookResult.data) {
    const record = (await withJournalMedia("book_note", [bookResult.data as BookJournalEntryRecord]))[0];
    return {
      source: "book_note",
      record,
      href: `/books/${encodeURIComponent(record.book_id)}/journal?entry=${encodeURIComponent(record.id)}`,
    };
  }

  if (seriesResult.data) {
    const record = (await withJournalMedia("series_note", [seriesResult.data as SeriesJournalEntryRecord]))[0];
    return {
      source: "series_note",
      record,
      href: `/series/${encodeURIComponent(record.series_id)}/journal?entry=${encodeURIComponent(record.id)}`,
    };
  }

  if (authorResult.data) {
    const record = (await withJournalMedia("author_note", [authorResult.data as AuthorJournalEntryRecord]))[0];
    return {
      source: "author_note",
      record,
      href: `/authors/${encodeURIComponent(record.author_id)}/journal?entry=${encodeURIComponent(record.id)}`,
    };
  }

  return null;
}

export function buildJournalBacklinks(
  entries: JournalTimelineEntry[],
  currentPublicId: string,
): JournalBacklink[] {
  return uniqueEntriesByPublicId(entries)
    .filter((entry) => getJournalEntryPublicId(entry) !== currentPublicId)
    .filter((entry) => extractJournalEntryPublicIds(entryContent(entry)).includes(currentPublicId))
    .map((entry) => {
      const publicId = getJournalEntryPublicId(entry) as string;
      return {
        entry,
        publicId,
        href: `/journal/${encodeURIComponent(publicId)}`,
      };
    });
}

function entryContent(entry: JournalTimelineEntry): string {
  if (entry.source === "book_note") return entry.bookJournalEntry.content;
  if (entry.source === "series_note") return entry.seriesJournalEntry.content;
  if (entry.source === "author_note") return entry.authorJournalEntry.content;
  return "";
}

export async function fetchAllJournalEntriesForLinking(): Promise<JournalTimelineEntry[]> {
  const { fetchAllBookJournalEntryRecords } = await import("@/lib/bookJournal");
  const { fetchAllSeriesJournalEntryRecords } = await import("@/lib/seriesJournal");
  const { fetchAllAuthorJournalEntryRecords } = await import("@/lib/authorJournal");

  const [bookEntries, seriesEntries, authorEntries] = await Promise.all([
    fetchAllBookJournalEntryRecords({ includeReplies: true }),
    fetchAllSeriesJournalEntryRecords({ includeReplies: true }),
    fetchAllAuthorJournalEntryRecords({ includeReplies: true }),
  ]);

  return sortJournalEntries([
    ...bookEntries.map(bookJournalEntryToJournalEntry),
    ...seriesEntries.map(seriesJournalEntryToJournalEntry),
    ...authorEntries.map(authorJournalEntryToJournalEntry),
  ]);
}
