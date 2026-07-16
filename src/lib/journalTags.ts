import { getBookGenreNames } from "@/lib/recommendations";
import type { Book, BookJournalEntryRecord, SeriesJournalEntryRecord } from "@/types";

export const INTERNAL_JOURNAL_TAG_PREFIX = "__journal:";
export const GENERATED_EVENT_NOTE_TAG_PREFIX = `${INTERNAL_JOURNAL_TAG_PREFIX}generated-event:`;
export const READING_LOG_NOTE_TAG_PREFIX = `${INTERNAL_JOURNAL_TAG_PREFIX}reading-log:`;

function normalizeTagKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function isInternalJournalTag(tag: string): boolean {
  return normalizeTagKey(tag).startsWith(INTERNAL_JOURNAL_TAG_PREFIX);
}

export function normalizeJournalTags(tags: string[] | null | undefined): string[] {
  const unique = new Map<string, string>();
  (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const key = normalizeTagKey(tag);
      if (!unique.has(key)) unique.set(key, tag);
    });
  return [...unique.values()];
}

export function visibleJournalTags(tags: string[] | null | undefined): string[] {
  return normalizeJournalTags(tags).filter((tag) => !isInternalJournalTag(tag));
}

function rankedTags(tags: string[], limit = 8): string[] {
  const counts = new Map<string, { tag: string; count: number }>();
  tags.filter((tag) => !isInternalJournalTag(tag)).forEach((tag) => {
    const key = normalizeTagKey(tag);
    if (!key) return;
    const current = counts.get(key);
    counts.set(key, { tag: current?.tag ?? tag.trim(), count: (current?.count ?? 0) + 1 });
  });

  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, limit)
    .map((item) => item.tag);
}

export function suggestBookJournalTags(
  currentBook: Book,
  allBooks: Book[],
  allJournalEntries: BookJournalEntryRecord[],
): string[] {
  const targetGenres = new Set(getBookGenreNames(currentBook).map(normalizeTagKey));
  if (targetGenres.size === 0) return [];

  const similarBookIds = new Set(
    allBooks
      .filter((book) => book.id !== currentBook.id)
      .filter((book) => getBookGenreNames(book).some((genre) => targetGenres.has(normalizeTagKey(genre))))
      .map((book) => book.id),
  );

  return rankedTags(
    allJournalEntries.flatMap((note) => (similarBookIds.has(note.book_id) ? normalizeJournalTags(note.tags) : [])),
  );
}

export function suggestSeriesJournalTags(seriesJournal: SeriesJournalEntryRecord[]): string[] {
  return rankedTags(seriesJournal.flatMap((note) => normalizeJournalTags(note.tags)));
}

export function suggestAuthorJournalTags(authorBooks: Book[], allJournalEntries: BookJournalEntryRecord[]): string[] {
  const authorBookIds = new Set(authorBooks.map((book) => book.id));
  return rankedTags(
    allJournalEntries.flatMap((note) => (authorBookIds.has(note.book_id) ? normalizeJournalTags(note.tags) : [])),
  );
}
