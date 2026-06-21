import {
  calculateCalendarSpan,
  getActiveDaysBetween,
  parseLocalDateOnly,
  sumReadingMinutes,
  type CalendarSpan,
} from "@/lib/bookAnalytics";
import type { Book, BookNote, ReadingLog } from "@/types";

export type SeriesProgress = {
  isAvailable: boolean;
  percentage: number | null;
  readPages: number | null;
  totalPages: number | null;
  finishedBooks: number;
};

export type LatestSeriesActivity = {
  book: Book;
  log: ReadingLog;
};

export type JourneyBookDates = {
  started: string | null;
  finished: string | null;
};

export type SeriesJourneyRecap = {
  started: string | null;
  timeSpentDays: number;
  finishedBooks: number;
  completedMonths: number | null;
  favoriteBook: Book | null;
};

export type SeriesJourneyTransition =
  | {
      kind: "continued";
      days: number;
      started: string;
    }
  | {
      kind: "break";
      days: number;
      finished: string;
      started: string;
    };

export type SeriesBookWinners = {
  books: Book[];
  value: number;
};

export type SeriesDurationChartRow = {
  book: Book;
  days: number;
};

export type SeriesPaceChartRow = {
  book: Book;
  pagesPerDay: number;
};

export type SeriesRankedBook = {
  book: Book;
  value: number;
};

export type SeriesFavoriteQuote = {
  book: Book;
  note: BookNote;
};

export type SeriesStats = {
  overview: {
    finishedBooks: number;
    totalBooks: number;
    pagesRead: number | null;
    readingMinutes: number;
    journeySpan: CalendarSpan | null;
    journeyDays: number | null;
  };
  averageDaysPerBook: number | null;
  fastestRead: SeriesBookWinners | null;
  slowestRead: SeriesBookWinners | null;
  longestBook: SeriesBookWinners | null;
  shortestBook: SeriesBookWinners | null;
  durationChart: SeriesDurationChartRow[];
  paceChart: SeriesPaceChartRow[];
  rankings: {
    rating: SeriesRankedBook[];
    pace: SeriesRankedBook[];
    annotations: SeriesRankedBook[];
  };
  favoriteQuotes: SeriesFavoriteQuote[];
};

function compareBookTitles(a: Book, b: Book): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
}

function dateToDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLogDateOnly(log: ReadingLog): string | null {
  const date = new Date(log.logged_at);
  return Number.isNaN(date.getTime()) ? null : dateToDateOnly(date);
}

function getLogsForBook(book: Book, logs: ReadingLog[]): ReadingLog[] {
  return logs.filter((log) => log.book_id === book.id);
}

function daysBetween(started: string, finished: string): number | null {
  const startDate = parseLocalDateOnly(started);
  const finishedDate = parseLocalDateOnly(finished);
  if (!startDate || !finishedDate || finishedDate < startDate) return null;
  return Math.round((finishedDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
}

export function sortSeriesBooks(books: Book[]): Book[] {
  return [...books].sort((a, b) => {
    const volumeA = a.volume_number ?? Number.MAX_SAFE_INTEGER;
    const volumeB = b.volume_number ?? Number.MAX_SAFE_INTEGER;

    return volumeA - volumeB || compareBookTitles(a, b);
  });
}

export function getSeriesAuthors(books: Book[]): string[] {
  return Array.from(
    new Set(books.flatMap((book) => book.authors.map((author) => author.trim()).filter(Boolean))),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
}

export function getMostCommonGenre(books: Book[]): string | null {
  const counts = new Map<string, number>();

  books.forEach((book) => {
    Array.from(new Set(book.genres?.map((genre) => genre.trim()).filter(Boolean) ?? [])).forEach(
      (genre) => counts.set(genre, (counts.get(genre) ?? 0) + 1),
    );
  });

  return (
    [...counts.entries()].sort(
      ([nameA, countA], [nameB, countB]) =>
        countB - countA ||
        nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true }),
    )[0]?.[0] ?? null
  );
}

export function getAverageSeriesRating(books: Book[]): number | null {
  const ratings = books.flatMap((book) =>
    typeof book.rating === "number" ? [book.rating] : [],
  );
  if (ratings.length === 0) return null;

  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

export function getBookProgressPercent(book: Book): number | null {
  const totalPages = book.total_pages ?? 0;
  if (totalPages <= 0) return null;

  const pagesRead =
    book.status === "Finished"
      ? totalPages
      : Math.min(totalPages, Math.max(0, book.current_page ?? 0));
  return Math.round((pagesRead / totalPages) * 100);
}

export function getSeriesProgress(books: Book[]): SeriesProgress {
  const finishedBooks = books.filter((book) => book.status === "Finished").length;
  if (books.length === 0 || books.some((book) => !book.total_pages || book.total_pages <= 0)) {
    return {
      isAvailable: false,
      percentage: null,
      readPages: null,
      totalPages: null,
      finishedBooks,
    };
  }

  const totalPages = books.reduce((sum, book) => sum + (book.total_pages ?? 0), 0);
  const readPages = books.reduce((sum, book) => {
    const total = book.total_pages ?? 0;
    if (book.status === "Finished") return sum + total;
    if (book.status === "Reading" || book.status === "Paused" || book.status === "DNF") {
      return sum + Math.min(total, Math.max(0, book.current_page ?? 0));
    }
    return sum;
  }, 0);

  return {
    isAvailable: true,
    percentage: Math.round((readPages / totalPages) * 100),
    readPages,
    totalPages,
    finishedBooks,
  };
}

export function getNextUpBook(books: Book[]): Book | null {
  return (
    sortSeriesBooks(books).find(
      (book) => !["Finished", "DNF", "Reading", "Paused"].includes(book.status),
    ) ?? null
  );
}

export function getLatestSeriesActivity(
  books: Book[],
  logs: ReadingLog[],
): LatestSeriesActivity | null {
  const booksById = new Map(books.map((book) => [book.id, book]));
  const latestLog = [...logs]
    .filter((log) => booksById.has(log.book_id))
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())[0];

  if (!latestLog) return null;
  return { book: booksById.get(latestLog.book_id)!, log: latestLog };
}

export function filterSeriesLogs(books: Book[], logs: ReadingLog[]): ReadingLog[] {
  const bookIds = new Set(books.map((book) => book.id));
  return logs.filter((log) => bookIds.has(log.book_id));
}

export function getJourneyBookDates(book: Book, logs: ReadingLog[]): JourneyBookDates {
  const logDates = getLogsForBook(book, logs)
    .flatMap((log) => {
      const date = getLogDateOnly(log);
      return date ? [date] : [];
    })
    .sort();

  return {
    started: book.date_started ?? logDates[0] ?? null,
    finished:
      book.status === "Finished"
        ? book.date_finished ?? logDates[logDates.length - 1] ?? null
        : null,
  };
}

export function getBookReadingMinutes(book: Book, logs: ReadingLog[]): number {
  return sumReadingMinutes(getLogsForBook(book, logs));
}

export function getJourneyDurationDays(
  book: Book,
  logs: ReadingLog[],
  now = new Date(),
): number | null {
  const dates = getJourneyBookDates(book, logs);
  if (!dates.started) return null;

  const finished =
    dates.finished ??
    (book.status === "Reading" || book.status === "Paused" ? dateToDateOnly(now) : null);
  if (!finished) return null;

  const startedDate = parseLocalDateOnly(dates.started);
  const finishedDate = parseLocalDateOnly(finished);
  if (!startedDate || !finishedDate) return null;

  return getActiveDaysBetween(startedDate, finishedDate, book.pause_periods, now);
}

export function getSeriesJourneyRecap(
  books: Book[],
  logs: ReadingLog[],
  now = new Date(),
): SeriesJourneyRecap {
  const sortedBooks = sortSeriesBooks(books);
  const dates = sortedBooks.map((book) => getJourneyBookDates(book, logs));
  const started =
    dates.flatMap((date) => (date.started ? [date.started] : [])).sort()[0] ?? null;
  const sortedFinishedDates = dates
    .flatMap((date) => (date.finished ? [date.finished] : []))
    .sort();
  const latestFinish = sortedFinishedDates[sortedFinishedDates.length - 1] ?? null;
  const startedDate = parseLocalDateOnly(started ?? undefined);
  const latestFinishDate = parseLocalDateOnly(latestFinish ?? undefined);
  const favoriteBook =
    sortedBooks.find((book) => book.is_favorite) ??
    [...sortedBooks]
      .filter((book) => typeof book.rating === "number")
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ??
    null;

  return {
    started,
    timeSpentDays: sortedBooks.reduce(
      (total, book) => total + (getJourneyDurationDays(book, logs, now) ?? 0),
      0,
    ),
    finishedBooks: books.filter((book) => book.status === "Finished").length,
    completedMonths:
      startedDate && latestFinishDate && latestFinishDate >= startedDate
        ? calculateCalendarSpan(startedDate, latestFinishDate).months
        : null,
    favoriteBook,
  };
}

function getWinnerBooks(
  candidates: Array<{ book: Book; value: number }>,
  selectValue: (values: number[]) => number,
): SeriesBookWinners | null {
  if (candidates.length === 0) return null;

  const value = selectValue(candidates.map((candidate) => candidate.value));
  return {
    books: candidates
      .filter((candidate) => candidate.value === value)
      .map((candidate) => candidate.book),
    value,
  };
}

function getSeriesPagesRead(books: Book[]): number | null {
  let pagesRead = 0;

  for (const book of books) {
    if (book.status === "Finished") {
      if (typeof book.total_pages !== "number" || book.total_pages <= 0) return null;
      pagesRead += book.total_pages;
    } else if (book.status === "Reading" || book.status === "Paused") {
      if (
        typeof book.current_page !== "number" ||
        !Number.isFinite(book.current_page) ||
        book.current_page < 0
      ) {
        return null;
      }
      pagesRead += book.current_page;
    }
  }

  return pagesRead;
}

function getSeriesJourneySpan(
  books: Book[],
  logs: ReadingLog[],
  now: Date,
): Pick<SeriesStats["overview"], "journeySpan" | "journeyDays"> {
  const dates = books.map((book) => getJourneyBookDates(book, logs));
  const started =
    dates.flatMap((date) => (date.started ? [date.started] : [])).sort()[0] ?? null;
  const startDate = parseLocalDateOnly(started ?? undefined);
  if (!startDate) return { journeySpan: null, journeyDays: null };

  const hasActiveBook = books.some((book) => book.status === "Reading" || book.status === "Paused");
  const pausePeriods = books.flatMap((book) => book.pause_periods ?? []);
  const finishedDates = dates
    .flatMap((date) => (date.finished ? [date.finished] : []))
    .sort();
  const latestFinished = finishedDates[finishedDates.length - 1] ?? null;
  const endDate = hasActiveBook
    ? parseLocalDateOnly(dateToDateOnly(now))
    : parseLocalDateOnly(latestFinished ?? undefined);

  if (!endDate || endDate < startDate) {
    return { journeySpan: null, journeyDays: null };
  }

  return {
    journeySpan: calculateCalendarSpan(startDate, endDate),
    journeyDays: getActiveDaysBetween(startDate, endDate, pausePeriods, now),
  };
}

export function getSeriesStats(
  books: Book[],
  logs: ReadingLog[],
  notes: BookNote[],
  now = new Date(),
): SeriesStats {
  const sortedBooks = sortSeriesBooks(books);
  const bookIds = new Set(sortedBooks.map((book) => book.id));
  const bookOrder = new Map(sortedBooks.map((book, index) => [book.id, index]));
  const seriesLogs = filterSeriesLogs(sortedBooks, logs);
  const seriesNotes = notes.filter((note) => bookIds.has(note.book_id));
  const finishedBooks = sortedBooks.filter((book) => book.status === "Finished");
  const durations = finishedBooks.flatMap((book) => {
    const days = getJourneyDurationDays(book, seriesLogs, now);
    return days === null ? [] : [{ book, value: days }];
  });
  const paces = durations.flatMap(({ book, value }) =>
    value > 0 && typeof book.total_pages === "number" && book.total_pages > 0
      ? [{ book, value: book.total_pages / value }]
      : [],
  );
  const lengths = sortedBooks.flatMap((book) =>
    typeof book.total_pages === "number" && book.total_pages > 0
      ? [{ book, value: book.total_pages }]
      : [],
  );
  const notesByBook = new Map(
    sortedBooks.map((book) => [
      book.id,
      {
        annotated: seriesNotes.filter(
          (note) => note.book_id === book.id && (note.label === "note" || note.label === "quote"),
        ).length,
      },
    ]),
  );
  const annotations = sortedBooks.map((book) => ({
    book,
    value: notesByBook.get(book.id)?.annotated ?? 0,
  }));
  const ratingRanking = sortedBooks
    .flatMap((book) =>
      typeof book.rating === "number" ? [{ book, value: book.rating }] : [],
    )
    .sort((a, b) => b.value - a.value || Number(b.book.is_favorite) - Number(a.book.is_favorite));
  const paceRanking = [...paces].sort((a, b) => b.value - a.value);
  const annotationRanking = annotations
    .filter((candidate) => candidate.value > 0)
    .sort((a, b) => b.value - a.value);
  const favoriteQuotes = seriesNotes
    .filter(
      (note) =>
        note.label === "quote" &&
        note.is_favorite &&
        note.content.trim().length > 0,
    )
    .sort(
      (a, b) =>
        (bookOrder.get(a.book_id) ?? Number.MAX_SAFE_INTEGER) -
          (bookOrder.get(b.book_id) ?? Number.MAX_SAFE_INTEGER) ||
        b.note_date.localeCompare(a.note_date) ||
        b.created_at.localeCompare(a.created_at),
    )
    .map((note) => ({
      book: sortedBooks.find((book) => book.id === note.book_id)!,
      note,
    }));
  const journey = getSeriesJourneySpan(sortedBooks, seriesLogs, now);
  return {
    overview: {
      finishedBooks: finishedBooks.length,
      totalBooks: sortedBooks.length,
      pagesRead: getSeriesPagesRead(sortedBooks),
      readingMinutes: sumReadingMinutes(seriesLogs),
      ...journey,
    },
    averageDaysPerBook:
      durations.length > 0
        ? durations.reduce((sum, duration) => sum + duration.value, 0) / durations.length
        : null,
    fastestRead: getWinnerBooks(paces, (values) => Math.max(...values)),
    slowestRead: getWinnerBooks(paces, (values) => Math.min(...values)),
    longestBook: getWinnerBooks(lengths, (values) => Math.max(...values)),
    shortestBook: getWinnerBooks(lengths, (values) => Math.min(...values)),
    durationChart: durations.map(({ book, value }) => ({ book, days: value })),
    paceChart: paces.map(({ book, value }) => ({ book, pagesPerDay: value })),
    rankings: {
      rating: ratingRanking,
      pace: paceRanking,
      annotations: annotationRanking,
    },
    favoriteQuotes,
  };
}

export function getSeriesJourneyTransition(
  previousBook: Book,
  nextBook: Book,
  logs: ReadingLog[],
): SeriesJourneyTransition | null {
  if (previousBook.status !== "Finished") return null;

  const previousFinished = getJourneyBookDates(previousBook, logs).finished;
  const nextStarted = getJourneyBookDates(nextBook, logs).started;
  if (!previousFinished || !nextStarted) return null;

  const days = daysBetween(previousFinished, nextStarted);
  if (days === null) return null;
  if (days <= 1) {
    return { kind: "continued", days, started: nextStarted };
  }
  if (days > 10) {
    return {
      kind: "break",
      days,
      finished: previousFinished,
      started: nextStarted,
    };
  }
  return null;
}

export function getFeaturedNoteCandidates(notes: BookNote[]): BookNote[] {
  return [...notes]
    .filter((note) => note.content.trim().length > 0)
    .sort(
      (a, b) =>
        a.content.trim().length - b.content.trim().length ||
        Number(b.is_favorite) - Number(a.is_favorite) ||
        b.note_date.localeCompare(a.note_date),
    );
}
