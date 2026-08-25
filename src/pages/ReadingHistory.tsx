import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import BookTimeline, { type BookTimelineItem } from "@/components/BookTimeline";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { parseLocalDateOnly } from "@/lib/bookAnalytics";
import type { Book } from "@/types";

function formatDate(value?: string | null): string {
  const date = parseLocalDateOnly(value ?? undefined);
  if (!date) return "--";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatFinishedDate(value?: string | null): string {
  return value ? formatDate(value) : "No finished date";
}

function formatDaysSpent(book: Book): string {
  const started = parseLocalDateOnly(book.date_started);
  const finished = parseLocalDateOnly(book.date_finished);
  if (!started || !finished) return "--";

  const oneDayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(1, Math.round((finished.getTime() - started.getTime()) / oneDayMs) + 1);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function getHistoryTime(book: Book): number {
  const value = book.date_finished ?? book.date_started ?? book.created_at;
  const time = new Date(value.includes("T") ? value : `${value}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getDateLabel(book: Book): { month: string; year: string } {
  const value = book.date_finished ?? book.date_started ?? book.created_at;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return { month: "--", year: "" };
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    year: String(date.getFullYear()),
  };
}

export default function ReadingHistory() {
  const { books, loading, error, reload } = useBooksContext();
  const navigate = useNavigate();

  const historyBooks = useMemo(
    () =>
      books
        .filter((book) => Boolean(book.date_started || book.date_finished))
        .sort((a, b) => getHistoryTime(b) - getHistoryTime(a) || a.title.localeCompare(b.title)),
    [books],
  );

  const timelineItems = useMemo<BookTimelineItem[]>(
    () =>
      historyBooks.map((book, index) => ({
        book,
        dateLabel: getDateLabel(book),
        subtitle: book.authors.length > 0 ? book.authors.join(", ") : "Unknown author",
        showDate: true,
        showPoint: true,
        showDivider: index < historyBooks.length - 1,
        details: (
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <span>Started: {formatDate(book.date_started)}</span>
            <span>Finished: {formatFinishedDate(book.date_finished)}</span>
            <span>Days spent: {formatDaysSpent(book)}</span>
          </div>
        ),
      })),
    [historyBooks],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <AppHeading level={1}>Reading History</AppHeading>
        <HeadingDescription>Books you started or finished, newest first.</HeadingDescription>
      </div>

      {timelineItems.length > 0 ? (
        <BookTimeline items={timelineItems} onBook={(book) => navigate(`/books/${book.id}`)} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Books will appear here after you add reading dates.</p>
        </div>
      )}
    </div>
  );
}
