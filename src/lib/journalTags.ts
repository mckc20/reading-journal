import { getBookGenreNames } from "@/lib/recommendations";
import type { Book, BookNote, SeriesNote } from "@/types";

function normalizeTagKey(value: string): string {
  return value.trim().toLocaleLowerCase();
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

function rankedTags(tags: string[], limit = 8): string[] {
  const counts = new Map<string, { tag: string; count: number }>();
  tags.forEach((tag) => {
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
  allNotes: BookNote[],
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
    allNotes.flatMap((note) => (similarBookIds.has(note.book_id) ? normalizeJournalTags(note.tags) : [])),
  );
}

export function suggestSeriesJournalTags(seriesNotes: SeriesNote[]): string[] {
  return rankedTags(seriesNotes.flatMap((note) => normalizeJournalTags(note.tags)));
}

export function suggestAuthorJournalTags(authorBooks: Book[], allNotes: BookNote[]): string[] {
  const authorBookIds = new Set(authorBooks.map((book) => book.id));
  return rankedTags(
    allNotes.flatMap((note) => (authorBookIds.has(note.book_id) ? normalizeJournalTags(note.tags) : [])),
  );
}
