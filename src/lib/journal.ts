import type {
  AuthorJournalEntryRecord,
  Book,
  BookJournalEntryRecord,
  JournalEntryLabel,
  JournalEntry,
  JournalEntryType,
  ReadingLog,
  SeriesJournalEntryRecord,
} from "@/types";

export interface BookJournalEntryRecordJournalEntry extends JournalEntry {
  source: "book_note";
  bookJournalEntry: BookJournalEntryRecord;
  relatedBookTitle?: string;
  relatedContext?: "series" | "author";
}

export interface SeriesJournalEntryRecordJournalEntry extends JournalEntry {
  source: "series_note";
  seriesJournalEntry: SeriesJournalEntryRecord;
}

export interface AuthorJournalEntryRecordJournalEntry extends JournalEntry {
  source: "author_note";
  authorJournalEntry: AuthorJournalEntryRecord;
}

export type GeneratedBookJournalEventType = Extract<
  JournalEntryType,
  | "started_reading"
  | "finished_reading"
  | "rating_added"
  | "reading_progress_milestone"
  | "reading_session"
>;

export interface GeneratedBookJournalEntry extends JournalEntry {
  source: "generated_book_event";
  type: GeneratedBookJournalEventType;
  label: string;
  description?: string;
  metadata?: {
    currentPage?: number;
    totalPages?: number;
    progressPercent?: number;
    readingMinutes?: number;
    sessionCount?: number;
    rating?: number;
    milestone?: number;
    sessions?: Array<{
      id: string;
      loggedAt: string;
      currentPage: number;
      readingMinutes?: number;
    }>;
  };
}

export type JournalTimelineEntry =
  | BookJournalEntryRecordJournalEntry
  | SeriesJournalEntryRecordJournalEntry
  | AuthorJournalEntryRecordJournalEntry
  | GeneratedBookJournalEntry;

const BOOK_NOTE_LABEL_TO_JOURNAL_TYPE: Record<JournalEntryLabel, JournalEntryType> = {
  note: "thought",
  quote: "passage",
  review: "thought",
};

export function bookJournalEntryLabelToJournalEntryType(
  label: JournalEntryLabel,
): JournalEntryType {
  return BOOK_NOTE_LABEL_TO_JOURNAL_TYPE[label];
}

export function bookJournalEntryToJournalEntry(note: BookJournalEntryRecord): BookJournalEntryRecordJournalEntry {
  return {
    id: `book-note:${note.id}`,
    entityType: "Book",
    entityId: note.book_id,
    type: bookJournalEntryLabelToJournalEntryType(note.label),
    source: "book_note",
    sourceId: note.id,
    createdAt: note.entry_date ?? note.created_at,
    updatedAt: note.updated_at,
    bookJournalEntry: note,
  };
}

export function bookJournalToJournalEntries(journalEntries: BookJournalEntryRecord[]): BookJournalEntryRecordJournalEntry[] {
  return journalEntries.map(bookJournalEntryToJournalEntry);
}

export function bookJournalEntryToRelatedJournalEntry(
  note: BookJournalEntryRecord,
  input: {
    entityType: "Series" | "Author" | "Book";
    entityId: string;
    bookTitle?: string;
    context?: "series" | "author";
  },
): BookJournalEntryRecordJournalEntry {
  return {
    ...bookJournalEntryToJournalEntry(note),
    id:
      input.entityType === "Book"
        ? `book-note:${note.id}`
        : `${input.entityType.toLocaleLowerCase()}-book-note:${input.entityId}:${note.id}`,
    entityType: input.entityType,
    entityId: input.entityId,
    relatedBookTitle: input.bookTitle,
    relatedContext: input.context,
  };
}

export function seriesJournalEntryToJournalEntry(note: SeriesJournalEntryRecord): SeriesJournalEntryRecordJournalEntry {
  return {
    id: `series-note:${note.id}`,
    entityType: "Series",
    entityId: note.series_id,
    type: bookJournalEntryLabelToJournalEntryType(note.label ?? "note"),
    source: "series_note",
    sourceId: note.id,
    createdAt: note.entry_date ?? note.created_at,
    updatedAt: note.updated_at,
    seriesJournalEntry: note,
  };
}

export function seriesJournalToJournalEntries(journalEntries: SeriesJournalEntryRecord[]): SeriesJournalEntryRecordJournalEntry[] {
  return journalEntries.map(seriesJournalEntryToJournalEntry);
}

export function authorJournalEntryToJournalEntry(note: AuthorJournalEntryRecord): AuthorJournalEntryRecordJournalEntry {
  return {
    id: `author-note:${note.id}`,
    entityType: "Author",
    entityId: note.author_id,
    type: bookJournalEntryLabelToJournalEntryType(note.label ?? "note"),
    source: "author_note",
    sourceId: note.id,
    createdAt: note.entry_date ?? note.created_at,
    updatedAt: note.updated_at,
    authorJournalEntry: note,
  };
}

export function authorJournalToJournalEntries(journalEntries: AuthorJournalEntryRecord[]): AuthorJournalEntryRecordJournalEntry[] {
  return journalEntries.map(authorJournalEntryToJournalEntry);
}

function dateOnlyToTimestamp(value: string): string {
  return value.includes("T") ? value : `${value}T00:00:00`;
}

function getBookEventUpdatedAt(book: Book): string {
  return book.date_finished ?? book.date_started ?? book.created_at;
}

function getProgressPercent(currentPage: number, totalPages?: number | null): number | null {
  if (!totalPages || totalPages <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)));
}

function getJournalDateKey(value: string): string {
  return value.slice(0, 10);
}

function dateKeyToTime(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

function areConsecutiveDateKeys(previous: string, next: string): boolean {
  const oneDay = 24 * 60 * 60 * 1000;
  return dateKeyToTime(next) - dateKeyToTime(previous) === oneDay;
}

function createGeneratedBookEvent(
  book: Book,
  input: Omit<GeneratedBookJournalEntry, "entityType" | "entityId" | "source" | "updatedAt">,
): GeneratedBookJournalEntry {
  return {
    ...input,
    entityType: "Book",
    entityId: book.id,
    source: "generated_book_event",
    updatedAt: getBookEventUpdatedAt(book),
  };
}

export function buildGeneratedBookJournalEntries(
  book: Book,
  logs: ReadingLog[] = [],
  options: {
    uncompressedReadingLogIds?: Set<string>;
    sessionBarrierDateKeys?: Set<string>;
    sessionBarrierPages?: Set<number>;
  } = {},
): GeneratedBookJournalEntry[] {
  const entries: GeneratedBookJournalEntry[] = [];
  const sortedLogs = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const uncompressedReadingLogIds = options.uncompressedReadingLogIds ?? new Set<string>();
  const sessionBarrierDateKeys = options.sessionBarrierDateKeys ?? new Set<string>();
  const sessionBarrierPages = options.sessionBarrierPages ?? new Set<number>();

  if (book.date_started) {
    entries.push(
      createGeneratedBookEvent(book, {
        id: `generated:book:${book.id}:started-reading`,
        type: "started_reading",
        sourceId: `book:${book.id}:date_started`,
        createdAt: dateOnlyToTimestamp(book.date_started),
        label: "Started reading",
      }),
    );
  }

  if (book.date_finished) {
    entries.push(
      createGeneratedBookEvent(book, {
        id: `generated:book:${book.id}:finished-reading`,
        type: "finished_reading",
        sourceId: `book:${book.id}:date_finished`,
        createdAt: dateOnlyToTimestamp(book.date_finished),
        label: "Finished reading",
      }),
    );
  }

  if (typeof book.rating === "number") {
    entries.push(
      createGeneratedBookEvent(book, {
        id: `generated:book:${book.id}:rating-added`,
        type: "rating_added",
        sourceId: `book:${book.id}:rating`,
        createdAt: dateOnlyToTimestamp(book.date_finished ?? book.created_at),
        label: "Rating added",
        description: `${book.rating} out of 5 stars`,
        metadata: { rating: book.rating },
      }),
    );
  }

  const loggedMilestones = new Set<number>();
  const logsByDay = new Map<string, ReadingLog[]>();

  sortedLogs.forEach((log) => {
    const dateKey = getJournalDateKey(log.logged_at);
    logsByDay.set(dateKey, [...(logsByDay.get(dateKey) ?? []), log]);
  });

  function hasPageBarrierBetween(previousPage: number, nextPage: number): boolean {
    const low = Math.min(previousPage, nextPage);
    const high = Math.max(previousPage, nextPage);
    return [...sessionBarrierPages].some((page) => page > low && page <= high);
  }

  function hasDateBarrierBetween(previousDateKey: string, nextDateKey: string): boolean {
    if (previousDateKey === nextDateKey) return false;
    return [...sessionBarrierDateKeys].some((dateKey) => dateKey > previousDateKey && dateKey <= nextDateKey);
  }

  const dayGroups = [...logsByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([dateKey, dailyLogs]) => {
      const sortedDailyLogs = [...dailyLogs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
      const segments: ReadingLog[][] = [];
      let currentSegment: ReadingLog[] = [];

      sortedDailyLogs.forEach((log) => {
        const previousLog = currentSegment[currentSegment.length - 1];
        const shouldSplitBefore =
          previousLog &&
          (uncompressedReadingLogIds.has(previousLog.id) ||
            uncompressedReadingLogIds.has(log.id) ||
            hasPageBarrierBetween(previousLog.current_page, log.current_page));

        if (shouldSplitBefore) {
          segments.push(currentSegment);
          currentSegment = [];
        }

        currentSegment.push(log);

        if (uncompressedReadingLogIds.has(log.id)) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      });

      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }

      return segments.map((segment) => {
        const firstLog = segment[0];
        const lastLog = segment[segment.length - 1];
        const key = segment.length === sortedDailyLogs.length ? dateKey : `${dateKey}:${firstLog.id}:${lastLog.id}`;
        return [key, segment] as [string, ReadingLog[]];
      });
    });
  const consecutiveGroups: Array<Array<[string, ReadingLog[]]>> = [];

  dayGroups.forEach((dayGroup) => {
    const dayDateKey = dayGroup[0].slice(0, 10);
    const groupLogs = dayGroup[1];
    const firstGroupLog = groupLogs[0];
    const hasBarrier = groupLogs.some((log) => uncompressedReadingLogIds.has(log.id));
    const previousGroup = consecutiveGroups[consecutiveGroups.length - 1];
    const previousDateKey = previousGroup?.[previousGroup.length - 1]?.[0].slice(0, 10);
    const previousLogs = previousGroup?.flatMap(([, logsForDay]) => logsForDay) ?? [];
    const previousFinalLog = previousLogs[previousLogs.length - 1];
    const previousHasBarrier = previousGroup?.some(([, logsForDay]) => (
      logsForDay.some((log) => uncompressedReadingLogIds.has(log.id))
    )) ?? false;
    const hasPageBarrier = previousFinalLog && firstGroupLog
      ? hasPageBarrierBetween(previousFinalLog.current_page, firstGroupLog.current_page)
      : false;
    const hasDateBarrier = previousDateKey ? hasDateBarrierBetween(previousDateKey, dayDateKey) : false;
    if (!previousGroup || !previousDateKey || hasBarrier || previousHasBarrier || hasPageBarrier || hasDateBarrier || !areConsecutiveDateKeys(previousDateKey, dayDateKey)) {
      consecutiveGroups.push([dayGroup]);
      return;
    }

    previousGroup.push(dayGroup);
  });

  consecutiveGroups.forEach((group) => {
    const groupedLogs = group.flatMap(([, dailyLogs]) => dailyLogs);
    const finalLog = groupedLogs[groupedLogs.length - 1];
    const progressPercent = getProgressPercent(finalLog.current_page, book.total_pages);
    const totalReadingMinutes = groupedLogs.reduce(
      (total, log) => total + Math.max(0, log.reading_time_minutes ?? 0),
      0,
    );
    const sessionCount = groupedLogs.length;
    const dayCount = group.length;
    const isSingleSession = sessionCount === 1;
    const entryIdSuffix = isSingleSession ? groupedLogs[0].id : `${groupedLogs[0].id}:${finalLog.id}`;
    const sourceId = isSingleSession
      ? `reading_log:${groupedLogs[0].id}`
      : `reading_logs:${book.id}:${groupedLogs[0].id}:${finalLog.id}`;

    entries.push(
      createGeneratedBookEvent(book, {
        id: `generated:book:${book.id}:reading-session:${entryIdSuffix}`,
        type: "reading_session",
        sourceId,
        createdAt: finalLog.logged_at,
        label: sessionCount === 1 ? "Reading session" : "Reading sessions",
        description:
          totalReadingMinutes > 0
            ? `${sessionCount} ${sessionCount === 1 ? "session" : "sessions"} over ${dayCount} ${dayCount === 1 ? "day" : "days"} · ${totalReadingMinutes} min total`
            : `${sessionCount} ${sessionCount === 1 ? "session" : "sessions"} over ${dayCount} ${dayCount === 1 ? "day" : "days"}`,
        metadata: {
          currentPage: finalLog.current_page,
          totalPages: book.total_pages,
          progressPercent: progressPercent ?? undefined,
          readingMinutes: totalReadingMinutes,
          sessionCount,
          sessions: groupedLogs.map((log) => ({
            id: log.id,
            loggedAt: log.logged_at,
            currentPage: log.current_page,
            readingMinutes: log.reading_time_minutes,
          })),
        },
      }),
    );
  });

  sortedLogs.forEach((log) => {
    const progressPercent = getProgressPercent(log.current_page, book.total_pages);
    const sessionMetadata = {
      currentPage: log.current_page,
      totalPages: book.total_pages,
      progressPercent: progressPercent ?? undefined,
      readingMinutes: log.reading_time_minutes,
    };

    if (progressPercent === null) return;

    [25, 50, 75, 100].forEach((milestone) => {
      if (progressPercent < milestone || loggedMilestones.has(milestone)) return;
      loggedMilestones.add(milestone);
      entries.push(
        createGeneratedBookEvent(book, {
          id: `generated:book:${book.id}:progress-${milestone}`,
          type: "reading_progress_milestone",
          sourceId: `reading_log:${log.id}:progress-${milestone}`,
          createdAt: log.logged_at,
          label: `${milestone}% milestone`,
          description: `Reached page ${log.current_page}`,
          metadata: {
            ...sessionMetadata,
            milestone,
            progressPercent: milestone,
          },
        }),
      );
    });
  });

  return sortJournalEntries(entries);
}

export function buildGeneratedSeriesJournalEntries(
  seriesId: string,
  books: Book[] = [],
): GeneratedBookJournalEntry[] {
  const entries: GeneratedBookJournalEntry[] = [];
  const seriesBooks = [...books].sort((a, b) => {
    const volumeCompare = (a.volume_number ?? 0) - (b.volume_number ?? 0);
    if (volumeCompare !== 0) return volumeCompare;
    return a.title.localeCompare(b.title);
  });
  const finishedBooks = seriesBooks
    .filter((book) => book.date_finished)
    .sort((a, b) => (a.date_finished ?? "").localeCompare(b.date_finished ?? ""));
  const totalBooks = seriesBooks.length;
  const loggedMilestones = new Set<number>();

  finishedBooks.forEach((book, index) => {
    const finishedAt = dateOnlyToTimestamp(book.date_finished!);
    entries.push({
      id: `generated:series:${seriesId}:finished-book:${book.id}`,
      entityType: "Series",
      entityId: seriesId,
      source: "generated_book_event",
      sourceId: `series:${seriesId}:finished-book:${book.id}`,
      type: "finished_reading",
      createdAt: finishedAt,
      updatedAt: finishedAt,
      label: "Finished book",
      description: book.title,
      metadata: {
        currentPage: index + 1,
        totalPages: totalBooks || undefined,
        progressPercent: totalBooks ? Math.round(((index + 1) / totalBooks) * 100) : undefined,
      },
    });

    if (!totalBooks) return;
    const progressPercent = Math.round(((index + 1) / totalBooks) * 100);
    [25, 50, 75, 100].forEach((milestone) => {
      if (progressPercent < milestone || loggedMilestones.has(milestone)) return;
      loggedMilestones.add(milestone);
      entries.push({
        id: `generated:series:${seriesId}:milestone:${milestone}`,
        entityType: "Series",
        entityId: seriesId,
        source: "generated_book_event",
        sourceId: `series:${seriesId}:milestone:${milestone}`,
        type: "reading_progress_milestone",
        createdAt: finishedAt,
        updatedAt: finishedAt,
        label: `${milestone}% series milestone`,
        description: `Reached with ${book.title}`,
        metadata: {
          currentPage: index + 1,
          totalPages: totalBooks,
          progressPercent: milestone,
          milestone,
        },
      });
    });
  });

  return sortJournalEntries(entries);
}

export function buildGeneratedAuthorJournalEntries(
  authorName: string,
  authorId: string,
  books: Book[] = [],
): GeneratedBookJournalEntry[] {
  const entries: GeneratedBookJournalEntry[] = [];
  const finishedBooks = books
    .filter((book) => book.date_finished)
    .sort((a, b) => (a.date_finished ?? "").localeCompare(b.date_finished ?? ""));

  finishedBooks.forEach((book, index) => {
    const finishedCount = index + 1;
    if (finishedCount % 5 !== 0) return;
    const createdAt = dateOnlyToTimestamp(book.date_finished!);
    entries.push({
      id: `generated:author:${authorId}:books-read:${finishedCount}`,
      entityType: "Author",
      entityId: authorId,
      source: "generated_book_event",
      sourceId: `author:${authorId}:books-read:${finishedCount}`,
      type: "reading_progress_milestone",
      createdAt,
      updatedAt: createdAt,
      label: `Read ${finishedCount} books`,
      description: `Reached with ${book.title} by ${authorName}`,
      metadata: {
        currentPage: finishedCount,
        totalPages: books.length || undefined,
        milestone: finishedCount,
      },
    });
  });

  return sortJournalEntries(entries);
}

export function sortJournalEntries<T extends JournalEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const dateCompare = b.createdAt.localeCompare(a.createdAt);
    if (dateCompare !== 0) return dateCompare;

    const updatedCompare = b.updatedAt.localeCompare(a.updatedAt);
    if (updatedCompare !== 0) return updatedCompare;

    return b.id.localeCompare(a.id);
  });
}

export function getJournalEntryTags(entry: JournalTimelineEntry): string[] {
  if (entry.source === "book_note") return entry.bookJournalEntry.tags ?? [];
  if (entry.source === "series_note") return entry.seriesJournalEntry.tags ?? [];
  if (entry.source === "author_note") return entry.authorJournalEntry.tags ?? [];
  return [];
}

export function isThoughtJournalEntry(entry: JournalTimelineEntry): boolean {
  return entry.type === "thought" || entry.type === "note" || entry.type === "review";
}
