import { useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CollectionEmptyState from "@/components/CollectionEmptyState";
import { LibrarySortingControls } from "@/components/LibraryControls";
import { BookShelf } from "@/components/redesign/HomeCards";
import { useDetailSectionAnchor } from "@/hooks/useDetailSectionAnchor";
import { defaultSortDirection, sortDirectionLabel, sortLibraryBooks } from "@/lib/librarySorting";
import type { Book } from "@/types";

const authorSortOptions = [
  { value: "title", label: "Title" },
  { value: "publication-date", label: "Publication Date" },
  { value: "date-finished", label: "Date Finished" },
] as const;

const seriesSortOptions = [
  { value: "volume", label: "Volume Number" },
  { value: "title", label: "Title" },
  { value: "date-finished", label: "Date Finished" },
] as const;
type BookSort = (typeof authorSortOptions | typeof seriesSortOptions)[number]["value"];

function directionLabel(sort: BookSort) {
  if (sort === "volume") return "First → Last";
  if (sort === "publication-date") return "Newest → Oldest";
  return sortDirectionLabel(sort, defaultSortDirection(sort));
}

function sortBooks(books: Book[], sort: BookSort): Book[] {
  // The series supplies its volumes in order, with unnumbered volumes at the end.
  if (sort === "volume") return books;
  if (sort === "publication-date") {
    const titledBooks = sortLibraryBooks(books, "title");
    return titledBooks.sort((a, b) => {
      if (!a.publication_date || !b.publication_date) {
        return Number(!a.publication_date) - Number(!b.publication_date);
      }
      return b.publication_date.localeCompare(a.publication_date);
    });
  }
  return sortLibraryBooks(books, sort);
}

export function DetailBooks({ books, series = false, title = "Books", sectionId = "books" }: {
  books: Book[];
  series?: boolean;
  title?: string;
  sectionId?: string;
}) {
  const navigate = useNavigate();
  const titleId = useId();
  const sectionRef = useDetailSectionAnchor(sectionId);
  const [searchParams] = useSearchParams();
  const options = series ? seriesSortOptions : authorSortOptions;
  const requestedSort = searchParams.get("sort");
  const initialSort = options.find((option) => option.value === requestedSort)?.value ?? options[0].value;
  const [sort, setSort] = useState<BookSort>(initialSort);
  const visibleBooks = sortBooks(books, sort);

  return (
    <section id={sectionId} ref={sectionRef} aria-labelledby={titleId} className="min-w-0 space-y-4 scroll-mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={titleId}>{title}</h2>
        {books.length > 0 && (
          <LibrarySortingControls
            nativeMenu
            sort={sort}
            options={options.map((option) => ({ ...option, directionLabel: directionLabel(option.value) }))}
            directionLabel={directionLabel(sort)}
            onSortChange={(value) => {
              const option = options.find((item) => item.value === value);
              if (option) setSort(option.value);
            }}
          />
        )}
      </div>
      {visibleBooks.length > 0 ? (
        <BookShelf
          key={sort}
          label={`${title} shelf`}
          books={visibleBooks.map((book) => ({
            id: book.id,
            title: book.title,
            cover: book.cover_url,
            status: book.status,
            paused: book.status === "Paused",
            favorite: book.is_favorite,
            cornerLabel: series && book.volume_number != null ? String(book.volume_number) : undefined,
          }))}
          onOpen={(book) => navigate(`/books/${encodeURIComponent(book.id)}`)}
        />
      ) : (
        <CollectionEmptyState
          title="No books yet"
          description={series
            ? "Books added to this series will appear here."
            : "Books by this author will appear here."}
        />
      )}
    </section>
  );
}
