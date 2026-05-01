import { useNavigate } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";
import type { Book } from "@/types";

const RECENTLY_FINISHED_DAYS = 28;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDateOnly(value?: string): Date | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function isRecentlyFinished(book: Book, today = new Date()): boolean {
  const finishedDate = parseLocalDateOnly(book.date_finished);
  if (!finishedDate) return false;

  const end = startOfLocalDay(today);
  const start = new Date(end);
  start.setDate(start.getDate() - RECENTLY_FINISHED_DAYS);

  return finishedDate >= start && finishedDate <= end;
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl bg-muted aspect-[2/3]"
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { books, loading, error, reload } = useBooksContext();
  const navigate = useNavigate();

  function openBook(book: Book) {
    navigate(`/books/${book.id}`);
  }

  const currentlyReading = books.filter((b) => b.status === "Reading");
  const upNext = books.filter((b) => b.status === "Up Next");
  const recentlyFinished = books
    .filter((book) => isRecentlyFinished(book))
    .sort((a, b) => {
      const aFinished = parseLocalDateOnly(a.date_finished)?.getTime() ?? 0;
      const bFinished = parseLocalDateOnly(b.date_finished)?.getTime() ?? 0;
      return bFinished - aFinished;
    });

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-heading leading-snug font-medium">Dashboard</h1>
        <SkeletonGrid />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-heading leading-snug font-medium">Dashboard</h1>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const hasActiveBooks = currentlyReading.length > 0 || upNext.length > 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-heading leading-snug font-medium">Dashboard</h1>

      {!hasActiveBooks && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No active books yet.</p>
          <p className="text-sm text-muted-foreground">
            Tap <span className="font-medium">+</span> to add your first book.
          </p>
        </div>
      )}

      {currentlyReading.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-heading leading-snug font-medium">Currently Reading</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {currentlyReading.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={openBook}
                showQuickProgress
              />
            ))}
          </div>
        </section>
      )}

      {upNext.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-heading leading-snug font-medium">Up Next</h2>
          <div className="grid grid-cols-3 gap-2.5 md:max-w-[calc(100%-12rem-1rem)] md:grid-cols-4 md:gap-3 lg:max-w-[calc(100%-13rem-1rem)]">
            {upNext.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={openBook}
                textSize="compact"
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-heading leading-snug font-medium">Recently Finished</h2>
        {recentlyFinished.length > 0 ? (
          <div className="grid grid-cols-3 gap-2.5 md:max-w-[calc(100%-12rem-1rem)] md:grid-cols-4 md:gap-3 lg:max-w-[calc(100%-13rem-1rem)]">
            {recentlyFinished.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={openBook}
                textSize="compact"
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No books finished in the last 4 weeks.
          </p>
        )}
      </section>
    </div>
  );
}
