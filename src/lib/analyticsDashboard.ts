import type { Book, ReadingLog } from "@/types";

export type YearComparisonMetric = "books" | "pages" | "hours";

export interface TimeBucket {
  key: string;
  label: string;
  value: number;
}

export interface GenreMetric {
  label: string;
  value: number;
  bookCount: number;
}

export interface YearComparisonBucket {
  year: string;
  books: number;
  pages: number;
  hours: number;
}

export interface NamedPercentage {
  label: string;
  value: number;
  percentage: number;
}

export interface BookRecord {
  label: string;
  value: string;
  book?: Book;
}

export interface AnalyticsDashboardData {
  overview: {
    booksFinished: number;
    pagesRead: number;
    readingMinutes: number;
    averagePace: number | null;
  };
  trends: {
    booksFinishedByMonth: TimeBucket[];
    cumulativePagesByMonth: TimeBucket[];
    pagesReadByMonth: TimeBucket[];
    readingMinutesByMonth: TimeBucket[];
    yearComparison: YearComparisonBucket[];
    averagePaceByMonth: TimeBucket[];
    pagesPerDayDistribution: TimeBucket[];
  };
  habits: {
    weekdayMinutesPerDay: number | null;
    weekendMinutesPerDay: number | null;
    averageSessionMinutes: number | null;
    sprintSessionPercentage: number | null;
    marathonSessionPercentage: number | null;
  };
  preferences: {
    genreEvolution: Array<{
      year: string;
      genres: NamedPercentage[];
    }>;
    genreRatings: GenreMetric[];
    genreCompletionRates: GenreMetric[];
    mostReadAuthors: NamedPercentage[];
    highestRatedAuthors: Array<{
      label: string;
      value: number;
      bookCount: number;
    }>;
    formatDistribution: {
      physical: {
        total: number;
        hardcover: number;
        paperback: number;
      };
      ebook: number;
      audiobook: number;
      total: number;
    };
  };
  completion: {
    completedPercentage: number | null;
    dnfPercentage: number | null;
    averageCompletionDays: number | null;
    medianCompletionDays: number | null;
    abandonedGenres: NamedPercentage[];
    hasEnoughDnfData: boolean;
  };
  hallOfFame: {
    longestSession: BookRecord | null;
    mostPagesOneDay: BookRecord | null;
    fastestFinishedBook: BookRecord | null;
    longestFinishedBook: BookRecord | null;
    longestCompletionTime: BookRecord | null;
    mostBooksFinishedInMonth: BookRecord | null;
  };
  insights: {
    averageReadingGapDays: number | null;
    favoriteGenre: string | null;
    favoriteAuthor: string | null;
    mostProductiveMonth: string | null;
    averageBookLength: number | null;
    mostRereadAuthor: string | null;
    genreExploredMostThisYear: string | null;
    mostReadWeekday: string | null;
  };
}

interface PageDelta {
  bookId: string;
  loggedAt: Date;
  dayKey: string;
  monthKey: string;
  year: string;
  pages: number;
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
}

function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthKeyToDate(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatMonthLabel(monthKey: string): string {
  return monthKeyToDate(monthKey).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function formatRecordMonth(monthKey: string): string {
  return monthKeyToDate(monthKey).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthRange(keys: string[]): string[] {
  if (keys.length === 0) return [];
  const sorted = [...new Set(keys)].sort();
  const start = monthKeyToDate(sorted[0]);
  const end = monthKeyToDate(sorted[sorted.length - 1]);
  const months: string[] = [];

  for (let cursor = start; cursor <= end; cursor = addMonths(cursor, 1)) {
    months.push(toMonthKey(cursor));
  }

  return months;
}

function getMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatDays(days: number): string {
  const rounded = Math.round(days);
  if (rounded === 1) return "1 day";
  return `${rounded} days`;
}

function normalizeGenre(raw: string): string | null {
  const label = raw.trim().replace(/\s+/g, " ");
  return label.length > 0 ? label : null;
}

function getBookGenres(book: Book): string[] {
  const genres = book.genres ?? book.genre_paths ?? [];
  return Array.from(new Set(genres.map(normalizeGenre).filter((value): value is string => Boolean(value))));
}

function getBookAuthors(book: Book): string[] {
  return Array.from(new Set(book.authors.map((author) => author.trim()).filter(Boolean)));
}

function getCompletionDays(book: Book): number | null {
  const started = parseDate(book.date_started);
  const finished = parseDate(book.date_finished);
  if (!started || !finished || finished < started) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((finished.getTime() - started.getTime()) / dayMs));
}

function buildPageDeltas(logs: ReadingLog[]): PageDelta[] {
  const logsByBook = new Map<string, ReadingLog[]>();

  for (const log of logs) {
    const list = logsByBook.get(log.book_id) ?? [];
    list.push(log);
    logsByBook.set(log.book_id, list);
  }

  const deltas: PageDelta[] = [];

  for (const [bookId, bookLogs] of logsByBook.entries()) {
    const sortedLogs = [...bookLogs].sort(
      (left, right) => new Date(left.logged_at).getTime() - new Date(right.logged_at).getTime()
    );
    let previousPage = 0;

    for (const log of sortedLogs) {
      const loggedAt = parseDate(log.logged_at);
      if (!loggedAt) continue;

      const currentPage = Math.max(0, log.current_page);
      const pages = Math.max(0, currentPage - previousPage);
      previousPage = Math.max(previousPage, currentPage);

      if (pages <= 0) continue;

      deltas.push({
        bookId,
        loggedAt,
        dayKey: toDayKey(loggedAt),
        monthKey: toMonthKey(loggedAt),
        year: String(loggedAt.getFullYear()),
        pages,
      });
    }
  }

  return deltas.sort((left, right) => left.loggedAt.getTime() - right.loggedAt.getTime());
}

function sumByMonth<T>(items: T[], getMonthKey: (item: T) => string | null, getValue: (item: T) => number): TimeBucket[] {
  const totals = new Map<string, number>();
  const monthKeys: string[] = [];

  for (const item of items) {
    const monthKey = getMonthKey(item);
    if (!monthKey) continue;
    monthKeys.push(monthKey);
    totals.set(monthKey, (totals.get(monthKey) ?? 0) + getValue(item));
  }

  return getMonthRange(monthKeys).map((monthKey) => ({
    key: monthKey,
    label: formatMonthLabel(monthKey),
    value: totals.get(monthKey) ?? 0,
  }));
}

function topPercentages(counts: Map<string, number>, limit: number): NamedPercentage[] {
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([label, value]) => ({
      label,
      value,
      percentage: (value / total) * 100,
    }));
}

function topPercentagesWithOthers(counts: Map<string, number>, limit: number): NamedPercentage[] {
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  const sorted = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });
  const visible = sorted.slice(0, limit);
  const hidden = sorted.slice(limit);
  const data = visible.map(([label, value]) => ({
    label,
    value,
    percentage: (value / total) * 100,
  }));
  const hiddenTotal = hidden.reduce((sum, [, value]) => sum + value, 0);

  if (hiddenTotal > 0) {
    data.push({
      label: "Others",
      value: hiddenTotal,
      percentage: (hiddenTotal / total) * 100,
    });
  }

  return data;
}

function buildGenreEvolution(finishedBooks: Book[]) {
  const countsByYear = new Map<string, Map<string, number>>();

  for (const book of finishedBooks) {
    const finished = parseDate(book.date_finished);
    if (!finished) continue;
    const genres = getBookGenres(book);
    if (genres.length === 0) continue;
    const year = String(finished.getFullYear());
    const counts = countsByYear.get(year) ?? new Map<string, number>();

    for (const genre of genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }

    countsByYear.set(year, counts);
  }

  return [...countsByYear.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([year, counts]) => ({
      year,
      genres: topPercentagesWithOthers(counts, 6),
    }));
}

function buildGenreRatings(finishedBooks: Book[]): GenreMetric[] {
  const ratings = new Map<string, { total: number; count: number }>();

  for (const book of finishedBooks) {
    if (typeof book.rating !== "number") continue;
    for (const genre of getBookGenres(book)) {
      const current = ratings.get(genre) ?? { total: 0, count: 0 };
      current.total += book.rating;
      current.count += 1;
      ratings.set(genre, current);
    }
  }

  return [...ratings.entries()]
    .map(([label, value]) => ({
      label,
      value: value.total / value.count,
      bookCount: value.count,
    }))
    .sort((left, right) => {
      if (right.value !== left.value) return right.value - left.value;
      if (right.bookCount !== left.bookCount) return right.bookCount - left.bookCount;
      return left.label.localeCompare(right.label);
    });
}

function buildGenreCompletionRates(books: Book[]): GenreMetric[] {
  const outcomes = new Map<string, { completed: number; total: number }>();

  for (const book of books) {
    if (book.status !== "Finished" && book.status !== "DNF") continue;
    for (const genre of getBookGenres(book)) {
      const current = outcomes.get(genre) ?? { completed: 0, total: 0 };
      current.total += 1;
      if (book.status === "Finished") current.completed += 1;
      outcomes.set(genre, current);
    }
  }

  return [...outcomes.entries()]
    .filter(([, value]) => value.total > 0)
    .map(([label, value]) => ({
      label,
      value: (value.completed / value.total) * 100,
      bookCount: value.total,
    }))
    .sort((left, right) => {
      if (right.value !== left.value) return right.value - left.value;
      if (right.bookCount !== left.bookCount) return right.bookCount - left.bookCount;
      return left.label.localeCompare(right.label);
    });
}

function buildAuthorStats(finishedBooks: Book[]) {
  const counts = new Map<string, number>();
  const ratings = new Map<string, { total: number; count: number }>();

  for (const book of finishedBooks) {
    for (const author of getBookAuthors(book)) {
      counts.set(author, (counts.get(author) ?? 0) + 1);
      if (typeof book.rating === "number") {
        const current = ratings.get(author) ?? { total: 0, count: 0 };
        current.total += book.rating;
        current.count += 1;
        ratings.set(author, current);
      }
    }
  }

  return {
    mostReadAuthors: topPercentages(counts, 5),
    highestRatedAuthors: [...ratings.entries()]
      .filter(([, rating]) => rating.count > 0)
      .map(([label, rating]) => ({
        label,
        value: rating.total / rating.count,
        bookCount: rating.count,
      }))
      .sort((left, right) => {
        if (right.value !== left.value) return right.value - left.value;
        if (right.bookCount !== left.bookCount) return right.bookCount - left.bookCount;
        return left.label.localeCompare(right.label);
      })
      .slice(0, 5),
  };
}

function buildFormatDistribution(books: Book[]) {
  const physical = {
    total: 0,
    hardcover: 0,
    paperback: 0,
  };
  let ebook = 0;
  let audiobook = 0;

  for (const book of books) {
    if (book.format === "Hardcover") {
      physical.total += 1;
      physical.hardcover += 1;
    } else if (book.format === "Paperback") {
      physical.total += 1;
      physical.paperback += 1;
    } else if (book.format === "eBook") {
      ebook += 1;
    } else if (book.format === "Audiobook") {
      audiobook += 1;
    }
  }

  return {
    physical,
    ebook,
    audiobook,
    total: physical.total + ebook + audiobook,
  };
}

function buildHallOfFame(books: Book[], logs: ReadingLog[], pageDeltas: PageDelta[]): AnalyticsDashboardData["hallOfFame"] {
  const booksById = new Map(books.map((book) => [book.id, book]));
  const finishedBooks = books.filter((book) => book.status === "Finished");
  const completionCandidates = finishedBooks
    .map((book) => ({ book, days: getCompletionDays(book) }))
    .filter((entry): entry is { book: Book; days: number } => entry.days !== null);

  const longestSessionLog = [...logs]
    .filter((log) => (log.reading_time_minutes ?? 0) > 0)
    .sort((left, right) => (right.reading_time_minutes ?? 0) - (left.reading_time_minutes ?? 0))[0];

  const pagesByDay = new Map<string, { pages: number; bookId: string }>();
  for (const delta of pageDeltas) {
    const current = pagesByDay.get(delta.dayKey) ?? { pages: 0, bookId: delta.bookId };
    current.pages += delta.pages;
    if (delta.pages > 0) current.bookId = delta.bookId;
    pagesByDay.set(delta.dayKey, current);
  }
  const mostPagesDay = [...pagesByDay.entries()].sort((left, right) => right[1].pages - left[1].pages)[0];

  const booksByFinishMonth = new Map<string, number>();
  for (const book of finishedBooks) {
    const finished = parseDate(book.date_finished);
    if (!finished) continue;
    const monthKey = toMonthKey(finished);
    booksByFinishMonth.set(monthKey, (booksByFinishMonth.get(monthKey) ?? 0) + 1);
  }
  const bestMonth = [...booksByFinishMonth.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  })[0];

  const fastest = [...completionCandidates].sort((left, right) => left.days - right.days)[0];
  const longestCompletion = [...completionCandidates].sort((left, right) => right.days - left.days)[0];
  const longestBook = [...finishedBooks]
    .filter((book) => (book.total_pages ?? 0) > 0)
    .sort((left, right) => (right.total_pages ?? 0) - (left.total_pages ?? 0))[0];

  return {
    longestSession: longestSessionLog
      ? {
          label: "Longest Reading Session",
          value: `${longestSessionLog.reading_time_minutes} min`,
          book: booksById.get(longestSessionLog.book_id),
        }
      : null,
    mostPagesOneDay: mostPagesDay
      ? {
          label: "Most Pages In One Day",
          value: `${mostPagesDay[1].pages} pages`,
          book: booksById.get(mostPagesDay[1].bookId),
        }
      : null,
    fastestFinishedBook: fastest
      ? {
          label: "Fastest Finished Book",
          value: formatDays(fastest.days),
          book: fastest.book,
        }
      : null,
    longestFinishedBook: longestBook
      ? {
          label: "Longest Finished Book",
          value: `${longestBook.total_pages} pages`,
          book: longestBook,
        }
      : null,
    longestCompletionTime: longestCompletion
      ? {
          label: "Longest Completion Time",
          value: formatDays(longestCompletion.days),
          book: longestCompletion.book,
        }
      : null,
    mostBooksFinishedInMonth: bestMonth
      ? {
          label: "Most Books Finished In A Month",
          value: `${bestMonth[1]} books`,
          book: undefined,
        }
      : null,
  };
}

function buildReadingGaps(logs: ReadingLog[]): number | null {
  const dayKeys = Array.from(new Set(logs.map((log) => {
    const loggedAt = parseDate(log.logged_at);
    return loggedAt ? toDayKey(loggedAt) : null;
  }).filter((value): value is string => Boolean(value)))).sort();

  if (dayKeys.length < 2) return null;

  const gaps: number[] = [];
  for (let index = 1; index < dayKeys.length; index += 1) {
    const previous = parseDate(dayKeys[index - 1]);
    const current = parseDate(dayKeys[index]);
    if (!previous || !current) continue;
    const diffDays = Math.round((current.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
    gaps.push(Math.max(0, diffDays - 1));
  }

  if (gaps.length === 0) return null;
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}

function buildMostRereadAuthor(finishedBooks: Book[]): string | null {
  const titleCountsByAuthor = new Map<string, Map<string, number>>();

  for (const book of finishedBooks) {
    const normalizedTitle = book.title.trim().toLocaleLowerCase();
    if (!normalizedTitle) continue;

    for (const author of getBookAuthors(book)) {
      const titleCounts = titleCountsByAuthor.get(author) ?? new Map<string, number>();
      titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) ?? 0) + 1);
      titleCountsByAuthor.set(author, titleCounts);
    }
  }

  const rereadCounts = [...titleCountsByAuthor.entries()]
    .map(([author, titleCounts]) => ({
      author,
      count: [...titleCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.author.localeCompare(right.author);
    });

  return rereadCounts[0]?.author ?? null;
}

function buildGenreExploredMostThisYear(finishedBooks: Book[]): string | null {
  const currentYear = new Date().getFullYear();
  const counts = new Map<string, number>();

  for (const book of finishedBooks) {
    const finished = parseDate(book.date_finished);
    if (!finished || finished.getFullYear() !== currentYear) continue;

    for (const genre of getBookGenres(book)) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }

  return topPercentages(counts, 1)[0]?.label ?? null;
}

function buildMostReadWeekday(logs: ReadingLog[]): string | null {
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long" });
  const counts = new Map<string, number>();

  for (const log of logs) {
    const loggedAt = parseDate(log.logged_at);
    if (!loggedAt) continue;

    const weekday = weekdayFormatter.format(loggedAt);
    const value = Math.max(1, log.reading_time_minutes ?? 0);
    counts.set(weekday, (counts.get(weekday) ?? 0) + value);
  }

  return [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? null;
}

export function buildAnalyticsDashboardData(books: Book[], logs: ReadingLog[]): AnalyticsDashboardData {
  const finishedBooks = books.filter((book) => book.status === "Finished");
  const dnfBooks = books.filter((book) => book.status === "DNF");
  const activeBookIds = new Set(
    books.filter((book) => book.status === "Finished" || book.status === "Reading").map((book) => book.id)
  );
  const pageDeltas = buildPageDeltas(logs);
  const totalPageDeltas = pageDeltas.reduce((sum, delta) => sum + delta.pages, 0);
  const activePageDays = new Set(pageDeltas.map((delta) => delta.dayKey)).size;
  const monthlyPageDays = new Map<string, Set<string>>();

  for (const delta of pageDeltas) {
    const days = monthlyPageDays.get(delta.monthKey) ?? new Set<string>();
    days.add(delta.dayKey);
    monthlyPageDays.set(delta.monthKey, days);
  }

  const finishedDates = finishedBooks
    .map((book) => parseDate(book.date_finished))
    .filter((value): value is Date => Boolean(value));
  const logDates = logs.map((log) => parseDate(log.logged_at)).filter((value): value is Date => Boolean(value));
  const trendMonthKeys = [...finishedDates, ...logDates].map(toMonthKey);
  const allTrendMonths = getMonthRange(trendMonthKeys);

  const booksFinishedByMonth = sumByMonth(
    finishedBooks,
    (book) => {
      const finished = parseDate(book.date_finished);
      return finished ? toMonthKey(finished) : null;
    },
    () => 1
  );
  const pagesReadByMonthMap = new Map(sumByMonth(pageDeltas, (delta) => delta.monthKey, (delta) => delta.pages).map((bucket) => [bucket.key, bucket.value]));
  const readingMinutesByMonthMap = new Map(
    sumByMonth(
      logs,
      (log) => {
        const loggedAt = parseDate(log.logged_at);
        return loggedAt ? toMonthKey(loggedAt) : null;
      },
      (log) => Math.max(0, log.reading_time_minutes ?? 0)
    ).map((bucket) => [bucket.key, bucket.value])
  );

  const pagesReadByMonth = allTrendMonths.map((monthKey) => ({
    key: monthKey,
    label: formatMonthLabel(monthKey),
    value: pagesReadByMonthMap.get(monthKey) ?? 0,
  }));
  let cumulativePagesByMonthTotal = 0;
  const cumulativePagesByMonth = allTrendMonths.map((monthKey) => {
    cumulativePagesByMonthTotal += pagesReadByMonthMap.get(monthKey) ?? 0;
    return {
      key: monthKey,
      label: formatMonthLabel(monthKey),
      value: cumulativePagesByMonthTotal,
    };
  });
  const readingMinutesByMonth = allTrendMonths.map((monthKey) => ({
    key: monthKey,
    label: formatMonthLabel(monthKey),
    value: readingMinutesByMonthMap.get(monthKey) ?? 0,
  }));
  let cumulativePages = 0;
  const cumulativeActiveDays = new Set<string>();
  const averagePaceByMonth = allTrendMonths.map((monthKey) => {
    cumulativePages += pagesReadByMonthMap.get(monthKey) ?? 0;
    for (const dayKey of monthlyPageDays.get(monthKey) ?? []) {
      cumulativeActiveDays.add(dayKey);
    }

    return {
      key: monthKey,
      label: formatMonthLabel(monthKey),
      value: cumulativeActiveDays.size > 0 ? cumulativePages / cumulativeActiveDays.size : 0,
    };
  });

  const yearComparisonMap = new Map<string, YearComparisonBucket>();
  for (const book of finishedBooks) {
    const finished = parseDate(book.date_finished);
    if (!finished) continue;
    const year = String(finished.getFullYear());
    const current = yearComparisonMap.get(year) ?? { year, books: 0, pages: 0, hours: 0 };
    current.books += 1;
    yearComparisonMap.set(year, current);
  }
  for (const delta of pageDeltas) {
    const current = yearComparisonMap.get(delta.year) ?? { year: delta.year, books: 0, pages: 0, hours: 0 };
    current.pages += delta.pages;
    yearComparisonMap.set(delta.year, current);
  }
  for (const log of logs) {
    const loggedAt = parseDate(log.logged_at);
    if (!loggedAt || !log.reading_time_minutes) continue;
    const year = String(loggedAt.getFullYear());
    const current = yearComparisonMap.get(year) ?? { year, books: 0, pages: 0, hours: 0 };
    current.hours += log.reading_time_minutes / 60;
    yearComparisonMap.set(year, current);
  }

  const sessionsWithTime = logs.filter((log) => (log.reading_time_minutes ?? 0) > 0);
  const pagesByDay = new Map<string, number>();
  for (const delta of pageDeltas) {
    pagesByDay.set(delta.dayKey, (pagesByDay.get(delta.dayKey) ?? 0) + delta.pages);
  }
  const pagesPerDayBuckets = new Map([
    ["1-24", 0],
    ["25-49", 0],
    ["50-74", 0],
    ["75-99", 0],
    ["100-124", 0],
    ["125-149", 0],
    ["150-199", 0],
    ["200+", 0],
  ]);
  for (const pages of pagesByDay.values()) {
    if (pages < 25) pagesPerDayBuckets.set("1-24", (pagesPerDayBuckets.get("1-24") ?? 0) + 1);
    else if (pages < 50) pagesPerDayBuckets.set("25-49", (pagesPerDayBuckets.get("25-49") ?? 0) + 1);
    else if (pages < 75) pagesPerDayBuckets.set("50-74", (pagesPerDayBuckets.get("50-74") ?? 0) + 1);
    else if (pages < 100) pagesPerDayBuckets.set("75-99", (pagesPerDayBuckets.get("75-99") ?? 0) + 1);
    else if (pages < 125) pagesPerDayBuckets.set("100-124", (pagesPerDayBuckets.get("100-124") ?? 0) + 1);
    else if (pages < 150) pagesPerDayBuckets.set("125-149", (pagesPerDayBuckets.get("125-149") ?? 0) + 1);
    else if (pages < 200) pagesPerDayBuckets.set("150-199", (pagesPerDayBuckets.get("150-199") ?? 0) + 1);
    else pagesPerDayBuckets.set("200+", (pagesPerDayBuckets.get("200+") ?? 0) + 1);
  }
  const weekdayMinutes = new Map<string, number>();
  const weekendMinutes = new Map<string, number>();

  for (const log of sessionsWithTime) {
    const loggedAt = parseDate(log.logged_at);
    if (!loggedAt) continue;
    const key = toDayKey(loggedAt);
    const target = loggedAt.getDay() === 0 || loggedAt.getDay() === 6 ? weekendMinutes : weekdayMinutes;
    target.set(key, (target.get(key) ?? 0) + (log.reading_time_minutes ?? 0));
  }

  const sprintSessions = sessionsWithTime.filter((log) => (log.reading_time_minutes ?? 0) < 20).length;
  const marathonSessions = sessionsWithTime.filter((log) => (log.reading_time_minutes ?? 0) > 60).length;
  const densityTotal = sprintSessions + marathonSessions;

  const completionDays = finishedBooks
    .map(getCompletionDays)
    .filter((value): value is number => value !== null);
  const completionTotal = finishedBooks.length + dnfBooks.length;
  const dnfGenreCounts = new Map<string, number>();
  for (const book of dnfBooks) {
    for (const genre of getBookGenres(book)) {
      dnfGenreCounts.set(genre, (dnfGenreCounts.get(genre) ?? 0) + 1);
    }
  }

  const finishedGenreCounts = new Map<string, number>();
  for (const book of finishedBooks) {
    for (const genre of getBookGenres(book)) {
      finishedGenreCounts.set(genre, (finishedGenreCounts.get(genre) ?? 0) + 1);
    }
  }

  const finishedAuthorCounts = new Map<string, number>();
  for (const book of finishedBooks) {
    for (const author of getBookAuthors(book)) {
      finishedAuthorCounts.set(author, (finishedAuthorCounts.get(author) ?? 0) + 1);
    }
  }

  const mostProductiveMonth = [...booksFinishedByMonth].sort((left, right) => {
    if (right.value !== left.value) return right.value - left.value;
    return left.key.localeCompare(right.key);
  })[0];
  const averageBookLengthCandidates = finishedBooks
    .map((book) => book.total_pages ?? 0)
    .filter((pages) => pages > 0);
  const authorStats = buildAuthorStats(finishedBooks);

  return {
    overview: {
      booksFinished: finishedBooks.length,
      pagesRead: finishedBooks.reduce((sum, book) => sum + Math.max(0, book.total_pages ?? 0), 0),
      readingMinutes: logs
        .filter((log) => activeBookIds.has(log.book_id))
        .reduce((sum, log) => sum + Math.max(0, log.reading_time_minutes ?? 0), 0),
      averagePace: activePageDays > 0 ? totalPageDeltas / activePageDays : null,
    },
    trends: {
      booksFinishedByMonth,
      cumulativePagesByMonth,
      pagesReadByMonth,
      readingMinutesByMonth,
      yearComparison: [...yearComparisonMap.values()].sort((left, right) => left.year.localeCompare(right.year)),
      averagePaceByMonth,
      pagesPerDayDistribution: [...pagesPerDayBuckets.entries()].map(([key, value]) => ({ key, label: key, value })),
    },
    habits: {
      weekdayMinutesPerDay:
        weekdayMinutes.size > 0
          ? [...weekdayMinutes.values()].reduce((sum, minutes) => sum + minutes, 0) / weekdayMinutes.size
          : null,
      weekendMinutesPerDay:
        weekendMinutes.size > 0
          ? [...weekendMinutes.values()].reduce((sum, minutes) => sum + minutes, 0) / weekendMinutes.size
          : null,
      averageSessionMinutes:
        sessionsWithTime.length > 0
          ? sessionsWithTime.reduce((sum, log) => sum + (log.reading_time_minutes ?? 0), 0) / sessionsWithTime.length
          : null,
      sprintSessionPercentage: densityTotal > 0 ? (sprintSessions / densityTotal) * 100 : null,
      marathonSessionPercentage: densityTotal > 0 ? (marathonSessions / densityTotal) * 100 : null,
    },
    preferences: {
      genreEvolution: buildGenreEvolution(finishedBooks),
      genreRatings: buildGenreRatings(finishedBooks),
      genreCompletionRates: buildGenreCompletionRates(books),
      mostReadAuthors: authorStats.mostReadAuthors,
      highestRatedAuthors: authorStats.highestRatedAuthors,
      formatDistribution: buildFormatDistribution(books),
    },
    completion: {
      completedPercentage: completionTotal > 0 ? (finishedBooks.length / completionTotal) * 100 : null,
      dnfPercentage: completionTotal > 0 ? (dnfBooks.length / completionTotal) * 100 : null,
      averageCompletionDays:
        completionDays.length > 0
          ? completionDays.reduce((sum, days) => sum + days, 0) / completionDays.length
          : null,
      medianCompletionDays: getMedian(completionDays),
      abandonedGenres: topPercentages(dnfGenreCounts, 5),
      hasEnoughDnfData: dnfBooks.length >= 3,
    },
    hallOfFame: buildHallOfFame(books, logs, pageDeltas),
    insights: {
      averageReadingGapDays: buildReadingGaps(logs),
      favoriteGenre: topPercentages(finishedGenreCounts, 1)[0]?.label ?? null,
      favoriteAuthor: topPercentages(finishedAuthorCounts, 1)[0]?.label ?? null,
      mostProductiveMonth: mostProductiveMonth?.value > 0 ? formatRecordMonth(mostProductiveMonth.key) : null,
      averageBookLength:
        averageBookLengthCandidates.length > 0
          ? averageBookLengthCandidates.reduce((sum, pages) => sum + pages, 0) / averageBookLengthCandidates.length
          : null,
      mostRereadAuthor: buildMostRereadAuthor(finishedBooks),
      genreExploredMostThisYear: buildGenreExploredMostThisYear(finishedBooks),
      mostReadWeekday: buildMostReadWeekday(logs),
    },
  };
}
