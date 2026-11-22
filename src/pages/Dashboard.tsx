import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import LoadingIndicator from "@/components/LoadingIndicator";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import { BookShelf, ReadingBookCard, type HomeBook } from "@/components/redesign/HomeCards";
import { QuickProgress } from "@/components/redesign/RedesignHome";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/reading-journal";
import { useBooksContext } from "@/context/BooksContext";
import { getTodayLocalDate } from "@/lib/utils";
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

function toHomeBook(book: Book): HomeBook {
  return {
    id: book.id,
    title: book.title,
    author: book.authors.join(", "),
    cover: book.cover_url,
    currentPage: Math.max(0, book.current_page ?? 0),
    totalPages: book.total_pages,
    status: book.status,
  };
}

function HomeSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="rj-home-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const { books, loading, error, reload, updateBook } = useBooksContext();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState("");
  const [progress, setProgress] = useState<{ book: Book; open: boolean } | null>(null);
  const progressTrigger = useRef<HTMLButtonElement | null>(null);
  const homeRef = useRef<HTMLDivElement>(null);

  const currentlyReading = books.filter(book => book.status === "Reading").map(toHomeBook);
  const paused = books.filter(book => book.status === "Paused").map(toHomeBook);
  const upNext = books.filter(book => book.status === "Up Next").map(toHomeBook);
  const today = new Date();
  const recentlyFinished = books
    .filter(book => isRecentlyFinished(book, today))
    .sort((a, b) => (b.date_finished ?? "").localeCompare(a.date_finished ?? ""))
    .map(toHomeBook);

  function openBook(book: HomeBook) {
    navigate(`/books/${book.id}`);
  }

  function openProgress(book: HomeBook, trigger: HTMLButtonElement) {
    const record = books.find(item => item.id === book.id);
    if (!record) return;
    progressTrigger.current = trigger;
    setProgress({ book: record, open: true });
  }

  async function saveProgress(book: Book, newPage: number) {
    const total = book.total_pages ?? 0;
    await updateBook(book.id, {
      current_page: newPage,
      ...(total > 0 && newPage >= total ? {
        status: "Finished",
        ...(book.date_finished ? {} : { date_finished: getTodayLocalDate() }),
      } : {}),
    });
  }

  if (loading) {
    return <LoadingIndicator variant="page" label="Loading your library…" />;
  }

  if (error) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="Your reading space couldn’t load"
        message={error}
        action={<Button variant="outline" onClick={() => void reload()}>Try again</Button>}
      />
    );
  }

  return (
    <div ref={homeRef} tabIndex={-1} className="rj-app-home">
      {currentlyReading.length > 0 ? (
        <QuickProgress
          books={currentlyReading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRead={openProgress}
        />
      ) : (
        <h1 className="rj-app-home-title">Home</h1>
      )}

      <div className="rj-app-home-shelves">
        <HomeSection id="currently-reading" title="Currently Reading">
          {currentlyReading.length === 0 ? (
            <EmptyState
              compact
              icon={BookOpen}
              title="Nothing currently reading"
              message="Choose a book from your library to start reading."
              action={<Button asChild variant="outline"><Link to="/library">Browse library</Link></Button>}
            />
          ) : currentlyReading.length === 1 ? (
            <ReadingBookCard book={currentlyReading[0]} onOpen={openBook} />
          ) : (
            <BookShelf books={currentlyReading} onOpen={openBook} showStatus={false} />
          )}
        </HomeSection>

        {upNext.length > 0 && (
          <HomeSection id="up-next" title="Up Next">
            <BookShelf books={upNext} onOpen={openBook} showStatus={false} />
          </HomeSection>
        )}

        {paused.length > 0 && (
          <HomeSection id="paused" title="Paused">
            <BookShelf books={paused} onOpen={openBook} showStatus={false} />
          </HomeSection>
        )}

        <HomeSection id="recently-finished" title="Recently Finished">
          {recentlyFinished.length > 0
            ? <BookShelf books={recentlyFinished} onOpen={openBook} showStatus={false} />
            : <EmptyState compact message="No books finished in the last 4 weeks." />}
        </HomeSection>
      </div>

      {progress && (
        <ReadingProgressDialog
          book={progress.book}
          open={progress.open}
          onOpenChange={(open) => setProgress(current => current && { ...current, open })}
          onProgressSaved={(page) => saveProgress(progress.book, page)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const trigger = progressTrigger.current;
            if (trigger?.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
            else homeRef.current?.focus({ preventScroll: true });
            setProgress(current => current?.open ? current : null);
          }}
        />
      )}
    </div>
  );
}
