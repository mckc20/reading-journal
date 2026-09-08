import { useNavigate } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionHeader } from "@/components/reading-journal";
import { useBooksContext } from "@/context/BooksContext";
import BookCard from "@/components/BookCard";
import CurrentlyReadingBookCard from "@/components/CurrentlyReadingBookCard";
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
  const pausedBooks = books.filter((b) => b.status === "Paused");
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
        <PageHeader title="Home" />
        <SkeletonGrid />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="Home" />
        <EmptyState
          icon={RefreshCw}
          message={<span className="text-destructive">{error}</span>}
          action={<Button variant="outline" size="sm" onClick={() => reload()}><RefreshCw />Try again</Button>}
        />
      </div>
    );
  }

  const hasActiveBooks = currentlyReading.length > 0 || pausedBooks.length > 0 || upNext.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Home" />

      {!hasActiveBooks && (
        <EmptyState
          icon={BookOpen}
          title="No active books yet."
          message={<>Tap <span className="font-medium">+</span> to add your first book.</>}
        />
      )}

      {currentlyReading.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Currently Reading" level={4} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {currentlyReading.map((book) => (
              <CurrentlyReadingBookCard
                key={book.id}
                book={book}
                onBook={openBook}
                showQuickProgress
              />
            ))}
          </div>
        </section>
      )}

      {pausedBooks.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Paused" level={4} />
          <div className="grid grid-cols-3 gap-2.5 md:max-w-[calc(100%-12rem-1rem)] md:grid-cols-4 md:gap-3 lg:max-w-[calc(100%-13rem-1rem)]">
            {pausedBooks.map((book) => (
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

      {upNext.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Up Next" level={4} />
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
        <SectionHeader title="Recently Finished" level={4} />
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
          <EmptyState compact message="No books finished in the last 4 weeks." />
        )}
      </section>
    </div>
  );
}
