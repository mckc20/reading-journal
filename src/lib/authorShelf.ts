import { sortBookNotes } from "@/lib/bookNotes";
import type { Book, BookNote, BookStatus } from "@/types";

export type AuthorShelfGroupKey = "read" | "reading" | "want-to-read" | "uncategorized";

export type AuthorShelfGroup = {
  key: AuthorShelfGroupKey;
  title: string;
  books: Book[];
};

export type AuthorSummary = {
  name: string;
  books: Book[];
  quotes: BookNote[];
  bookCount: number;
  quoteCount: number;
  averageRating: number | null;
  firstReadDate: string | null;
  latestReadDate: string | null;
  isFavorite: boolean;
  coverBooks: Book[];
  statusCounts: {
    read: number;
    reading: number;
    wantToRead: number;
  };
  shelfGroups: AuthorShelfGroup[];
};

const AUTHORLESS_NAME = "Uncategorized";

const shelfGroupTitles: Record<AuthorShelfGroupKey, string> = {
  read: "Read",
  reading: "Currently Reading",
  "want-to-read": "Want to Read",
  uncategorized: "Uncategorized",
};

function cleanAuthorName(author: string): string {
  return author.trim();
}

function authorKey(author: string): string {
  return cleanAuthorName(author).toLocaleLowerCase();
}

function compareBooksByTitle(a: Book, b: Book): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
}

function compareBooksByReadingDateDesc(a: Book, b: Book): number {
  const aTime = getBookReadDate(a) ? new Date(getBookReadDate(a) as string).getTime() : 0;
  const bTime = getBookReadDate(b) ? new Date(getBookReadDate(b) as string).getTime() : 0;

  return bTime - aTime || compareBooksByTitle(a, b);
}

function uniqueAuthorNames(book: Book): string[] {
  const authors = Array.from(new Set(book.authors.map(cleanAuthorName).filter(Boolean)));
  return authors.length > 0 ? authors : [AUTHORLESS_NAME];
}

function getBookReadDate(book: Book): string | null {
  return book.date_finished ?? book.date_started ?? null;
}

function getAverageRating(books: Book[]): number | null {
  const ratings = books
    .map((book) => book.rating)
    .filter((rating): rating is number => typeof rating === "number");

  if (ratings.length === 0) return null;

  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.round((total / ratings.length) * 10) / 10;
}

function getReadingDateBounds(books: Book[]): {
  firstReadDate: string | null;
  latestReadDate: string | null;
} {
  const dates = books
    .map(getBookReadDate)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    firstReadDate: dates[0] ?? null,
    latestReadDate: dates[dates.length - 1] ?? null,
  };
}

function shelfKeyForStatus(status: BookStatus): AuthorShelfGroupKey {
  if (status === "Finished") return "read";
  if (status === "Reading" || status === "Paused") return "reading";
  if (["Wishlist", "Not Started", "Up Next"].includes(status)) return "want-to-read";
  return "uncategorized";
}

function buildShelfGroups(books: Book[]): AuthorShelfGroup[] {
  const groups = new Map<AuthorShelfGroupKey, Book[]>();

  books.forEach((book) => {
    const key = shelfKeyForStatus(book.status);
    groups.set(key, [...(groups.get(key) ?? []), book]);
  });

  return (["read", "reading", "want-to-read", "uncategorized"] as AuthorShelfGroupKey[])
    .map((key) => ({
      key,
      title: shelfGroupTitles[key],
      books: (groups.get(key) ?? []).sort(compareBooksByReadingDateDesc),
    }))
    .filter((group) => group.books.length > 0);
}

function getCoverBooks(books: Book[]): Book[] {
  return [...books]
    .sort((a, b) => {
      if (a.cover_url && !b.cover_url) return -1;
      if (!a.cover_url && b.cover_url) return 1;
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      return compareBooksByReadingDateDesc(a, b);
    })
    .slice(0, 5);
}

function sortAuthors(authors: AuthorSummary[]): AuthorSummary[] {
  return [...authors].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    if (a.bookCount !== b.bookCount) return b.bookCount - a.bookCount;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
}

export function buildAuthorSummaries(books: Book[], notes: BookNote[] = []): AuthorSummary[] {
  const authorBooks = new Map<string, { name: string; books: Book[] }>();

  books.forEach((book) => {
    uniqueAuthorNames(book).forEach((author) => {
      const key = authorKey(author);
      const group = authorBooks.get(key) ?? { name: author, books: [] };
      group.books.push(book);
      authorBooks.set(key, group);
    });
  });

  const quoteNotes = sortBookNotes(notes.filter((note) => note.label === "quote"));
  const quotesByBookId = new Map<string, BookNote[]>();
  quoteNotes.forEach((note) => {
    quotesByBookId.set(note.book_id, [...(quotesByBookId.get(note.book_id) ?? []), note]);
  });

  return sortAuthors(
    Array.from(authorBooks.values()).map(({ name, books: authorGroupBooks }) => {
      const sortedBooks = [...authorGroupBooks].sort(compareBooksByReadingDateDesc);
      const quotes = sortedBooks.flatMap((book) => quotesByBookId.get(book.id) ?? []);
      const { firstReadDate, latestReadDate } = getReadingDateBounds(sortedBooks);
      const shelfGroups = buildShelfGroups(sortedBooks);

      return {
        name,
        books: sortedBooks,
        quotes,
        bookCount: sortedBooks.length,
        quoteCount: quotes.length,
        averageRating: getAverageRating(sortedBooks),
        firstReadDate,
        latestReadDate,
        isFavorite: sortedBooks.some((book) => book.is_favorite),
        coverBooks: getCoverBooks(sortedBooks),
        statusCounts: {
          read: sortedBooks.filter((book) => book.status === "Finished").length,
          reading: sortedBooks.filter((book) => book.status === "Reading" || book.status === "Paused").length,
          wantToRead: sortedBooks.filter((book) =>
            ["Wishlist", "Not Started", "Up Next"].includes(book.status),
          ).length,
        },
        shelfGroups,
      };
    }),
  );
}

export function findAuthorSummary(
  authors: AuthorSummary[],
  authorName: string | undefined,
): AuthorSummary | null {
  if (!authorName) return null;

  let decodedName = authorName;
  try {
    decodedName = decodeURIComponent(authorName);
  } catch {
    decodedName = authorName;
  }

  const key = authorKey(decodedName);
  return authors.find((author) => authorKey(author.name) === key) ?? null;
}

export function formatAuthorDate(date: string | null): string {
  if (!date) return "No date yet";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "No date yet";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsedDate);
}

export function formatAuthorYear(date: string | null): string {
  if (!date) return "No date yet";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "No date yet";

  return new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(parsedDate);
}

export function getAuthorInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase();

  return `${words[0][0]}${words[words.length - 1][0]}`.toLocaleUpperCase();
}
