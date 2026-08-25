import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import AuthorCard from "@/components/AuthorCard";
import { Button } from "@/components/ui/button";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { buildAuthorSummaries, getAuthorInitials, type AuthorSummary } from "@/lib/authorShelf";
import {
  sortAuthorsByName,
  sortAuthorsForTopShelf,
  sortAuthorsByRecentlyRead,
  sortAuthorsByMostRead,
  wasReadInRecentWindow,
} from "@/lib/authorsView";
import { fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import type { BookJournalEntryRecord } from "@/types";

const ALL_AUTHORS_PREVIEW_LIMIT = 6;

function LoadingAuthors() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-[22rem] animate-pulse rounded-2xl bg-muted/40" />
      ))}
    </div>
  );
}

function EmptyAuthorsState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function AuthorAvatar({ author }: { author: AuthorSummary }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-medium text-primary-foreground shadow-sm">
      {author.photo_url ? (
        <img src={author.photo_url} alt={author.name} className="h-full w-full object-cover" />
      ) : (
        getAuthorInitials(author.name)
      )}
    </div>
  );
}

function buildExplorePath(sort: "top-rated" | "latest-read" | "most-read") {
  const params = new URLSearchParams();
  params.set("sort", sort);
  return `/library/authors?${params.toString()}`;
}

function AuthorShelfRow({
  title,
  authors,
  emptyMessage,
  viewAllPath,
}: {
  title: string;
  authors: AuthorSummary[];
  emptyMessage: string;
  viewAllPath: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollButtons() {
    const row = rowRef.current;
    if (!row) return;

    setCanScrollLeft(row.scrollLeft > 1);
    setCanScrollRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
  }

  function scrollOneAuthor(direction: "left" | "right") {
    const row = rowRef.current;
    const firstItem = row?.querySelector<HTMLElement>("[data-shelf-item]");
    if (!row || !firstItem) return;

    const gap = parseFloat(getComputedStyle(row).columnGap || "0");
    const step = firstItem.offsetWidth + gap;

    row.scrollBy({
      left: direction === "right" ? step : -step,
      behavior: "smooth",
    });
  }

  function handleRowWheel(event: WheelEvent<HTMLDivElement>) {
    const row = rowRef.current;
    if (!row) return;

    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

    const rawDelta = event.deltaX;
    if (rawDelta === 0) return;

    const scrollLeft = row.scrollLeft;
    const maxScrollLeft = row.scrollWidth - row.clientWidth;
    const canMoveLeft = rawDelta < 0 && scrollLeft > 1;
    const canMoveRight = rawDelta > 0 && scrollLeft < maxScrollLeft - 1;

    if (!canMoveLeft && !canMoveRight) return;

    event.preventDefault();
    row.scrollBy({
      left: rawDelta,
      behavior: "auto",
    });
  }

  useEffect(() => {
    updateScrollButtons();

    const row = rowRef.current;
    if (!row) return;

    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(row);

    return () => resizeObserver.disconnect();
  }, [authors.length]);

  return (
    <section className="min-w-0 border-b px-4 py-3 last:border-b-0 sm:px-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold leading-snug">{title}</h3>
            <p className="text-xs text-muted-foreground">{authors.length}</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
          <Link to={viewAllPath}>
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      {authors.length > 0 ? (
        <div className="relative">
          {canScrollLeft && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background shadow-sm"
              onClick={() => scrollOneAuthor("left")}
              aria-label={`Scroll ${title} left`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div
            ref={rowRef}
            aria-label={`${title} shelf`}
            className="flex gap-3.5 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={updateScrollButtons}
            onWheel={handleRowWheel}
          >
            {authors.map((author) => (
              <div key={author.id} data-shelf-item className="shrink-0">
                <Link
                  to={`/authors/${encodeURIComponent(author.id)}`}
                  title={author.name}
                  aria-label={`Open ${author.name}`}
                  className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <AuthorAvatar author={author} />
                </Link>
              </div>
            ))}
          </div>

          {canScrollRight && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background shadow-sm"
              onClick={() => scrollOneAuthor("right")}
              aria-label={`Scroll ${title} right`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-background/55 p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function AuthorPreviewGrid({
  authors,
  onAuthor,
}: {
  authors: AuthorSummary[];
  onAuthor: (authorId: string) => void;
}) {
  if (authors.length === 0) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {authors.map((author) => (
        <AuthorCard key={author.id} author={author} onClick={() => onAuthor(author.id)} compact />
      ))}
    </div>
  );
}

export default function Authors() {
  const { authors: authorRecords, loading: authorsLoading, error: authorsError } = useAuthorsContext();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const navigate = useNavigate();
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesError, setJournalEntriesError] = useState<string | null>(null);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    setJournalEntriesLoading(true);

    fetchAllBookJournalEntryRecords()
      .then((data) => {
        if (!ignore) setJournalEntries(data);
      })
      .catch((error) => {
        if (!ignore) {
          setJournalEntriesError(error instanceof Error ? error.message : "Failed to load quotes");
        }
      })
      .finally(() => {
        if (!ignore) setJournalEntriesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const authors = useMemo(
    () => buildAuthorSummaries(authorRecords, books, journalEntries),
    [authorRecords, books, journalEntries],
  );
  const authorsByName = useMemo(() => sortAuthorsByName(authors), [authors]);
  const topAuthors = useMemo(
    () => sortAuthorsForTopShelf(authors).filter((author) => (author.averageRating ?? 0) > 4),
    [authors],
  );
  const recentlyReadAuthors = useMemo(
    () => sortAuthorsByRecentlyRead(authors.filter((author) => wasReadInRecentWindow(author))),
    [authors],
  );
  const mostReadAuthors = useMemo(
    () => sortAuthorsByMostRead(authors.filter((author) => author.statusCounts.read > 2)),
    [authors],
  );
  const previewAuthors = useMemo(
    () => authorsByName.slice(0, ALL_AUTHORS_PREVIEW_LIMIT),
    [authorsByName],
  );

  function openAuthor(authorId: string) {
    navigate(`/authors/${encodeURIComponent(authorId)}`);
  }

  if (authorsLoading || booksLoading || journalEntriesLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-heading leading-snug font-medium">Authors</h1>
          <p className="text-sm text-muted-foreground">The writers behind your stories</p>
        </div>
        <LoadingAuthors />
      </div>
    );
  }

  if (booksError) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-destructive">
        {booksError}
      </div>
    );
  }

  if (authorsError) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-destructive">
        {authorsError}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-heading leading-snug font-medium">Authors</h1>
        <p className="text-sm text-muted-foreground">The writers behind your stories</p>
        {journalEntriesError && (
          <p className="text-xs text-muted-foreground">
            Quotes could not be loaded right now, so some counts may be incomplete.
          </p>
        )}
      </div>

      {authors.length === 0 ? (
        <EmptyAuthorsState message="Add books with authors to start building your author shelf." />
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border bg-card">
            <AuthorShelfRow
              title="Top Authors"
              authors={topAuthors}
              emptyMessage="No favorite or highly rated authors yet."
              viewAllPath={buildExplorePath("top-rated")}
            />
            <AuthorShelfRow
              title="Recently Read"
              authors={recentlyReadAuthors}
              emptyMessage="Authors from recently finished books will appear here."
              viewAllPath={buildExplorePath("latest-read")}
            />
            <AuthorShelfRow
              title="Most Read"
              authors={mostReadAuthors}
              emptyMessage="Authors with more than two finished books will appear here."
              viewAllPath={buildExplorePath("most-read")}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-heading text-xl font-medium leading-snug">All Authors</h2>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-sm text-muted-foreground">
                <Link to="/library/authors">
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <AuthorPreviewGrid authors={previewAuthors} onAuthor={openAuthor} />
          </section>
        </>
      )}

    </div>
  );
}
