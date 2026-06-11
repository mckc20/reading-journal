import { sortBookNotes } from "@/lib/bookNotes";
import type { Book, BookNote, BookNoteLabel, Series } from "@/types";

export type BookGroup = {
  name: string;
  books: Book[];
};

export type SeriesBookGroup = BookGroup & {
  seriesId: string;
};

export type LibraryNote = BookNote & {
  book: Book;
};

export type NoteGroup = {
  name: string;
  notes: LibraryNote[];
};

export type LibraryValueShelf =
  | "series"
  | "authors"
  | "genres"
  | "rating"
  | "notes"
  | "languages"
  | "format"
  | "source";

export type ShelfValueSummary = {
  name: string;
  count: number;
};

const STAR_RATINGS = [5, 4, 3, 2, 1];
export const UNCATEGORIZED = "Uncategorized";

const NOTE_GROUPS: Array<{ label: BookNoteLabel; name: string }> = [
  { label: "quote", name: "Quotes" },
  { label: "review", name: "Reviews" },
  { label: "note", name: "Notes" },
];

export function sortBooksByTitle(books: Book[]) {
  return [...books].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }),
  );
}

function sortBooksByVolume(books: Book[]) {
  return [...books].sort((a, b) => {
    const volumeA = a.volume_number ?? Number.MAX_SAFE_INTEGER;
    const volumeB = b.volume_number ?? Number.MAX_SAFE_INTEGER;

    if (volumeA !== volumeB) return volumeA - volumeB;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
  });
}

function sortGroups<T extends BookGroup>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    if (a.name === UNCATEGORIZED) return 1;
    if (b.name === UNCATEGORIZED) return -1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
}

function addBookToGroup(groups: Map<string, Book[]>, groupName: string, book: Book) {
  const existingBooks = groups.get(groupName) ?? [];
  existingBooks.push(book);
  groups.set(groupName, existingBooks);
}

function uniqueCleanValues(values: string[] | undefined) {
  return Array.from(new Set(values?.map((value) => value.trim()).filter(Boolean)));
}

export function countUniqueBookValues(
  books: Book[],
  getValues: (book: Book) => string[] | undefined,
) {
  const values = new Set<string>();

  books.forEach((book) => {
    uniqueCleanValues(getValues(book)).forEach((value) => values.add(value));
  });

  return values.size;
}

export function buildMultiValueGroups(
  books: Book[],
  getValues: (book: Book) => string[] | undefined,
) {
  const groups = new Map<string, Book[]>();

  books.forEach((book) => {
    const values = uniqueCleanValues(getValues(book));

    if (values.length === 0) {
      addBookToGroup(groups, UNCATEGORIZED, book);
      return;
    }

    values.forEach((value) => addBookToGroup(groups, value, book));
  });

  return sortGroups(
    Array.from(groups, ([name, groupBooks]) => ({
      name,
      books: sortBooksByTitle(groupBooks),
    })),
  );
}

export function buildSingleValueGroups(books: Book[], getValue: (book: Book) => string | undefined) {
  const groups = new Map<string, Book[]>();

  books.forEach((book) => {
    addBookToGroup(groups, getValue(book) ?? UNCATEGORIZED, book);
  });

  return sortGroups(
    Array.from(groups, ([name, groupBooks]) => ({
      name,
      books: sortBooksByTitle(groupBooks),
    })),
  );
}

export function buildSeriesGroups(books: Book[], series: Series[]): SeriesBookGroup[] {
  const seriesById = new Map(series.map((item) => [item.id, item]));
  const groups = new Map<string, Book[]>();

  books.forEach((book) => {
    if (!book.series_id) return;

    const seriesItem = seriesById.get(book.series_id);
    if (!seriesItem) return;

    addBookToGroup(groups, seriesItem.id, book);
  });

  return sortGroups(
    Array.from(groups, ([seriesId, groupBooks]) => ({
      seriesId,
      name: seriesById.get(seriesId)!.name,
      books: sortBooksByVolume(groupBooks),
    })),
  );
}

export function buildRatingGroups(books: Book[]): BookGroup[] {
  const groups: BookGroup[] = [];
  const favoriteBooks = sortBooksByTitle(books.filter((book) => book.is_favorite));

  if (favoriteBooks.length > 0) {
    groups.push({ name: "Favorites", books: favoriteBooks });
  }

  STAR_RATINGS.forEach((rating) => {
    const ratedBooks = sortBooksByTitle(
      books.filter((book) => !book.is_favorite && book.rating === rating),
    );

    if (ratedBooks.length > 0) {
      groups.push({
        name: `${rating} ${rating === 1 ? "Star" : "Stars"}`,
        books: ratedBooks,
      });
    }
  });

  const unratedBooks = sortBooksByTitle(
    books.filter((book) => !book.is_favorite && book.rating == null),
  );

  if (unratedBooks.length > 0) {
    groups.push({ name: "Unrated", books: unratedBooks });
  }

  return groups;
}

export function mergeNotesWithBooks(notes: BookNote[], books: Book[]): LibraryNote[] {
  const booksById = new Map(books.map((book) => [book.id, book]));

  return notes.flatMap((note) => {
    const book = booksById.get(note.book_id);
    return book ? [{ ...note, book }] : [];
  });
}

export function sortLibraryNotes(notes: LibraryNote[]): LibraryNote[] {
  return (sortBookNotes(notes) as LibraryNote[]).sort((a, b) => {
    if (a.label === "quote" && b.label === "quote" && a.is_favorite !== b.is_favorite) {
      return a.is_favorite ? -1 : 1;
    }

    return 0;
  });
}

export function buildNoteGroups(notes: BookNote[], books: Book[]): NoteGroup[] {
  const libraryNotes = mergeNotesWithBooks(notes, books);

  return NOTE_GROUPS.map(({ label, name }) => ({
    name,
    notes: sortLibraryNotes(libraryNotes.filter((note) => note.label === label)),
  })).filter((group) => group.notes.length > 0);
}

function summarizeBookGroups(groups: BookGroup[]): ShelfValueSummary[] {
  return groups
    .map((group) => ({ name: group.name, count: group.books.length }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      if (a.name === UNCATEGORIZED) return 1;
      if (b.name === UNCATEGORIZED) return -1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    });
}

function summarizeNoteGroups(groups: NoteGroup[]): ShelfValueSummary[] {
  return groups
    .map((group) => ({ name: group.name, count: group.notes.length }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    });
}

function summarizeRatingGroups(groups: BookGroup[]): ShelfValueSummary[] {
  return groups.map((group) => ({ name: group.name, count: group.books.length }));
}

export function buildShelfValueSummaries({
  shelf,
  books,
  series,
  notes = [],
}: {
  shelf: LibraryValueShelf;
  books: Book[];
  series: Series[];
  notes?: BookNote[];
}): ShelfValueSummary[] {
  if (shelf === "series") return summarizeBookGroups(buildSeriesGroups(books, series));
  if (shelf === "authors") return summarizeBookGroups(buildMultiValueGroups(books, (book) => book.authors));
  if (shelf === "genres") return summarizeBookGroups(buildMultiValueGroups(books, (book) => book.genres));
  if (shelf === "rating") return summarizeRatingGroups(buildRatingGroups(books));
  if (shelf === "notes") return summarizeNoteGroups(buildNoteGroups(notes, books));
  if (shelf === "languages") return summarizeBookGroups(buildSingleValueGroups(books, (book) => book.language));
  if (shelf === "format") return summarizeBookGroups(buildSingleValueGroups(books, (book) => book.format));
  return summarizeBookGroups(buildSingleValueGroups(books, (book) => book.source));
}

export function filterBooksByShelfValue({
  shelf,
  value,
  books,
  series,
}: {
  shelf: LibraryValueShelf;
  value: string;
  books: Book[];
  series: Series[];
}): Book[] {
  const selectedValue = value.trim();
  if (!selectedValue) return [];

  if (shelf === "series") {
    const matchingSeriesIds = new Set(
      series.filter((item) => item.name === selectedValue).map((item) => item.id),
    );
    return sortBooksByTitle(books.filter((book) => book.series_id && matchingSeriesIds.has(book.series_id)));
  }

  if (shelf === "authors") {
    return sortBooksByTitle(
      books.filter((book) => uniqueCleanValues(book.authors).includes(selectedValue)),
    );
  }

  if (shelf === "genres") {
    return sortBooksByTitle(
      books.filter((book) => uniqueCleanValues(book.genres).includes(selectedValue)),
    );
  }

  if (shelf === "rating") {
    if (selectedValue === "Favorites") return sortBooksByTitle(books.filter((book) => book.is_favorite));
    if (selectedValue === "Unrated") return sortBooksByTitle(books.filter((book) => !book.is_favorite && book.rating == null));

    const rating = Number.parseInt(selectedValue, 10);
    if (!Number.isFinite(rating)) return [];

    return sortBooksByTitle(
      books.filter((book) => !book.is_favorite && book.rating === rating),
    );
  }

  if (shelf === "languages") {
    return sortBooksByTitle(books.filter((book) => (book.language ?? UNCATEGORIZED) === selectedValue));
  }

  if (shelf === "format") {
    return sortBooksByTitle(books.filter((book) => (book.format ?? UNCATEGORIZED) === selectedValue));
  }

  if (shelf === "source") {
    return sortBooksByTitle(books.filter((book) => (book.source ?? UNCATEGORIZED) === selectedValue));
  }

  return [];
}

export function filterNotesByShelfValue({
  value,
  notes,
  books,
}: {
  value: string;
  notes: BookNote[];
  books: Book[];
}): NoteGroup[] {
  const noteGroup = NOTE_GROUPS.find((group) => group.name === value.trim());
  if (!noteGroup) return [];

  return buildNoteGroups(
    notes.filter((note) => note.label === noteGroup.label),
    books,
  );
}
