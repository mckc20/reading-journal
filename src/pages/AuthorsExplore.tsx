import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Grid2X2, Heart, List } from "lucide-react";
import AuthorCard from "@/components/AuthorCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { buildAuthorSummaries } from "@/lib/authorShelf";
import {
  compareAuthorsByName,
  filterAuthors,
  getAuthorFilters,
  hasActiveAuthorFilters,
  sortAuthorsByMostRead,
  sortAuthorsByName,
  sortAuthorsByRecentlyRead,
  uniqueSortedValues,
} from "@/lib/authorsView";
import { fetchAllBookNotes } from "@/lib/bookNotes";
import type { AuthorSummary } from "@/lib/authorShelf";
import type { BookNote } from "@/types";

type AuthorDisplay = "grid" | "table";
type AuthorSort = "name" | "recently-added" | "latest-read" | "top-rated" | "most-read";

const allValue = "__all__";

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function downloadAuthorsCsv(authors: AuthorSummary[]) {
  const headers = [
    "Name",
    "Favorite",
    "Books",
    "Quotes",
    "Average Rating",
    "Nationality",
    "Birth Date",
    "Birth Precision",
    "Death Date",
    "Death Precision",
  ];

  const rows = authors.map((author) => [
    author.name,
    author.isFavorite ? "Yes" : "No",
    author.bookCount,
    author.quoteCount,
    author.averageRating ?? "",
    author.nationality ?? "",
    author.birth_date ?? "",
    author.birth_date_precision ?? "",
    author.death_date ?? "",
    author.death_date_precision ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "authors.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeSort(value: string | null): AuthorSort {
  if (
    value === "name" ||
    value === "recently-added" ||
    value === "latest-read" ||
    value === "top-rated" ||
    value === "most-read"
  ) {
    return value;
  }
  return "name";
}

function normalizeDisplay(value: string | null): AuthorDisplay {
  if (value === "table") return "table";
  return "grid";
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <Grid2X2 className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function AuthorTable({
  authors,
  selectedIds,
  onToggleAuthor,
  onOpenAuthor,
  interactive = true,
}: {
  authors: AuthorSummary[];
  selectedIds?: Set<string>;
  onToggleAuthor?: (authorId: string) => void;
  onOpenAuthor: (authorId: string) => void;
  interactive?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-background dark:bg-card">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          <tr>
            {selectedIds ? <th className="w-10 px-3 py-2" /> : null}
            <th className="w-16 px-3 py-2">Photo</th>
            <th className="px-3 py-2">Author</th>
            <th className="px-3 py-2">Books</th>
            <th className="px-3 py-2">Rating</th>
            <th className="px-3 py-2">Nationality</th>
            <th className="px-3 py-2">Last read</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {authors.map((author) => (
            <tr
              key={author.id}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? "button" : undefined}
              onClick={interactive ? () => onOpenAuthor(author.id) : undefined}
              onKeyDown={
                interactive
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenAuthor(author.id);
                      }
                    }
                  : undefined
              }
              className={interactive ? "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none" : "transition-colors"}
            >
              {selectedIds && onToggleAuthor ? (
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(author.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => onToggleAuthor(author.id)}
                    aria-label={`Select ${author.name}`}
                    className="h-4 w-4 rounded border-border"
                  />
                </td>
              ) : null}
              <td className="px-3 py-2">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-sm">
                  {author.photo_url ? (
                    <img src={author.photo_url} alt={author.name} className="h-full w-full object-cover" />
                  ) : (
                    <span>{author.name.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="min-w-0">
                  <p className="max-w-72 truncate font-medium leading-snug">
                    <span className="inline-flex items-center gap-2">
                      {author.name}
                      {author.isFavorite ? <Heart className="h-4 w-4 fill-favorite text-favorite" /> : null}
                    </span>
                  </p>
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{author.bookCount}</td>
              <td className="px-3 py-2 text-muted-foreground">{author.averageRating ?? "-"}</td>
              <td className="px-3 py-2 text-muted-foreground">{author.nationality ?? "-"}</td>
              <td className="px-3 py-2 text-muted-foreground">{formatDisplayDate(author.latestReadDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function authorMatchesSort(authors: AuthorSummary[], sort: AuthorSort): AuthorSummary[] {
  if (sort === "recently-added") {
    return [...authors].sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return diff !== 0 ? diff : compareAuthorsByName(a, b);
    });
  }
  if (sort === "latest-read") return sortAuthorsByRecentlyRead(authors);
  if (sort === "top-rated") {
    return [...authors].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      if ((b.averageRating ?? -1) !== (a.averageRating ?? -1)) {
        return (b.averageRating ?? -1) - (a.averageRating ?? -1);
      }
      if (a.bookCount !== b.bookCount) return b.bookCount - a.bookCount;
      return compareAuthorsByName(a, b);
    });
  }
  if (sort === "most-read") return sortAuthorsByMostRead(authors);
  return sortAuthorsByName(authors);
}

function authorToUpdatePayload(author: AuthorSummary, favorite: boolean) {
  return {
    name: author.name,
    photo_url: author.photo_url,
    birth_date: author.birth_date,
    birth_date_precision: author.birth_date_precision,
    death_date: author.death_date,
    death_date_precision: author.death_date_precision,
    bio: author.bio,
    is_favorite: favorite,
    nationality: author.nationality,
  };
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function clearAuthorFilters(searchParams: URLSearchParams): URLSearchParams {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete("sort");
  nextParams.delete("display");
  nextParams.delete("genre");
  nextParams.delete("language");
  nextParams.delete("nationality");
  return nextParams;
}

export default function AuthorsExplore() {
  const { authors: authorRecords, loading: authorsLoading, error: authorsError, editAuthor } =
    useAuthorsContext();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const sort = normalizeSort(searchParams.get("sort"));
  const display = normalizeDisplay(searchParams.get("display"));
  const mode = searchParams.get("mode");
  const filters = useMemo(() => getAuthorFilters(searchParams), [searchParams]);
  const isManageMode = mode === "manage";

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

  const authors = useMemo(() => buildAuthorSummaries(authorRecords, books, notes), [authorRecords, books, notes]);
  const authorCountLabel = countLabel(authors.length, "author");
  const filteredAuthors = useMemo(() => {
    return authorMatchesSort(filterAuthors(authors, filters), sort);
  }, [authors, filters, sort]);

  const filterOptions = useMemo(
    () => ({
      genre: uniqueSortedValues(authors.flatMap((author) => author.books.flatMap((book) => book.genres ?? []))),
      language: uniqueSortedValues(authors.flatMap((author) => author.books.map((book) => book.language))),
      nationality: uniqueSortedValues(authors.map((author) => author.nationality)),
    }),
    [authors],
  );

  const displayAuthors = filteredAuthors;
  const visibleAuthors = displayAuthors;

  useEffect(() => {
    setSelectedIds((current) => {
      const visibleIds = new Set(visibleAuthors.map((author) => author.id));
      const next = new Set(Array.from(current).filter((authorId) => visibleIds.has(authorId)));
      return setsEqual(next, current) ? current : next;
    });
  }, [visibleAuthors]);

  function updateParam(key: "sort" | "display" | "mode", value: string) {
    const nextParams = new URLSearchParams(searchParams);
    const normalizedValue = value.trim();

    if (!normalizedValue || (key === "sort" && normalizedValue === "name") || (key === "display" && normalizedValue === "grid")) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, normalizedValue);
    }

    setSearchParams(nextParams, { replace: true });
  }

  function updateFilter(key: "genre" | "language" | "nationality", value: string) {
    const nextParams = new URLSearchParams(searchParams);
    if (value === allValue) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function openAuthor(authorId: string) {
    navigate(`/authors/${encodeURIComponent(authorId)}`);
  }

  function toggleSelected(authorId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(authorId)) {
        next.delete(authorId);
      } else {
        next.add(authorId);
      }
      return next;
    });
  }

  function toggleManageMode() {
    const nextParams = new URLSearchParams(searchParams);
    if (isManageMode) {
      nextParams.delete("mode");
      setSelectedIds(new Set());
      setBulkError(null);
    } else {
      nextParams.set("mode", "manage");
    }
    setSearchParams(nextParams, { replace: true });
  }

  async function applyBulkFavorite(favorite: boolean) {
    const selectedAuthors = visibleAuthors.filter((author) => selectedIds.has(author.id));
    if (selectedAuthors.length === 0) return;

    setSaving(true);
    setBulkError(null);

    try {
      for (const author of selectedAuthors) {
        await editAuthor(author.id, authorToUpdatePayload(author, favorite));
      }
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "One of the selected authors could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  function exportSelected() {
    const selectedAuthors = visibleAuthors.filter((author) => selectedIds.has(author.id));
    if (selectedAuthors.length === 0) return;
    downloadAuthorsCsv(selectedAuthors);
  }

  useEffect(() => {
    if (!isManageMode) return;
    const visibleIds = new Set(visibleAuthors.map((author) => author.id));
    setSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((authorId) => visibleIds.has(authorId)));
      return next.size === current.size ? current : next;
    });
  }, [isManageMode, visibleAuthors]);

  if (authorsLoading || booksLoading || notesLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-heading leading-snug font-medium">Explore Authors</h1>
          <p className="text-sm text-muted-foreground">Loading authors...</p>
        </div>
        <LoadingAuthors />
      </div>
    );
  }

  if (booksError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{booksError}</div>;
  }

  if (authorsError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{authorsError}</div>;
  }

  const hasFilters = hasActiveAuthorFilters(filters);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-heading leading-snug font-medium">Explore Authors</h1>
            <p className="text-sm text-muted-foreground">{authorCountLabel}</p>
          </div>
          <Button type="button" variant={isManageMode ? "secondary" : "outline"} onClick={toggleManageMode}>
            {isManageMode ? "Exit management" : "Management mode"}
          </Button>
        </div>
        {notesError && (
          <p className="text-xs text-muted-foreground">
            Quotes could not be loaded right now, so some counts may be incomplete.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="border-y border-border py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filters.genre[0] ?? allValue} onValueChange={(value) => updateFilter("genre", value)}>
              <SelectTrigger className="w-[9.75rem] justify-between gap-1.5" aria-label="Filter authors by genre">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allValue}>Genre</SelectItem>
                {filterOptions.genre.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.language[0] ?? allValue} onValueChange={(value) => updateFilter("language", value)}>
              <SelectTrigger className="w-[9.75rem] justify-between gap-1.5" aria-label="Filter authors by language">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allValue}>Language</SelectItem>
                {filterOptions.language.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.nationality[0] ?? allValue}
              onValueChange={(value) => updateFilter("nationality", value)}
            >
              <SelectTrigger className="w-[9.75rem] justify-between gap-1.5" aria-label="Filter authors by nationality">
                <SelectValue placeholder="Nationality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allValue}>Nationality</SelectItem>
                {filterOptions.nationality.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Select value={sort} onValueChange={(value) => updateParam("sort", value)}>
              <SelectTrigger className="w-[12.5rem] justify-between gap-1.5" aria-label="Sort authors">
                <span className="text-muted-foreground">Sort by:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="recently-added">Recently added</SelectItem>
                <SelectItem value="latest-read">Latest read</SelectItem>
                <SelectItem value="top-rated">Top rated</SelectItem>
                <SelectItem value="most-read">Most read</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex rounded-lg border bg-background p-0.5 dark:bg-input/30">
              <Button
                type="button"
                size="icon-sm"
                variant={display === "grid" ? "secondary" : "ghost"}
                aria-label="Grid view"
                aria-pressed={display === "grid"}
                onClick={() => updateParam("display", "grid")}
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant={display === "table" ? "secondary" : "ghost"}
                aria-label="Table view"
                aria-pressed={display === "table"}
                onClick={() => updateParam("display", "table")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearchParams(clearAuthorFilters(searchParams), { replace: true })}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {isManageMode ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-4">
            <div>
              <h2 className="font-heading text-lg font-medium leading-snug">Management Mode</h2>
              <p className="text-sm text-muted-foreground">
                {selectedIds.size} selected from {visibleAuthors.length} visible authors
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" disabled={selectedIds.size === 0 || saving} onClick={() => void applyBulkFavorite(true)}>
                <Check className="h-4 w-4" />
                Mark favorite
              </Button>
              <Button type="button" variant="outline" disabled={selectedIds.size === 0 || saving} onClick={() => void applyBulkFavorite(false)}>
                <Heart className="h-4 w-4" />
                Remove favorite
              </Button>
              <Button type="button" variant="outline" disabled={selectedIds.size === 0} onClick={exportSelected}>
                Export CSV
              </Button>
              <Button type="button" variant="ghost" onClick={toggleManageMode}>
                Close
              </Button>
            </div>
          </div>

          {bulkError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {bulkError}
            </div>
          )}

          {displayAuthors.length === 0 ? (
            <EmptyState message="No authors match the current filters." />
          ) : (
            <AuthorTable
              authors={displayAuthors}
              selectedIds={selectedIds}
              onToggleAuthor={toggleSelected}
              onOpenAuthor={openAuthor}
              interactive={false}
            />
          )}
        </div>
      ) : display === "table" ? (
        displayAuthors.length === 0 ? (
          <EmptyState message="No authors match the current filters." />
        ) : (
          <AuthorTable authors={displayAuthors} onOpenAuthor={openAuthor} />
        )
      ) : displayAuthors.length === 0 ? (
        <EmptyState message="No authors match the current filters." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {displayAuthors.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              onClick={() => openAuthor(author.id)}
              compact
              interactive={!isManageMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
