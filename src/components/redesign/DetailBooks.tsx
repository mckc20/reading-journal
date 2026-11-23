import { useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BookCard from "@/components/BookCard";
import CollectionEmptyState from "@/components/CollectionEmptyState";
import { FilterSelect, LibraryFilterChips, LibrarySortingControls } from "@/components/LibraryControls";
import { useDetailSectionAnchor } from "@/hooks/useDetailSectionAnchor";
import { defaultSortDirection, sortDirectionLabel, sortLibraryBooks, type SortDirection } from "@/lib/librarySorting";
import type { Book, BookStatus } from "@/types";

const bookSortOptions = [
  { value: "title", label: "Title" },
  { value: "publication-date", label: "Publication Date" },
  { value: "rating", label: "Rating" },
  { value: "date-finished", label: "Date Finished" },
  { value: "date-added", label: "Date Added" },
] as const;
type BookSort = typeof bookSortOptions[number]["value"] | "volume";
const statuses: BookStatus[] = ["To Read", "Up Next", "Reading", "Paused", "Finished", "DNF"];

function defaultDirection(sort: BookSort): SortDirection {
  if (sort === "volume") return "asc";
  return sort === "publication-date" ? "desc" : defaultSortDirection(sort);
}

function directionLabel(sort: BookSort, direction: SortDirection) {
  if (sort === "volume") return direction === "asc" ? "First → Last" : "Last → First";
  if (sort === "publication-date") return direction === "asc" ? "Oldest → Newest" : "Newest → Oldest";
  return sortDirectionLabel(sort, direction);
}

function sortBooks(books: Book[], sort: BookSort, direction: SortDirection): Book[] {
  if (sort === "volume") {
    // The series supplies its volumes in order, with unnumbered volumes at the end.
    if (direction === "asc") return books;
    return [
      ...books.filter((book) => book.volume_number != null).reverse(),
      ...books.filter((book) => book.volume_number == null),
    ];
  }
  if (sort === "publication-date") {
    const titledBooks = sortLibraryBooks(books, "title");
    return titledBooks.sort((a, b) => {
      if (!a.publication_date || !b.publication_date) {
        return Number(!a.publication_date) - Number(!b.publication_date);
      }
      return a.publication_date.localeCompare(b.publication_date) * (direction === "asc" ? 1 : -1);
    });
  }
  return sortLibraryBooks(books, sort, undefined, direction);
}

export function DetailBooks({ books, series = false }: { books: Book[]; series?: boolean }) {
  const navigate = useNavigate();
  const titleId = useId();
  const sectionRef = useDetailSectionAnchor("books");
  const [searchParams] = useSearchParams();
  const options = series ? [{ value: "volume", label: "Volume Number" } as const, ...bookSortOptions] : bookSortOptions;
  const requestedSort = searchParams.get("sort");
  const initialSort = options.find((option) => option.value === requestedSort)?.value ?? (series ? "volume" : "title");
  const [sort, setSort] = useState<BookSort>(initialSort);
  const [direction, setDirection] = useState<SortDirection>(defaultDirection(initialSort));
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const filteredBooks = books.filter((book) => selectedStatuses.length === 0 || selectedStatuses.includes(book.status));
  const visibleBooks = sortBooks(filteredBooks, sort, direction);

  return (
    <section id="books" ref={sectionRef} aria-labelledby={titleId} className="space-y-4 scroll-mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={titleId}>Books</h2>
        {books.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              systemMenu
              label="Status"
              value={selectedStatuses}
              options={statuses}
              emptyLabel="All statuses"
              triggerClassName="w-32"
              onChange={(status) => setSelectedStatuses((current) => !status ? [] : current.includes(status)
                ? current.filter((item) => item !== status)
                : [...current, status])}
            />
            <LibrarySortingControls
              systemMenu
              sort={sort}
              options={options.map((option) => ({
                ...option,
                directionLabel: directionLabel(option.value, defaultDirection(option.value)),
              }))}
              directionLabel={directionLabel(sort, direction)}
              onSortChange={(value) => {
                const option = options.find((item) => item.value === value);
                if (!option) return;
                setSort(option.value);
                setDirection(defaultDirection(option.value));
              }}
              onDirectionChange={() => setDirection((current) => current === "asc" ? "desc" : "asc")}
            />
          </div>
        )}
      </div>
      <LibraryFilterChips
        chips={selectedStatuses.map((status) => ({
          label: `Status: ${status}`,
          onRemove: () => setSelectedStatuses((current) => current.filter((item) => item !== status)),
        }))}
        onClear={() => setSelectedStatuses([])}
      />
      {visibleBooks.length > 0 ? (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:gap-x-5">
          {visibleBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              cornerLabel={series && book.volume_number != null ? String(book.volume_number) : undefined}
              onBook={(item) => navigate(`/books/${encodeURIComponent(item.id)}`)}
              textSize="compact"
              showAuthor={series}
            />
          ))}
        </div>
      ) : (
        <CollectionEmptyState
          title={books.length ? "No books match your filters" : "No books yet"}
          description={books.length ? "Try changing the status filter." : series
            ? "Books added to this series will appear here."
            : "Books by this author will appear here."}
          onShowAll={selectedStatuses.length ? () => setSelectedStatuses([]) : undefined}
        />
      )}
    </section>
  );
}
