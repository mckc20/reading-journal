import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";
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
import { fetchAllBookNotes } from "@/lib/bookNotes";
import type { BookNote } from "@/types";

const ALL_AUTHORS_PREVIEW_LIMIT = 6;

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

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

function useVisibleShelfCount(itemWidth = 64, gap = 12) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observedRow = row;

    function updateVisibleCount() {
      const width = observedRow.clientWidth;
      const count = Math.floor((width + gap) / (itemWidth + gap));
      setVisibleCount(Math.max(1, count));
    }

    updateVisibleCount();

    const resizeObserver = new ResizeObserver(updateVisibleCount);
    resizeObserver.observe(observedRow);

    return () => resizeObserver.disconnect();
  }, [gap, itemWidth]);

  return [rowRef, visibleCount] as const;
}

function AuthorShelfRow({
  title,
  authors,
  emptyMessage,
}: {
  title: string;
  authors: AuthorSummary[];
  emptyMessage: string;
}) {
  const [rowRef, visibleCount] = useVisibleShelfCount();
  const visibleAuthors = authors.slice(0, visibleCount);

  return (
    <section className="min-w-0 border-b px-4 py-4 last:border-b-0 sm:px-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-lg font-medium leading-snug">{title}</h2>
        <p className="text-xs text-muted-foreground">{countLabel(authors.length, "author")}</p>
      </div>
      {authors.length > 0 ? (
        <div ref={rowRef} className="flex gap-3 overflow-hidden pb-1">
          {visibleAuthors.map((author) => (
            <Link
              key={author.id}
              to={`/authors/${encodeURIComponent(author.id)}`}
              title={author.name}
              aria-label={`Open ${author.name}`}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <AuthorAvatar author={author} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed bg-background/55 px-4 py-5 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
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
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    setNotesLoading(true);

    fetchAllBookNotes()
      .then((data) => {
        if (!ignore) setNotes(data);
      })
      .catch((error) => {
        if (!ignore) {
          setNotesError(error instanceof Error ? error.message : "Failed to load quotes");
        }
      })
      .finally(() => {
        if (!ignore) setNotesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const authors = useMemo(
    () => buildAuthorSummaries(authorRecords, books, notes),
    [authorRecords, books, notes],
  );
  const authorsByName = useMemo(() => sortAuthorsByName(authors), [authors]);
  const topAuthors = useMemo(() => sortAuthorsForTopShelf(authors), [authors]);
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

  if (authorsLoading || booksLoading || notesLoading) {
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
        {notesError && (
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
            />
            <AuthorShelfRow
              title="Recently Read"
              authors={recentlyReadAuthors}
              emptyMessage="Authors from recently finished books will appear here."
            />
            <AuthorShelfRow
              title="Most Read"
              authors={mostReadAuthors}
              emptyMessage="Authors with more than two finished books will appear here."
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-heading text-xl font-medium leading-snug">All Authors</h2>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-sm text-muted-foreground">
                <Link to="/authors/explore">
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
