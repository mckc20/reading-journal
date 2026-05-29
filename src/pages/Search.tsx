import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Check, SlidersHorizontal } from "lucide-react";
import QuoteBlock from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { fetchAllBookNotes, formatBookNotePageRange } from "@/lib/bookNotes";
import {
  BOOK_SEARCH_PROPERTIES,
  getSearchHighlightParts,
  searchBookNotes,
  searchBooks,
  type BookSearchPropertyKey,
  type BookNoteSearchMatch,
} from "@/lib/bookSearch";
import { cn, statusVariant } from "@/lib/utils";
import type { Book, BookNote, BookNoteLabel } from "@/types";

const allPropertyKeys = BOOK_SEARCH_PROPERTIES.map((property) => property.key);

export default function Search() {
  const navigate = useNavigate();
  const { books, loading, error } = useBooksContext();
  const { series } = useSeries();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedProperties, setSelectedProperties] =
    useState<BookSearchPropertyKey[]>(allPropertyKeys);
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const hasQuery = query.trim().length > 0;

  const sections = useMemo(
    () =>
      searchBooks(books, query, {
        series,
        selectedProperties,
      }),
    [books, query, selectedProperties, series]
  );

  const noteMatches = useMemo(
    () => searchBookNotes(notes, books, query),
    [books, notes, query]
  );

  const allPropertiesSelected = selectedProperties.length === allPropertyKeys.length;
  const hasResults = sections.length > 0 || noteMatches.length > 0;

  useEffect(() => {
    if (!filtersOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!filterRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!hasQuery || notesLoaded) return;

    let isMounted = true;
    setNotesLoading(true);
    setNotesError(null);

    fetchAllBookNotes()
      .then((data) => {
        if (!isMounted) return;
        setNotes(data);
        setNotesLoaded(true);
      })
      .catch((fetchError: unknown) => {
        if (!isMounted) return;
        setNotesLoaded(true);
        setNotesError(
          fetchError instanceof Error ? fetchError.message : "Could not load notes."
        );
      })
      .finally(() => {
        if (isMounted) setNotesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [hasQuery, notesLoaded]);

  function openBook(book: Book) {
    navigate(`/books/${book.id}`);
  }

  function toggleProperty(property: BookSearchPropertyKey) {
    setSelectedProperties((current) => {
      if (current.length === allPropertyKeys.length) {
        return [property];
      }

      if (current.includes(property)) {
        return current.length === 1
          ? allPropertyKeys
          : current.filter((item) => item !== property);
      }

      return [...current, property];
    });
  }

  function selectAllProperties() {
    setSelectedProperties(allPropertyKeys);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-heading leading-snug font-medium">Search</h1>
        <span className="text-sm text-muted-foreground">
          {loading ? "…" : `${books.length} book${books.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search books and notes"
            aria-label="Search books and notes"
            autoComplete="off"
            className="h-10"
          />
          <div ref={filterRef} className="relative">
            <Button
              type="button"
              size="icon-lg"
              variant={filtersOpen ? "secondary" : "outline"}
              aria-label="Search filters"
              aria-expanded={filtersOpen}
              aria-haspopup="menu"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </Button>

            {filtersOpen && (
              <div className="absolute right-0 top-11 z-20 w-64 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg">
                <div className="flex items-center justify-between gap-2 border-b pb-2">
                  <p className="px-1 text-xs font-medium text-muted-foreground">
                    Search properties
                  </p>
                  {!allPropertiesSelected && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={selectAllProperties}
                    >
                      All
                    </Button>
                  )}
                </div>
                <div className="mt-2 max-h-80 overflow-y-auto">
                  {BOOK_SEARCH_PROPERTIES.map((property) => {
                    const selected = selectedProperties.includes(property.key);
                    return (
                      <button
                        key={property.key}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={selected}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={() => toggleProperty(property.key)}
                      >
                        <span>{property.label}</span>
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-sm border",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          )}
                          aria-hidden="true"
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {!allPropertiesSelected && (
          <p className="text-xs text-muted-foreground">
            Searching {selectedProperties.length} of {allPropertyKeys.length} properties
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notesError && hasQuery && (
        <p className="text-sm text-destructive">
          Notes could not be searched: {notesError}
        </p>
      )}

      {!loading && !error && !hasQuery && (
        <EmptyState message="Enter a search term to search your library." />
      )}

      {!loading && !error && hasQuery && !notesLoading && !hasResults && (
        <EmptyState message="No matching books or notes found." />
      )}

      {sections.map((section) => (
        <section key={section.property.key} className="space-y-3">
          <div>
            <h2 className="font-heading leading-snug font-medium">
              {section.property.label}
            </h2>
            <p className="text-xs text-muted-foreground">
              {section.matches.length} match{section.matches.length !== 1 ? "es" : ""}
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            {section.matches.map((match) => (
              <button
                key={`${section.property.key}-${match.book.id}`}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border bg-card p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => openBook(match.book)}
              >
                <BookCover book={match.book} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <HighlightedText value={match.book.title} query={query} />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        <HighlightedText
                          value={match.book.authors.join(", ")}
                          query={query}
                        />
                      </p>
                    </div>
                    <Badge
                      variant={statusVariant(match.book.status)}
                      className="hidden sm:inline-flex"
                    >
                      <HighlightedText value={match.book.status} query={query} />
                    </Badge>
                  </div>
                  {!["title", "authors", "status"].includes(section.property.key) && (
                    <div className="flex flex-wrap gap-1.5">
                      {match.values.map((value) => (
                        <Badge
                          key={value}
                          variant="outline"
                          className="max-w-full truncate"
                        >
                          <HighlightedText value={value} query={query} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {hasQuery && (notesLoading || noteMatches.length > 0) && (
        <section className="space-y-3">
          <div>
            <h2 className="font-heading leading-snug font-medium">Notes</h2>
            <p className="text-xs text-muted-foreground">
              {notesLoading
                ? "Searching notes..."
                : `${noteMatches.length} match${noteMatches.length !== 1 ? "es" : ""}`}
            </p>
          </div>
          <Separator />
          {!notesLoading && (
            <div className="space-y-2">
              {noteMatches.map((match) => (
                <NoteSearchResult
                  key={match.note.id}
                  match={match}
                  query={query}
                  onBook={openBook}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function NoteSearchResult({
  match,
  query,
  onBook,
}: {
  match: BookNoteSearchMatch;
  query: string;
  onBook: (book: Book) => void;
}) {
  const { note, book } = match;
  const pageLabel = formatBookNotePageRange(note);
  const visibleDate = note.note_date ?? note.created_at;

  return (
    <button
      type="button"
      className="block w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={() => onBook(book)}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            <HighlightedText value={book.title} query={query} />
          </p>
          <p className="truncate text-xs text-muted-foreground">
            <HighlightedText value={book.authors.join(", ")} query={query} />
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Badge variant="outline">{noteLabelText(note.label)}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatNoteDate(visibleDate)}
          </span>
        </div>
      </div>

      {note.label === "quote" ? (
        <QuoteBlock
          attribution={
            note.quote_speaker || pageLabel ? (
              <div className="flex flex-wrap items-center gap-2">
                {note.quote_speaker && (
                  <span className="font-serif italic">- {note.quote_speaker}</span>
                )}
                {pageLabel && <span className="text-xs font-medium">{pageLabel}</span>}
              </div>
            ) : null
          }
          contentClassName="line-clamp-3 whitespace-pre-line"
        >
          <HighlightedText value={match.values[0]} query={query} />
        </QuoteBlock>
      ) : (
        <>
          {note.title && (
            <p className="mb-1 text-sm font-medium leading-snug">
              <HighlightedText value={note.title} query={query} />
            </p>
          )}
          <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-foreground">
            <HighlightedText value={match.values[0]} query={query} />
          </p>
          {pageLabel && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>{pageLabel}</span>
            </div>
          )}
        </>
      )}
    </button>
  );
}

function HighlightedText({
  value,
  query,
}: {
  value: string;
  query: string;
}): ReactNode {
  return getSearchHighlightParts(value, query).map((part, index) =>
    part.highlighted ? (
      <mark
        key={index}
        className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/40"
      >
        {part.text}
      </mark>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}

function noteLabelText(label: BookNoteLabel): string {
  if (label === "quote") return "Quote";
  if (label === "review") return "Review";
  return "Note";
}

function formatNoteDate(value: string): string {
  const dateValue = value.length === 10 ? `${value}T00:00:00` : value;

  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BookCover({ book }: { book: Book }) {
  return (
    <div
      className={cn(
        "flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
      )}
    >
      {book.cover_url ? (
        <img src={book.cover_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <BookOpen className="h-5 w-5 text-muted-foreground/50" />
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
