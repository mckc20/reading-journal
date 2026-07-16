import type { Author, Book, BookJournalEntryRecord } from "@/types";
import { sortBookJournalEntryRecords } from "@/lib/bookJournal";
import { formatPublicationDateForDisplay } from "@/lib/publicationDate";

export type AuthorShelfGroupKey = "read" | "reading" | "want-to-read" | "uncategorized";

export type AuthorShelfGroup = {
  key: AuthorShelfGroupKey;
  title: string;
  books: Book[];
};

export type AuthorSummary = Author & {
  books: Book[];
  quotes: BookJournalEntryRecord[];
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
  return author.trim().replace(/\s+/g, " ");
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

export function getAuthorPagesWritten(author: Pick<AuthorSummary, "books">): number {
  return author.books.reduce((total, book) => total + (book.total_pages ?? 0), 0);
}

export function getAuthorAverageRating(author: Pick<AuthorSummary, "books">): number | null {
  const ratings = author.books
    .map((book) => book.rating)
    .filter((rating): rating is number => typeof rating === "number");

  if (ratings.length === 0) return null;

  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
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

function shelfKeyForStatus(status: Book["status"]): AuthorShelfGroupKey {
  if (status === "Finished") return "read";
  if (status === "Reading" || status === "Paused") return "reading";
  if (["To Read", "Up Next"].includes(status)) return "want-to-read";
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

function makeSyntheticAuthorSummary(name: string): AuthorSummary {
  return {
    id: `legacy:${encodeURIComponent(name)}`,
    user_id: "",
    name,
    photo_url: null,
    birth_date: null,
    birth_date_precision: null,
    death_date: null,
    death_date_precision: null,
    bio: null,
    is_favorite: false,
    nationality: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    books: [],
    quotes: [],
    bookCount: 0,
    quoteCount: 0,
    averageRating: null,
    firstReadDate: null,
    latestReadDate: null,
    isFavorite: false,
    coverBooks: [],
    statusCounts: {
      read: 0,
      reading: 0,
      wantToRead: 0,
    },
    shelfGroups: [],
  };
}

export function buildAuthorSummaries(
  first: Author[] | Book[],
  second: Book[] | BookJournalEntryRecord[] = [],
  third: BookJournalEntryRecord[] = [],
): AuthorSummary[] {
  const firstItem = first[0] as Author | Book | undefined;
  const secondItem = second[0] as Book | BookJournalEntryRecord | undefined;
  const firstLooksLikeAuthor = Boolean(firstItem && !("title" in firstItem) && !("status" in firstItem));
  const secondLooksLikeBook = Boolean(secondItem && "title" in secondItem && "status" in secondItem);
  const usesNewSignature = firstLooksLikeAuthor || third.length > 0 || secondLooksLikeBook;
  const authorsInput = usesNewSignature ? (first as Author[]) : [];
  const books = usesNewSignature ? (second as Book[]) : (first as Book[]);
  const journalEntries = usesNewSignature ? third : (second as BookJournalEntryRecord[]);

  const authorGroups = new Map<string, { author: AuthorSummary; books: Book[] }>();

  authorsInput.forEach((author) => {
    const summary: AuthorSummary = {
      ...author,
      isFavorite: author.is_favorite,
      books: [],
      quotes: [],
      bookCount: 0,
      quoteCount: 0,
      averageRating: null,
      firstReadDate: null,
      latestReadDate: null,
      coverBooks: [],
      statusCounts: {
        read: 0,
        reading: 0,
        wantToRead: 0,
      },
      shelfGroups: [],
    };
    authorGroups.set(authorKey(author.name), { author: summary, books: [] });
  });

  books.forEach((book) => {
    uniqueAuthorNames(book).forEach((name) => {
      const key = authorKey(name);
      const existing = authorGroups.get(key);
      if (existing) {
        existing.books.push(book);
        return;
      }

      const synthetic = makeSyntheticAuthorSummary(name);
      synthetic.books.push(book);
      authorGroups.set(key, { author: synthetic, books: [book] });
    });
  });

  const quoteJournalEntries = sortBookJournalEntryRecords(journalEntries.filter((note) => note.label === "quote"));
  const quotesByBookId = new Map<string, BookJournalEntryRecord[]>();
  quoteJournalEntries.forEach((note) => {
    quotesByBookId.set(note.book_id, [...(quotesByBookId.get(note.book_id) ?? []), note]);
  });

  return sortAuthors(
    Array.from(authorGroups.values()).map(({ author, books: authorBooks }) => {
      const sortedBooks = [...authorBooks].sort(compareBooksByReadingDateDesc);
      const quotes = sortedBooks.flatMap((book) => quotesByBookId.get(book.id) ?? []);
      const { firstReadDate, latestReadDate } = getReadingDateBounds(sortedBooks);
      const shelfGroups = buildShelfGroups(sortedBooks);
      const statusCounts = {
        read: sortedBooks.filter((book) => book.status === "Finished").length,
        reading: sortedBooks.filter((book) => book.status === "Reading" || book.status === "Paused").length,
        wantToRead: sortedBooks.filter((book) =>
          ["To Read", "Up Next"].includes(book.status),
        ).length,
      };

      return {
        ...author,
        books: sortedBooks,
        quotes,
        bookCount: sortedBooks.length,
        quoteCount: quotes.length,
        averageRating: getAverageRating(sortedBooks),
        firstReadDate,
        latestReadDate,
        isFavorite: author.is_favorite,
        coverBooks: getCoverBooks(sortedBooks),
        statusCounts,
        shelfGroups,
      };
    }),
  );
}

export function findAuthorSummary(
  authors: AuthorSummary[],
  identifier: string | undefined,
): AuthorSummary | null {
  if (!identifier) return null;

  let decoded = identifier;
  try {
    decoded = decodeURIComponent(identifier);
  } catch {
    decoded = identifier;
  }

  const byId = authors.find((author) => author.id === decoded);
  if (byId) return byId;

  const key = authorKey(decoded);
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

export function formatAuthorPartialDate(
  value: string | null | undefined,
  precision: Author["birth_date_precision"] | Author["death_date_precision"] | null | undefined,
): string {
  return formatPublicationDateForDisplay(value ?? null, precision ?? null);
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
