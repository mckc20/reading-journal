import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Filter, Heart, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBooksContext } from "@/context/BooksContext";
import { buildAuthorSummaries, getAuthorInitials, type AuthorSummary } from "@/lib/authorShelf";
import { fetchAllBookNotes } from "@/lib/bookNotes";
import type { Book, BookNote } from "@/types";

type AuthorSort = "name" | "recently-added" | "latest-read";

const allFilterValue = "__all__";
const recentlyReadWindowMs = 5 * 7 * 24 * 60 * 60 * 1000;

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function uniqueSortedValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );
}

function getNewestCreatedAt(author: AuthorSummary): number {
  return Math.max(...author.books.map((book) => new Date(book.created_at).getTime()));
}

function getLatestReadAt(author: AuthorSummary): number {
  if (!author.latestReadDate) return 0;
  const latestReadAt = new Date(author.latestReadDate).getTime();
  return Number.isFinite(latestReadAt) ? latestReadAt : 0;
}

function getLatestFinishedAt(author: AuthorSummary): number {
  return author.books.reduce((latestFinishedAt, book) => {
    if (book.status !== "Finished" || !book.date_finished) return latestFinishedAt;

    const finishedAt = new Date(book.date_finished).getTime();
    return Number.isFinite(finishedAt) ? Math.max(latestFinishedAt, finishedAt) : latestFinishedAt;
  }, 0);
}

function wasReadInRecentWindow(author: AuthorSummary, now = Date.now()): boolean {
  const latestFinishedAt = getLatestFinishedAt(author);

  return latestFinishedAt <= now && latestFinishedAt >= now - recentlyReadWindowMs;
}

function sortAuthors(authors: AuthorSummary[], sort: AuthorSort): AuthorSummary[] {
  return [...authors].sort((a, b) => {
    if (sort === "recently-added") {
      return getNewestCreatedAt(b) - getNewestCreatedAt(a) || a.name.localeCompare(b.name);
    }

    if (sort === "latest-read") {
      return getLatestReadAt(b) - getLatestReadAt(a) || a.name.localeCompare(b.name);
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
}

function bookMatchesFilters(book: Book, genre: string, language: string): boolean {
  if (genre && !(book.genres ?? []).includes(genre)) return false;
  if (language && book.language !== language) return false;
  return true;
}

function AuthorPlaceholder({ name }: { name: string }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-medium text-primary-foreground shadow-sm">
      {getAuthorInitials(name)}
    </div>
  );
}

function LoadingAuthors() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-48 animate-pulse rounded-xl bg-muted/40" />
      ))}
    </div>
  );
}

function selectPreviewBooks(author: AuthorSummary): Book[] {
  const selected = new Map<string, Book>();

  author.books
    .filter((book) => book.is_favorite)
    .forEach((book) => selected.set(book.id, book));

  author.books.forEach((book) => {
    if (selected.size < 3) selected.set(book.id, book);
  });

  return Array.from(selected.values()).slice(0, 3);
}

function PreviewBookCovers({ books }: { books: Book[] }) {
  if (books.length === 0) return null;

  return (
    <div className="flex w-40 shrink-0 justify-end -space-x-3">
      {books.map((book) => (
        <Link
          key={book.id}
          to={`/books/${book.id}`}
          className="block rounded-md ring-2 ring-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Open ${book.title}`}
        >
          <div className="h-24 w-16 overflow-hidden rounded-md border bg-muted shadow-sm">
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={book.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-4 w-4 text-muted-foreground/50" />
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function AuthorCard({ author }: { author: AuthorSummary }) {
  const mostRecentBook = author.books[0];
  const previewBooks = selectPreviewBooks(author);

  return (
    <Card className="relative min-h-[220px] rounded-lg">
      <CardContent className="flex flex-col gap-4">
        {author.isFavorite && (
          <Heart
            className="absolute right-5 top-5 h-5 w-5 fill-favorite text-favorite"
            aria-label="Favorite author"
          />
        )}

        <div className="flex items-start gap-4 pr-8">
          <AuthorPlaceholder name={author.name} />
          <div className="min-w-0 space-y-3">
            <Link
              to={`/authors/${encodeURIComponent(author.name)}`}
              className="line-clamp-2 font-heading text-lg font-medium leading-snug hover:underline"
            >
              {author.name}
            </Link>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{countLabel(author.bookCount, "book")}</span>
              <span>{countLabel(author.quoteCount, "quote")}</span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-current text-rating" />
                {author.averageRating ?? "No rating"}
              </span>
            </div>
          </div>
        </div>

        {mostRecentBook && (
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">Most recent:</p>
              <Link
                to={`/books/${mostRecentBook.id}`}
                className="line-clamp-2 font-heading text-sm leading-snug hover:underline"
              >
                {mostRecentBook.title}
              </Link>
            </div>
            <PreviewBookCovers books={previewBooks} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuthorGrid({ authors }: { authors: AuthorSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {authors.map((author) => (
        <AuthorCard key={author.name} author={author} />
      ))}
    </div>
  );
}

function AuthorAvatarShelf({
  title,
  authors,
  emptyMessage,
}: {
  title: string;
  authors: AuthorSummary[];
  emptyMessage: string;
}) {
  return (
    <section className="min-w-0 border-b px-4 py-3 last:border-b-0 sm:px-5">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold leading-snug">{title}</h2>
        <p className="text-xs text-muted-foreground">{authors.length}</p>
      </div>
      {authors.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {authors.map((author) => (
            <Link
              key={author.name}
              to={`/authors/${encodeURIComponent(author.name)}`}
              title={author.name}
              aria-label={`Open ${author.name}`}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <AuthorPlaceholder name={author.name} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-2 text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </section>
  );
}

function AuthorToolbar({
  sort,
  hasActiveFilters,
  activeFilterCount,
  onSortChange,
  onFiltersOpen,
}: {
  sort: AuthorSort;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onSortChange: (sort: AuthorSort) => void;
  onFiltersOpen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={sort} onValueChange={(value) => onSortChange(value as AuthorSort)}>
        <SelectTrigger className="w-[12rem] justify-start gap-1.5" aria-label="Sort authors">
          <span className="text-muted-foreground">Sort:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="recently-added">Recently added</SelectItem>
          <SelectItem value="latest-read">Latest read</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant={hasActiveFilters ? "secondary" : "outline"}
        onClick={onFiltersOpen}
        aria-haspopup="dialog"
      >
        <Filter className="h-4 w-4" />
        Filters
        {hasActiveFilters && (
          <span className="ml-0.5 rounded-full bg-background px-1.5 text-xs text-muted-foreground">
            {activeFilterCount}
          </span>
        )}
      </Button>
    </div>
  );
}

export default function Authors() {
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [sort, setSort] = useState<AuthorSort>("name");
  const [genreFilter, setGenreFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    fetchAllBookNotes()
      .then((data) => {
        if (!ignore) setNotes(data);
      })
      .catch((error) => {
        if (!ignore) {
          setNotesError(error instanceof Error ? error.message : "Failed to load quotes");
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const filterOptions = useMemo(
    () => ({
      genres: uniqueSortedValues(books.flatMap((book) => book.genres ?? [])),
      languages: uniqueSortedValues(books.map((book) => book.language)),
    }),
    [books],
  );
  const filteredBooks = useMemo(
    () => books.filter((book) => bookMatchesFilters(book, genreFilter, languageFilter)),
    [books, genreFilter, languageFilter],
  );
  const authors = useMemo(
    () => sortAuthors(buildAuthorSummaries(filteredBooks, notes), sort),
    [filteredBooks, notes, sort],
  );
  const favoriteAuthors = useMemo(
    () => authors.filter((author) => author.isFavorite),
    [authors],
  );
  const recentlyReadAuthors = useMemo(
    () =>
      authors
        .filter((author) => wasReadInRecentWindow(author))
        .sort(
          (a, b) =>
            getLatestFinishedAt(b) - getLatestFinishedAt(a) ||
            a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
        ),
    [authors],
  );
  const mostReadAuthors = useMemo(
    () =>
      authors
        .filter((author) => author.statusCounts.read > 3)
        .sort(
          (a, b) =>
            b.statusCounts.read - a.statusCounts.read ||
            a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
        ),
    [authors],
  );
  const hasActiveFilters = Boolean(genreFilter || languageFilter);
  const activeFilterCount = [genreFilter, languageFilter].filter(Boolean).length;

  function clearFilters() {
    setGenreFilter("");
    setLanguageFilter("");
  }

  if (booksLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-4xl font-bold leading-tight">Authors</h1>
          <p className="mt-1 text-sm text-muted-foreground">Loading your author shelf...</p>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-bold leading-tight">Authors</h1>
        {notesError && (
          <p className="mt-2 text-xs text-muted-foreground">
            Quotes could not be loaded right now, so quote counts may be incomplete.
          </p>
        )}
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="left-auto right-0 top-0 h-svh max-h-svh max-w-full translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none border-l p-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="author-genre-filter">
                Genre
              </label>
              <Select
                value={genreFilter || allFilterValue}
                onValueChange={(value) => setGenreFilter(value === allFilterValue ? "" : value)}
              >
                <SelectTrigger id="author-genre-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={allFilterValue}>All genres</SelectItem>
                  {filterOptions.genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="author-language-filter">
                Language
              </label>
              <Select
                value={languageFilter || allFilterValue}
                onValueChange={(value) => setLanguageFilter(value === allFilterValue ? "" : value)}
              >
                <SelectTrigger id="author-language-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={allFilterValue}>All languages</SelectItem>
                  {filterOptions.languages.map((language) => (
                    <SelectItem key={language} value={language}>
                      {language}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <Button type="button" onClick={() => setFiltersOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {authors.length === 0 ? (
        <div className="space-y-4">
          <div className="flex justify-start sm:justify-end">
            <AuthorToolbar
              sort={sort}
              hasActiveFilters={hasActiveFilters}
              activeFilterCount={activeFilterCount}
              onSortChange={setSort}
              onFiltersOpen={() => setFiltersOpen(true)}
            />
          </div>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "No authors match the selected filters."
                : "Add books with authors to build your author shelf."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="overflow-hidden rounded-lg border bg-card">
            <AuthorAvatarShelf
              title="Favorite Authors"
              authors={favoriteAuthors}
              emptyMessage={
                hasActiveFilters
                  ? "No favorite authors match the selected filters."
                  : "Mark a book as favorite to see its author here."
              }
            />
            <AuthorAvatarShelf
              title="Recently Read"
              authors={recentlyReadAuthors}
              emptyMessage={
                hasActiveFilters
                  ? "No recently read authors match the selected filters."
                  : "Authors from books finished in the last 5 weeks will appear here."
              }
            />
            <AuthorAvatarShelf
              title="Most Read"
              authors={mostReadAuthors}
              emptyMessage={
                hasActiveFilters
                  ? "No most-read authors match the selected filters."
                  : "Authors with more than 3 finished books will appear here."
              }
            />
          </div>

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-heading text-xl font-medium leading-snug">
                All Authors{" "}
                <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
                  {authors.length}
                </span>
              </h2>
              <AuthorToolbar
                sort={sort}
                hasActiveFilters={hasActiveFilters}
                activeFilterCount={activeFilterCount}
                onSortChange={setSort}
                onFiltersOpen={() => setFiltersOpen(true)}
              />
            </div>
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                {genreFilter && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    Genre: {genreFilter}
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      aria-label={`Remove genre filter ${genreFilter}`}
                      onClick={() => setGenreFilter("")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {languageFilter && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    Language: {languageFilter}
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      aria-label={`Remove language filter ${languageFilter}`}
                      onClick={() => setLanguageFilter("")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
            <AuthorGrid authors={authors} />
          </section>
        </div>
      )}
    </div>
  );
}
