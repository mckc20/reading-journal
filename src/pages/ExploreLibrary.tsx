import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Check,
  ChevronDown,
  Download,
  Grid2X2,
  Heart,
  List,
  MoreHorizontal,
  RefreshCw,
  Star,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import FormattedNoteContent from "@/components/FormattedNoteContent";
import GenreMultiSelect from "@/components/GenreMultiSelect";
import QuoteBlock from "@/components/QuoteBlock";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { fetchReadingLogs } from "@/lib/books";
import { fetchAllBookNotes, formatBookNotePageRange } from "@/lib/bookNotes";
import {
  buildMultiValueGroups,
  buildNoteGroups,
  buildRatingGroups,
  buildSeriesGroups,
  buildSingleValueGroups,
  filterBooksByShelfValue,
  filterNotesByShelfValue,
  type BookGroup,
  type LibraryValueShelf,
  type LibraryNote,
  type NoteGroup,
} from "@/lib/libraryShelves";
import { cn, statusVariant } from "@/lib/utils";
import BookCard from "@/components/BookCard";
import BookShelf from "@/pages/library/BookShelf";
import ContinueReadingCard from "@/pages/library/ContinueReadingCard";
import ShelfCarousel from "@/pages/library/ShelfCarousel";
import type { Book, BookNote, BookStatus, BookUpdate, ReadingLog, Series } from "@/types";

type LibraryView =
  | "all"
  | "tbr"
  | "reading"
  | "finished"
  | "wishlist"
  | "dnf"
  | "favorites"
  | "series"
  | "authors"
  | "genres"
  | "rating"
  | "notes"
  | "languages"
  | "format"
  | "source";

type PrimaryShelf = {
  value: LibraryView;
  label: string;
  matches: (book: Book) => boolean;
  emptyMessage: string;
};

type CategoryShelf = {
  value: LibraryValueShelf;
  label: string;
};

type LibrarySort =
  | "date-added"
  | "last-read"
  | "title"
  | "author"
  | "publication-date"
  | "progress"
  | "date-started"
  | "date-finished"
  | "currently-reading"
  | "highest-rated"
  | "lowest-rated"
  | "page-count"
  | "continue-reading"
  | "near-completion";

type LibraryDisplay = "grid" | "table";

type LibraryFilterKey =
  | "status"
  | "genre"
  | "rating"
  | "year"
  | "publicationYear"
  | "progress"
  | "format"
  | "language"
  | "publisher"
  | "source"
  | "series"
  | "author"
  | "favorite";

type LibraryFilters = Record<LibraryFilterKey, string[]>;

type LibraryFilterOptions = Record<LibraryFilterKey, string[]>;

type ActiveFilterChip = {
  keys: LibraryFilterKey[];
  label: string;
};

type SmartShelf = {
  key: "currently-reading" | "want-to-read" | "recently-finished" | "favorites";
  title: string;
  books: Book[];
  emptyMessage: string;
};

const filterableBookStatuses: BookStatus[] = [
  "To Read",
  "Up Next",
  "Reading",
  "Paused",
  "Finished",
  "DNF",
];

const bulkEditableBookStatuses: BookStatus[] = [
  "To Read",
  "Up Next",
  "Reading",
  "Finished",
  "DNF",
];

const recentlyFinishedWindowMs = 5 * 7 * 24 * 60 * 60 * 1000;

const filterKeys: LibraryFilterKey[] = [
  "status",
  "genre",
  "rating",
  "year",
  "publicationYear",
  "progress",
  "format",
  "language",
  "publisher",
  "source",
  "series",
  "author",
  "favorite",
];

const filterLabels: Record<LibraryFilterKey, string> = {
  status: "Status",
  genre: "Genre",
  rating: "Rating",
  year: "Year Read",
  publicationYear: "Publication Year",
  progress: "Progress",
  format: "Format",
  language: "Language",
  publisher: "Publisher",
  source: "Source",
  series: "Series",
  author: "Author",
  favorite: "Favorite",
};

const validSorts = new Set<LibrarySort>([
  "date-added",
  "last-read",
  "title",
  "author",
  "publication-date",
  "progress",
  "date-started",
  "date-finished",
  "currently-reading",
  "highest-rated",
  "lowest-rated",
  "page-count",
  "continue-reading",
  "near-completion",
]);
const validDisplays = new Set<LibraryDisplay>(["grid", "table"]);
const primaryShelves: PrimaryShelf[] = [
  {
    value: "all",
    label: "My Books",
    matches: () => true,
    emptyMessage: "No books yet. Tap + to add one.",
  },
  {
    value: "tbr",
    label: "Want to Read",
    matches: (book) => book.status === "To Read",
    emptyMessage: "No books in your reading list.",
  },
  {
    value: "reading",
    label: "Currently Reading",
    matches: (book) => book.status === "Reading",
    emptyMessage: "No books are currently in progress.",
  },
  {
    value: "finished",
    label: "Finished",
    matches: (book) => book.status === "Finished",
    emptyMessage: "No finished books yet.",
  },
  {
    value: "dnf",
    label: "DNF",
    matches: (book) => book.status === "DNF",
    emptyMessage: "No DNF books yet.",
  },
  {
    value: "favorites",
    label: "Favorites",
    matches: (book) => book.is_favorite,
    emptyMessage: "No favorite books yet.",
  },
];

const categoryShelves: CategoryShelf[] = [
  { value: "series", label: "Series" },
  { value: "authors", label: "Authors" },
  { value: "genres", label: "Genres" },
  { value: "rating", label: "Rating" },
  { value: "notes", label: "Notes" },
  { value: "languages", label: "Languages" },
  { value: "format", label: "Format" },
  { value: "source", label: "Source" },
];

const statusFilterLabels: Record<BookStatus, string> = {
  "To Read": "To Read",
  "Up Next": "Up Next",
  Reading: "Currently Reading",
  Paused: "Paused",
  Finished: "Finished",
  DNF: "DNF",
};

const statusFilterOptions = filterableBookStatuses.map((status) => statusFilterLabels[status]);

const progressFilterOptions = [
  "Not started",
  "In progress",
  "Near completion",
  "Finished",
];

const validViews = new Set<LibraryView>([
  ...primaryShelves.map((shelf) => shelf.value),
  ...categoryShelves.map((shelf) => shelf.value),
]);

function isLibraryView(value: string | null): value is LibraryView {
  return value !== null && validViews.has(value as LibraryView);
}

function isLibrarySort(value: string | null): value is LibrarySort {
  return value !== null && validSorts.has(value as LibrarySort);
}

function isLibraryDisplay(value: string | null): value is LibraryDisplay {
  return value !== null && validDisplays.has(value as LibraryDisplay);
}

function normalizeLibraryDisplay(value: string | null): LibraryDisplay {
  if (value === "compact") return "grid";
  return isLibraryDisplay(value) ? value : "grid";
}

function EmptyLibraryView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function BooksGrid({ books, onBook }: { books: Book[]; onBook: (b: Book) => void }) {
  if (books.length === 0) return null;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(126px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onClick={onBook} textSize="compact" />
      ))}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function BooksTable({
  books,
  onBook,
}: {
  books: Book[];
  onBook: (b: Book) => void;
}) {
  if (books.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border bg-background dark:bg-card">
      <table className="w-full min-w-[60rem] text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="w-16 px-3 py-2">Cover</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Author</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Rating</th>
            <th className="px-3 py-2">Date Added</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {books.map((book) => (
            <BookTableRow
              key={book.id}
              book={book}
              onBook={onBook}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookTableRow({
  book,
  onBook,
}: {
  book: Book;
  onBook: (b: Book) => void;
}) {
  return (
    <tr
      tabIndex={0}
      role="button"
      onClick={() => onBook(book)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onBook(book);
        }
      }}
      className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
    >
      <td className="px-3 py-2">
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BookOpen className="h-4 w-4 text-muted-foreground/40" />
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <p className="max-w-72 truncate font-medium leading-snug">{book.title}</p>
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        <p className="max-w-64 truncate">{book.authors.join(", ") || "-"}</p>
      </td>
      <td className="px-3 py-2">
        <Badge variant={statusVariant(book.status)} className="text-[10px]">
          {book.status}
        </Badge>
      </td>
      <td className="px-3 py-2">
        {book.rating ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-current" />
            {book.rating}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
        {book.is_favorite && (
          <Heart className="ml-2 inline h-3.5 w-3.5 fill-favorite text-favorite" aria-label="Favorite" />
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {formatNumericDate(book.created_at)}
      </td>
    </tr>
  );
}

function BooksView({
  books,
  display,
  onBook,
}: {
  books: Book[];
  display: LibraryDisplay;
  onBook: (b: Book) => void;
}) {
  if (display === "table") {
    return <BooksTable books={books} onBook={onBook} />;
  }
  return <BooksGrid books={books} onBook={onBook} />;
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBooksCsv(books: Book[]) {
  const headers = [
    "Title",
    "Authors",
    "Genres",
    "Status",
    "Rating",
    "Favorite",
    "Current Page",
    "Total Pages",
    "Date Started",
    "Date Finished",
    "Language",
    "Format",
    "Source",
    "Publisher",
    "Publication Date",
    "Description",
    "ISBN",
  ];
  const rows = books.map((book) => [
    book.title,
    book.authors,
    book.genres ?? [],
    book.status,
    book.rating ?? "",
    book.is_favorite ? "Yes" : "No",
    book.current_page ?? "",
    book.total_pages ?? "",
    book.date_started ?? "",
    book.date_finished ?? "",
    book.language ?? "",
    book.format ?? "",
    book.source ?? "",
    book.publisher ?? "",
    book.publication_date ?? "",
    book.description ?? "",
    book.isbn ?? "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "selected-library-books.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function ManagementTable({
  books,
  selectedIds,
  saving,
  onToggleBook,
  onToggleAll,
}: {
  books: Book[];
  selectedIds: Set<string>;
  saving: boolean;
  onToggleBook: (bookId: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected = books.length > 0 && books.every((book) => selectedIds.has(book.id));

  return (
    <div className="overflow-x-auto rounded-lg border bg-background dark:bg-card">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={books.length === 0 || saving}
                onChange={onToggleAll}
                aria-label={allSelected ? "Deselect all books" : "Select all books"}
                className="h-4 w-4 rounded border-border"
              />
            </th>
            <th className="px-3 py-2">Book</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Genres</th>
            <th className="px-3 py-2">Rating</th>
            <th className="px-3 py-2">Progress</th>
            <th className="px-3 py-2">Format</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {books.map((book) => (
            <tr key={book.id} className="transition-colors hover:bg-muted/50">
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(book.id)}
                  disabled={saving}
                  onChange={() => onToggleBook(book.id)}
                  aria-label={`Select ${book.title}`}
                  className="h-4 w-4 rounded border-border"
                />
              </td>
              <td className="px-3 py-2">
                <div className="min-w-0">
                  <p className="max-w-72 truncate font-medium leading-snug">{book.title}</p>
                  <p className="max-w-72 truncate text-xs text-muted-foreground">
                    {book.authors.join(", ")}
                  </p>
                </div>
              </td>
              <td className="px-3 py-2">
                <Badge variant={statusVariant(book.status)} className="text-[10px]">
                  {book.status}
                </Badge>
              </td>
              <td className="max-w-56 px-3 py-2 text-muted-foreground">
                <span className="line-clamp-2">{book.genres?.join(", ") || "-"}</span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{book.rating ?? "-"}</td>
              <td className="px-3 py-2 text-muted-foreground">{getBookProgress(book)}%</td>
              <td className="px-3 py-2 text-muted-foreground">{book.format ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManagementMode({
  books,
  selectedIds,
  saving,
  bulkError,
  genreInput,
  bulkStatus,
  onGenreInputChange,
  onBulkStatusChange,
  onToggleBook,
  onToggleAll,
  onClose,
  onExport,
  onApplyStatus,
  onAddGenres,
}: {
  books: Book[];
  selectedIds: Set<string>;
  saving: boolean;
  bulkError: string | null;
  genreInput: string[];
  bulkStatus: BookStatus;
  onGenreInputChange: (value: string[]) => void;
  onBulkStatusChange: (value: BookStatus) => void;
  onToggleBook: (bookId: string) => void;
  onToggleAll: () => void;
  onClose: () => void;
  onExport: () => void;
  onApplyStatus: () => void;
  onAddGenres: () => void;
}) {
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const hasGenreInput = genreInput.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-lg font-medium leading-snug">Management Mode</h2>
          <p className="text-sm text-muted-foreground">
            {selectedCount} selected from {books.length} visible books
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <Label className="text-xs text-muted-foreground">Bulk status</Label>
            <Select value={bulkStatus} onValueChange={(value) => onBulkStatusChange(value as BookStatus)}>
              <SelectTrigger aria-label="Bulk status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bulkEditableBookStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" disabled={!hasSelection || saving} onClick={onApplyStatus}>
            {saving ? "Saving..." : "Update status"}
          </Button>
          <div className="w-56">
            <Label className="text-xs text-muted-foreground">Add genres</Label>
            <GenreMultiSelect
              value={genreInput}
              onChange={onGenreInputChange}
              disabled={saving}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!hasSelection || !hasGenreInput || saving}
            onClick={onAddGenres}
          >
            Add genres
          </Button>
          <Button type="button" variant="outline" disabled={!hasSelection} onClick={onExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {bulkError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {bulkError}
        </div>
      )}

      {books.length === 0 ? (
        <EmptyLibraryView message="No books match the current filters." />
      ) : (
        <ManagementTable
          books={books}
          selectedIds={selectedIds}
          saving={saving}
          onToggleBook={onToggleBook}
          onToggleAll={onToggleAll}
        />
      )}
    </div>
  );
}

function LibraryViewModeSwitcher({
  display,
  onDisplayChange,
}: {
  display: LibraryDisplay;
  onDisplayChange: (display: LibraryDisplay) => void;
}) {
  return (
    <div className="flex rounded-lg border bg-background p-0.5 dark:bg-input/30">
      <Button
        type="button"
        size="icon-sm"
        variant={display === "grid" ? "secondary" : "ghost"}
        aria-label="Grid view"
        aria-pressed={display === "grid"}
        onClick={() => onDisplayChange("grid")}
      >
        <Grid2X2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant={display === "table" ? "secondary" : "ghost"}
        aria-label="List view"
        aria-pressed={display === "table"}
        onClick={() => onDisplayChange("table")}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}

function LibrarySection({
  title,
  countLabel,
  action,
  children,
}: {
  title: string;
  countLabel?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-medium leading-snug">{title}</h2>
          {countLabel && (
            <p className="text-xs text-muted-foreground">{countLabel}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function LibraryPlaceholder({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function libraryResultsEmptyMessage({
  hasSearch,
  hasActiveFilters,
  fallback,
}: {
  hasSearch: boolean;
  hasActiveFilters: boolean;
  fallback: string;
}) {
  if (hasSearch) return "No books match your search.";
  if (hasActiveFilters) return "No books match your filters.";
  return fallback;
}

function continueReadingEmptyMessage({
  hasSearch,
  hasActiveFilters,
}: {
  hasSearch: boolean;
  hasActiveFilters: boolean;
}) {
  if (hasSearch) return "No current reads match your search.";
  if (hasActiveFilters) return "No current reads match your filters.";
  return "Books you are currently reading will appear here first.";
}

function groupCountLabel(count: number) {
  return `${count} book${count !== 1 ? "s" : ""}`;
}

function itemCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function uniqueSortedValues(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
}

function getBookFilterDate(book: Book): string | undefined {
  return book.date_finished ?? book.date_started ?? book.created_at;
}

function getBookFilterDateParts(book: Book): { year?: string; month?: string } {
  const value = getBookFilterDate(book);
  if (!value) return {};

  const [datePart] = value.split("T");
  const [year, month] = datePart.split("-");

  if (!year || !month) return {};
  return { year, month };
}

function getPublicationYear(book: Book): string | undefined {
  const [year] = (book.publication_date ?? "").split("-");
  return year && /^\d{4}$/.test(year) ? year : undefined;
}

function getFilterValues(searchParams: URLSearchParams, key: LibraryFilterKey): string[] {
  return Array.from(
    new Set(searchParams.getAll(key).map((value) => value.trim()).filter(Boolean)),
  );
}

function getLibraryFilters(searchParams: URLSearchParams): LibraryFilters {
  return {
    status: getFilterValues(searchParams, "status"),
    genre: getFilterValues(searchParams, "genre"),
    rating: getFilterValues(searchParams, "rating"),
    year: getFilterValues(searchParams, "year"),
    publicationYear: getFilterValues(searchParams, "publicationYear"),
    progress: getFilterValues(searchParams, "progress"),
    format: getFilterValues(searchParams, "format"),
    language: getFilterValues(searchParams, "language"),
    publisher: getFilterValues(searchParams, "publisher"),
    source: getFilterValues(searchParams, "source"),
    series: getFilterValues(searchParams, "series"),
    author: getFilterValues(searchParams, "author"),
    favorite: getFilterValues(searchParams, "favorite"),
  };
}

function hasActiveLibraryFilters(filters: LibraryFilters): boolean {
  return filterKeys.some((key) => filters[key].length > 0);
}

function buildLibraryFilterOptions(books: Book[], series: Series[]): LibraryFilterOptions {
  const years = new Set<string>();
  const publicationYears = new Set<string>();
  const seriesById = new Map(series.map((item) => [item.id, item.name]));

  books.forEach((book) => {
    const { year } = getBookFilterDateParts(book);
    if (year) years.add(year);

    const publicationYear = getPublicationYear(book);
    if (publicationYear) publicationYears.add(publicationYear);
  });

  return {
    status: statusFilterOptions,
    genre: uniqueSortedValues(books.flatMap((book) => book.genres ?? [])),
    rating: ["Favorite", ...uniqueSortedValues(books.map((book) => book.rating?.toString()))],
    year: Array.from(years).sort((a, b) => Number(b) - Number(a)),
    publicationYear: Array.from(publicationYears).sort((a, b) => Number(b) - Number(a)),
    progress: progressFilterOptions,
    format: uniqueSortedValues(books.map((book) => book.format)),
    language: uniqueSortedValues(books.map((book) => book.language)),
    publisher: uniqueSortedValues(books.map((book) => book.publisher)),
    source: uniqueSortedValues(books.map((book) => book.source)),
    series: uniqueSortedValues(books.map((book) => (book.series_id ? seriesById.get(book.series_id) : null))),
    author: uniqueSortedValues(books.flatMap((book) => book.authors)),
    favorite: ["Yes"],
  };
}

function bookMatchesProgressFilter(book: Book, filter: string): boolean {
  const progress = getBookProgress(book);

  if (filter === "Not started") return progress === 0;
  if (filter === "In progress") return progress > 0 && progress < 80;
  if (filter === "Near completion") return progress >= 80 && progress < 100;
  if (filter === "Finished") return progress === 100;

  return true;
}

function matchesAnyFilterValue(values: string[], matches: (value: string) => boolean): boolean {
  return values.length === 0 || values.some(matches);
}

function bookMatchesLibraryFilters(book: Book, filters: LibraryFilters, series: Series[]): boolean {
  if (!matchesAnyFilterValue(filters.status, (filter) => {
    const matchingStatus = filterableBookStatuses.find((status) => statusFilterLabels[status] === filter);
    return Boolean(matchingStatus && book.status === matchingStatus);
  })) return false;

  if (!matchesAnyFilterValue(filters.genre, (filter) => (book.genres ?? []).includes(filter))) return false;

  if (!matchesAnyFilterValue(filters.rating, (filter) => {
    if (filter === "Favorite") return book.is_favorite;
    const rating = Number.parseInt(filter, 10);
    return Number.isFinite(rating) && book.rating === rating;
  })) return false;

  if (!matchesAnyFilterValue(filters.progress, (filter) => bookMatchesProgressFilter(book, filter))) return false;
  if (!matchesAnyFilterValue(filters.publicationYear, (filter) => getPublicationYear(book) === filter)) return false;
  if (!matchesAnyFilterValue(filters.format, (filter) => book.format === filter)) return false;
  if (!matchesAnyFilterValue(filters.language, (filter) => book.language === filter)) return false;
  if (!matchesAnyFilterValue(filters.publisher, (filter) => book.publisher === filter)) return false;
  if (!matchesAnyFilterValue(filters.source, (filter) => book.source === filter)) return false;
  if (!matchesAnyFilterValue(filters.series, (filter) => getSeriesName(book, series) === filter)) return false;
  if (!matchesAnyFilterValue(filters.author, (filter) => book.authors.includes(filter))) return false;
  if (!matchesAnyFilterValue(filters.favorite, (filter) => filter === "Yes" && book.is_favorite)) return false;

  if (filters.year.length > 0) {
    const { year } = getBookFilterDateParts(book);
    if (!year || !filters.year.includes(year)) return false;
  }

  return true;
}

function applyLibraryFilters(books: Book[], filters: LibraryFilters, series: Series[]): Book[] {
  if (!hasActiveLibraryFilters(filters)) return books;
  return books.filter((book) => bookMatchesLibraryFilters(book, filters, series));
}

function buildActiveFilterChips(filters: LibraryFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  filterKeys.forEach((key) => {
    const values = filters[key];
    if (values.length === 0) return;

    chips.push({
      keys: [key],
      label: `${filterLabels[key]}: ${values.join(", ")}`,
    });
  });

  return chips;
}

function getBookProgress(book: Book): number {
  if (book.status === "Finished") return 100;
  if (["To Read", "Up Next"].includes(book.status)) return 0;

  const currentPage = Math.max(0, book.current_page ?? 0);
  const totalPages = Math.max(0, book.total_pages ?? 0);

  if (totalPages <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)));
}

function getSeriesName(book: Book, series: Series[]): string {
  if (!book.series_id) return "";
  return series.find((item) => item.id === book.series_id)?.name ?? "";
}

function matchesLibrarySearch(book: Book, series: Series[], query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const searchableText = [
    book.title,
    ...book.authors,
    ...(book.genres ?? []),
    getSeriesName(book, series),
  ]
    .join(" ")
    .toLocaleLowerCase();

  return searchableText.includes(normalizedQuery);
}

function compareByTitle(a: Book, b: Book): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
}

function compareByAuthor(a: Book, b: Book): number {
  const firstAuthorA = a.authors[0] ?? "";
  const firstAuthorB = b.authors[0] ?? "";
  return firstAuthorA.localeCompare(firstAuthorB, undefined, { sensitivity: "base", numeric: true }) || compareByTitle(a, b);
}

function buildLatestReadTimesByBook(logs: ReadingLog[]): Map<string, number> {
  const latestReadTimes = new Map<string, number>();

  logs.forEach((log) => {
    const loggedAt = new Date(log.logged_at).getTime();
    if (!Number.isFinite(loggedAt)) return;

    const currentLatest = latestReadTimes.get(log.book_id) ?? 0;
    if (loggedAt > currentLatest) latestReadTimes.set(log.book_id, loggedAt);
  });

  return latestReadTimes;
}

function getLastReadSortTime(book: Book, latestReadTimesByBook: Map<string, number>): number {
  return latestReadTimesByBook.get(book.id) ?? (book.date_finished ? new Date(book.date_finished).getTime() : 0);
}

function getPublicationDateSortTime(book: Book): number {
  if (!book.publication_date) return 0;
  const date = new Date(`${book.publication_date}T00:00:00`);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortLibraryBooks(
  books: Book[],
  sort: LibrarySort,
  latestReadTimesByBook = new Map<string, number>(),
): Book[] {
  return [...books].sort((a, b) => {
    if (sort === "date-added") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || compareByTitle(a, b);
    }

    if (sort === "last-read") {
      return getLastReadSortTime(b, latestReadTimesByBook) - getLastReadSortTime(a, latestReadTimesByBook) || compareByTitle(a, b);
    }

    if (sort === "author") {
      return compareByAuthor(a, b);
    }

    if (sort === "publication-date") {
      return getPublicationDateSortTime(b) - getPublicationDateSortTime(a) || compareByTitle(a, b);
    }

    if (sort === "progress") {
      return getBookProgress(b) - getBookProgress(a) || compareByTitle(a, b);
    }

    if (sort === "date-started") {
      const startedA = a.date_started ? new Date(a.date_started).getTime() : 0;
      const startedB = b.date_started ? new Date(b.date_started).getTime() : 0;
      return startedB - startedA || compareByTitle(a, b);
    }

    if (sort === "date-finished") {
      const finishedA = a.date_finished ? new Date(a.date_finished).getTime() : 0;
      const finishedB = b.date_finished ? new Date(b.date_finished).getTime() : 0;
      return finishedB - finishedA || compareByTitle(a, b);
    }

    if (sort === "currently-reading") {
      return Number(b.status === "Reading") - Number(a.status === "Reading") || compareByTitle(a, b);
    }

    if (sort === "highest-rated") {
      return (b.rating ?? -1) - (a.rating ?? -1) || compareByTitle(a, b);
    }

    if (sort === "lowest-rated") {
      const ratingA = a.rating ?? Number.POSITIVE_INFINITY;
      const ratingB = b.rating ?? Number.POSITIVE_INFINITY;
      return ratingA - ratingB || compareByTitle(a, b);
    }

    if (sort === "page-count") {
      return (b.total_pages ?? 0) - (a.total_pages ?? 0) || compareByTitle(a, b);
    }

    if (sort === "continue-reading") {
      return (
        Number(b.status === "Reading") - Number(a.status === "Reading") ||
        getBookProgress(b) - getBookProgress(a) ||
        compareByTitle(a, b)
      );
    }

    if (sort === "near-completion") {
      return (
        Number(a.status === "Finished") - Number(b.status === "Finished") ||
        getBookProgress(b) - getBookProgress(a) ||
        compareByTitle(a, b)
      );
    }

    return compareByTitle(a, b);
  });
}

function filterAndSortBooks({
  books,
  series,
  query,
  sort,
  latestReadTimesByBook,
}: {
  books: Book[];
  series: Series[];
  query: string;
  sort: LibrarySort;
  latestReadTimesByBook?: Map<string, number>;
}) {
  return sortLibraryBooks(
    books.filter((book) => matchesLibrarySearch(book, series, query)),
    sort,
    latestReadTimesByBook,
  );
}

function formatLibraryDate(value: string | number | null | undefined): string {
  if (value === undefined || value === null || value === "") return "-";

  const date = typeof value === "number"
    ? new Date(value)
    : new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (!Number.isFinite(date.getTime())) return "-";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumericDate(value: string | number | null | undefined): string {
  if (value === undefined || value === null || value === "") return "-";

  const date = typeof value === "number"
    ? new Date(value)
    : new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (!Number.isFinite(date.getTime())) return "-";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatNoteDate(value: string): string {
  return formatLibraryDate(value);
}

function noteGroupCountLabel(count: number) {
  return `${count} entr${count === 1 ? "y" : "ies"}`;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  showLabel = true,
  emptyLabel,
  triggerClassName,
  disabled = false,
  mutedEmptyValue = false,
}: {
  label: string;
  value: string[];
  options: string[];
  onChange: (value: string) => void;
  showLabel?: boolean;
  emptyLabel?: string;
  triggerClassName?: string;
  disabled?: boolean;
  mutedEmptyValue?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedValues = new Set(value);
  const selectedLabel =
    value.length === 0
      ? (emptyLabel ?? `Any ${label.toLowerCase()}`)
      : value.length === 1
        ? value[0]
        : `${value.length} selected`;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;
      if (!container || container.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", showLabel && "space-y-1.5")}>
      {showLabel && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Button
        type="button"
        variant="outline"
        aria-label={label}
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "w-full justify-between font-normal",
          triggerClassName,
          value.length === 0 && mutedEmptyValue && "text-muted-foreground",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full min-w-44 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]">
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value.length === 0 && mutedEmptyValue && "text-muted-foreground",
            )}
            onClick={() => onChange("")}
          >
            {emptyLabel ?? `Any ${label.toLowerCase()}`}
          </button>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onChange(option)}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input",
                  selectedValues.has(option) && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {selectedValues.has(option) && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 truncate">{option}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DisabledFilterButton({ label }: { label: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-muted-foreground"
        disabled
        title={`${label} is not implemented yet.`}
      >
        --
      </Button>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function AllFilterFields({
  filters,
  filterOptions,
  onFilterChange,
}: {
  filters: LibraryFilters;
  filterOptions: LibraryFilterOptions;
  onFilterChange: (key: LibraryFilterKey, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <FilterGroup title="Basic Filters">
        <FilterSelect
          label="Status"
          value={filters.status}
          options={filterOptions.status}
          onChange={(value) => onFilterChange("status", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
        <FilterSelect
          label="Genre"
          value={filters.genre}
          options={filterOptions.genre}
          onChange={(value) => onFilterChange("genre", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
        <FilterSelect
          label="Language"
          value={filters.language}
          options={filterOptions.language}
          onChange={(value) => onFilterChange("language", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
        <FilterSelect
          label="Format"
          value={filters.format}
          options={filterOptions.format}
          onChange={(value) => onFilterChange("format", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
        <FilterSelect
          label="Publisher"
          value={filters.publisher}
          options={filterOptions.publisher}
          onChange={(value) => onFilterChange("publisher", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
        <FilterSelect
          label="Source"
          value={filters.source}
          options={filterOptions.source}
          onChange={(value) => onFilterChange("source", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
      </FilterGroup>

      <FilterGroup title="Reading Filters">
        <FilterSelect
          label="Year Read"
          value={filters.year}
          options={filterOptions.year}
          onChange={(value) => onFilterChange("year", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
        <FilterSelect
          label="Publication Year"
          value={filters.publicationYear}
          options={filterOptions.publicationYear}
          onChange={(value) => onFilterChange("publicationYear", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
        <FilterSelect
          label="Progress"
          value={filters.progress}
          options={filterOptions.progress}
          onChange={(value) => onFilterChange("progress", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
        <FilterSelect
          label="Rating"
          value={filters.rating}
          options={filterOptions.rating}
          onChange={(value) => onFilterChange("rating", value)}
            emptyLabel="--"
            mutedEmptyValue
        />
      </FilterGroup>

      <FilterGroup title="Organization">
        <FilterSelect
          label="Series"
          value={filters.series}
          options={filterOptions.series}
          onChange={(value) => onFilterChange("series", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
        <DisabledFilterButton label="Collection" />
        <FilterSelect
          label="Author"
          value={filters.author}
          options={filterOptions.author}
          onChange={(value) => onFilterChange("author", value)}
          emptyLabel="--"
          mutedEmptyValue
        />
      </FilterGroup>
    </div>
  );
}

const sortLabels: Record<LibrarySort, string> = {
  "date-added": "Recently Added",
  "last-read": "Last Read",
  title: "Title A-Z",
  author: "Author A-Z",
  "publication-date": "Publication Date",
  progress: "Progress",
  "date-started": "Date Started",
  "date-finished": "Date Finished",
  "currently-reading": "Currently Reading",
  "highest-rated": "Highest - Lowest",
  "lowest-rated": "Lowest - Highest",
  "page-count": "Pages",
  "continue-reading": "Continue Reading",
  "near-completion": "Near Completion",
};

function SortOptionButton({
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-7 justify-start gap-2 px-1.5 text-left",
        active && "bg-secondary text-secondary-foreground",
        disabled && "text-muted-foreground",
      )}
      disabled={disabled}
      title={disabled ? `${label} is not implemented yet.` : undefined}
      onClick={onClick}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input",
          active && "border-primary bg-primary text-primary-foreground",
        )}
      >
        {active && <Check className="h-3 w-3" />}
      </span>
      {label}
    </Button>
  );
}

function SortGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function AllSortingFields({
  sort,
  onSortChange,
}: {
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
}) {
  const option = (value: LibrarySort) => (
    <SortOptionButton
      key={value}
      label={sortLabels[value]}
      active={sort === value}
      onClick={() => onSortChange(value)}
    />
  );

  return (
    <div className="space-y-6">
      <SortGroup title="Activity">
        {option("date-added")}
        {option("last-read")}
      </SortGroup>
      <SortGroup title="Book Details">
        {option("title")}
        {option("author")}
        {option("publication-date")}
        {option("page-count")}
      </SortGroup>
      <SortGroup title="Reading">
        {option("progress")}
        {option("date-started")}
        {option("date-finished")}
      </SortGroup>
      <SortGroup title="Rating">
        {option("highest-rated")}
        {option("lowest-rated")}
      </SortGroup>
    </div>
  );
}

function LibraryControlsBar({
  sort,
  display,
  filters,
  filterOptions,
  activeFilterChips,
  onSortChange,
  onDisplayChange,
  onFilterChange,
  onRemoveFilter,
  onClearFilters,
}: {
  sort: LibrarySort;
  display: LibraryDisplay;
  filters: LibraryFilters;
  filterOptions: LibraryFilterOptions;
  activeFilterChips: ActiveFilterChip[];
  onSortChange: (sort: LibrarySort) => void;
  onDisplayChange: (display: LibraryDisplay) => void;
  onFilterChange: (key: LibraryFilterKey, value: string) => void;
  onRemoveFilter: (keys: LibraryFilterKey[]) => void;
  onClearFilters: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasActiveFilters = activeFilterChips.length > 0;
  const handleSortDropdownChange = (value: string) => {
    if (value === "all-sorting") {
      setFiltersOpen(true);
      return;
    }

    onSortChange(value as LibrarySort);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-y py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Status"
            value={filters.status}
            options={filterOptions.status}
            onChange={(value) => onFilterChange("status", value)}
            showLabel={false}
            emptyLabel="Status"
            triggerClassName="w-[9.75rem]"
          />
          <FilterSelect
            label="Genre"
            value={filters.genre}
            options={filterOptions.genre}
            onChange={(value) => onFilterChange("genre", value)}
            showLabel={false}
            emptyLabel="Genre"
            triggerClassName="w-[8.5rem]"
          />
          <FilterSelect
            label="Rating"
            value={filters.rating}
            options={filterOptions.rating}
            onChange={(value) => onFilterChange("rating", value)}
            showLabel={false}
            emptyLabel="Rating"
            triggerClassName="w-[8.5rem]"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            aria-label="All filters"
          >
            <MoreHorizontal className="h-4 w-4" />
            {hasActiveFilters && (
              <span className="absolute -right-1 -top-1 rounded-full bg-secondary px-1.5 text-xs text-secondary-foreground">
                {activeFilterChips.length}
              </span>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Select value={sort} onValueChange={handleSortDropdownChange}>
            <SelectTrigger className="w-[12.5rem] justify-start gap-1.5" aria-label="Sort books">
              <span className="text-muted-foreground">Sort by:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-added">Recently Added</SelectItem>
              <SelectItem value="date-finished">Date Finished</SelectItem>
              <SelectItem value="publication-date">Publication Date</SelectItem>
              <SelectItem value="title">Title A-Z</SelectItem>
              <SelectItem value="author">Author A-Z</SelectItem>
              <SelectItem value="all-sorting" className="text-muted-foreground">
                View all
              </SelectItem>
            </SelectContent>
          </Select>
          <LibraryViewModeSwitcher
            display={display}
            onDisplayChange={onDisplayChange}
          />
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="left-auto right-0 top-0 h-svh max-h-svh max-w-full translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none border-l p-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-normal">
              Advanced Filters and Sorting
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            <AllFilterFields
              filters={filters}
              filterOptions={filterOptions}
              onFilterChange={onFilterChange}
            />
            <Separator />
            <AllSortingFields sort={sort} onSortChange={onSortChange} />
          </div>
          <DialogFooter>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={onClearFilters}>
                Clear filters
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterChips.map((chip) => (
            <Badge key={chip.label} variant="secondary" className="gap-1 pr-1">
              {chip.label}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label={`Remove ${chip.label}`}
                onClick={() => onRemoveFilter(chip.keys)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}

function LibraryToolbar({
  title,
  countLabel,
  loading,
  onManageLibrary,
}: {
  title: string;
  countLabel: string;
  loading: boolean;
  onManageLibrary?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="font-heading text-4xl font-bold leading-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {title === "My Books" ? "Your library, your stories." : loading ? "..." : countLabel}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
        {onManageLibrary && (
          <Button
            type="button"
            variant="outline"
            onClick={onManageLibrary}
            className="text-muted-foreground sm:w-auto"
          >
            Manage Library
          </Button>
        )}
      </div>
    </div>
  );
}

function GroupedBooksView({
  groups,
  onBook,
}: {
  groups: BookGroup[];
  onBook: (book: Book) => void;
}) {
  if (groups.length === 0) {
    return <EmptyLibraryView message="No books yet." />;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.name} className="space-y-3">
          <div>
            <h3 className="font-heading leading-snug font-medium">{group.name}</h3>
            <p className="text-xs text-muted-foreground">{groupCountLabel(group.books.length)}</p>
          </div>
          <Separator />
          <BooksGrid books={group.books} onBook={onBook} />
        </section>
      ))}
    </div>
  );
}

function LibraryNoteCard({ note, onBook }: { note: LibraryNote; onBook: (book: Book) => void }) {
  const pageLabel = formatBookNotePageRange(note);
  const visibleDate = note.note_date ?? note.created_at;
  const noteMetadata = (
    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
      {note.label === "quote" && note.is_favorite && (
        <Heart className="h-4 w-4 fill-favorite text-favorite" aria-label="Favorite quote" />
      )}
      <time dateTime={visibleDate}>{formatNoteDate(visibleDate)}</time>
    </div>
  );

  return (
    <button
      type="button"
      onClick={() => onBook(note.book)}
      className="block w-full rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50 dark:bg-card"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-medium leading-snug">{note.book.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {note.book.authors.join(", ")}
          </p>
        </div>
        {noteMetadata}
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
        >
          <FormattedNoteContent markdown={note.content} className="line-clamp-4" />
        </QuoteBlock>
      ) : (
        <>
          {note.title && (
            <p className="mb-1 text-sm font-medium leading-snug text-foreground">{note.title}</p>
          )}
          <FormattedNoteContent
            markdown={note.content}
            className="line-clamp-4 text-sm leading-6 text-foreground"
          />
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

function GroupedNotesView({
  groups,
  onBook,
}: {
  groups: NoteGroup[];
  onBook: (book: Book) => void;
}) {
  if (groups.length === 0) {
    return <EmptyLibraryView message="No notes yet." />;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.name} className="space-y-3">
          <div>
            <h3 className="font-heading leading-snug font-medium">{group.name}</h3>
            <p className="text-xs text-muted-foreground">{noteGroupCountLabel(group.notes.length)}</p>
          </div>
          <Separator />
          <div className="space-y-3">
            {group.notes.map((note) => (
              <LibraryNoteCard key={note.id} note={note} onBook={onBook} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function activePrimaryShelfForView(view: LibraryView) {
  return primaryShelves.find((shelf) => shelf.value === view);
}

function readingShelfBooks(
  books: Book[],
  series: Series[],
  query: string,
  sort: LibrarySort,
  latestReadTimesByBook?: Map<string, number>,
) {
  return filterAndSortBooks({
    books: books.filter((book) => book.status === "Reading"),
    series,
    query,
    sort,
    latestReadTimesByBook,
  });
}

function compareRecentlyFinishedBooks(a: Book, b: Book): number {
  const finishedA = a.date_finished ? new Date(a.date_finished).getTime() : 0;
  const finishedB = b.date_finished ? new Date(b.date_finished).getTime() : 0;
  const addedA = new Date(a.created_at).getTime();
  const addedB = new Date(b.created_at).getTime();

  return finishedB - finishedA || addedB - addedA || a.title.localeCompare(b.title);
}

function wasFinishedInRecentWindow(book: Book, now = Date.now()): boolean {
  if (book.status !== "Finished" || !book.date_finished) return false;

  const finishedAt = new Date(book.date_finished).getTime();
  if (!Number.isFinite(finishedAt)) return false;

  return finishedAt <= now && finishedAt >= now - recentlyFinishedWindowMs;
}

function buildSmartShelves(books: Book[]): SmartShelf[] {
  const now = Date.now();
  const currentlyReading = books.filter((book) => book.status === "Reading");
  const wantToRead = books.filter((book) => book.status === "To Read");
  const recentlyFinished = books
    .filter((book) => wasFinishedInRecentWindow(book, now))
    .sort(compareRecentlyFinishedBooks);
  const favorites = books.filter((book) => book.is_favorite);

  return [
    {
      key: "currently-reading",
      title: "Currently Reading",
      books: currentlyReading,
      emptyMessage: "Books you are currently reading will appear here.",
    },
    {
      key: "want-to-read",
      title: "Want to Read",
      books: wantToRead,
      emptyMessage: "To Read books will appear here.",
    },
    {
      key: "recently-finished",
      title: "Recently Finished",
      books: recentlyFinished,
      emptyMessage: "Finished books will appear here.",
    },
    {
      key: "favorites",
      title: "Favorites",
      books: favorites,
      emptyMessage: "Tap the heart on a book to collect favorites here.",
    },
  ];
}

function getShelfFilters(shelf: SmartShelf): Partial<LibraryFilters> {
  if (shelf.key === "currently-reading") return { status: ["Currently Reading"] };
  if (shelf.key === "want-to-read") return { status: ["To Read"] };
  if (shelf.key === "favorites") return { rating: ["Favorite"] };
  return {};
}

function getShelfSort(shelf: SmartShelf): LibrarySort | undefined {
  if (shelf.key === "recently-finished") return "date-finished";
  return undefined;
}

function MyBooksOverview({
  books,
  continueReadingBooks,
  smartShelves,
  display,
  loading,
  hasActiveFilters,
  query,
  countLabel,
  controls,
  onDisplayChange,
  onViewAll,
  onBook,
}: {
  books: Book[];
  continueReadingBooks: Book[];
  smartShelves: SmartShelf[];
  display: LibraryDisplay;
  loading: boolean;
  hasActiveFilters: boolean;
  query: string;
  countLabel: string;
  controls: ReactNode;
  onDisplayChange: (display: LibraryDisplay) => void;
  onViewAll: (shelf: SmartShelf) => void;
  onBook: (book: Book) => void;
}) {
  const hasSearch = Boolean(normalizeSearchText(query));

  return (
    <div className="space-y-8">
      <LibrarySection title="Continue Reading">
        {loading ? (
          <LoadingGrid />
        ) : continueReadingBooks.length > 0 ? (
          <ShelfCarousel
            ariaLabel="Continue reading books"
            itemClassName="w-[72vw] max-w-[18rem] shrink-0 sm:w-[15rem] lg:w-[13.5rem]"
            className="gap-4"
          >
            {continueReadingBooks.slice(0, 8).map((book) => (
              <ContinueReadingCard key={book.id} book={book} onBook={onBook} />
            ))}
          </ShelfCarousel>
        ) : (
          <LibraryPlaceholder
            message={continueReadingEmptyMessage({ hasSearch, hasActiveFilters })}
          />
        )}
      </LibrarySection>

      <LibrarySection title="Bookshelves">
        {loading ? (
          <LoadingGrid />
        ) : (
          <div className="space-y-7">
            {smartShelves.map((shelf) => (
              <BookShelf
                key={shelf.key}
                title={shelf.title}
                books={shelf.books}
                onBook={onBook}
                onViewAll={() => onViewAll(shelf)}
                emptyMessage={shelf.emptyMessage}
              />
            ))}
          </div>
        )}
      </LibrarySection>

      <LibrarySection
        title="All Books"
        countLabel={loading ? "..." : countLabel}
        action={
          <LibraryViewModeSwitcher
            display={display}
            onDisplayChange={onDisplayChange}
          />
        }
      >
        {controls}
        {loading ? (
          <LoadingGrid />
        ) : books.length === 0 ? (
          <EmptyLibraryView
            message={libraryResultsEmptyMessage({
              hasSearch,
              hasActiveFilters,
              fallback: "No books yet. Tap + to add one.",
            })}
          />
        ) : (
          <BooksView
            books={books}
            display={display}
            onBook={onBook}
          />
        )}
      </LibrarySection>
    </div>
  );
}

export default function Library() {
  const { books, loading: booksLoading, error, reload, updateBook } = useBooksContext();
  const { series, loading: seriesLoading } = useSeries();
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [readingLogsLoaded, setReadingLogsLoaded] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const viewParam = searchParams.get("view");
  const valueParam = searchParams.get("value")?.trim() || undefined;
  const queryParam = searchParams.get("q") ?? "";
  const sortParam = searchParams.get("sort");
  const displayParam = searchParams.get("display");
  const modeParam = searchParams.get("mode");
  const libraryFilters = useMemo(() => getLibraryFilters(searchParams), [searchParams]);
  const activeFilterChips = useMemo(() => buildActiveFilterChips(libraryFilters), [libraryFilters]);
  const hasExplicitView = isLibraryView(viewParam);
  const activeView = hasExplicitView ? viewParam : "all";
  const contentView = activeView;
  const libraryQuery = queryParam;
  const librarySort: LibrarySort = isLibrarySort(sortParam) ? sortParam : "title";
  const libraryDisplay = normalizeLibraryDisplay(displayParam);
  const isManageMode = modeParam === "manage";
  const isNotesView = contentView === "notes";
  const activeCategoryShelf = categoryShelves.find((shelf) => shelf.value === contentView);
  const activeValueShelf = activeCategoryShelf?.value;
  const selectedValue = activeValueShelf ? valueParam : undefined;
  const showLibraryToolbar = Boolean(
    !isNotesView && (activePrimaryShelfForView(contentView) || activeValueShelf || activeFilterChips.length)
  );
  const shouldLoadNotes = isNotesView;
  const loading = booksLoading || seriesLoading || (isNotesView && notesLoading);
  const pageTitle = "Your Library";
  const filterOptions = useMemo(() => buildLibraryFilterOptions(books, series), [books, series]);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<BookStatus>("Reading");
  const [genreInput, setGenreInput] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    if (viewParam && !isLibraryView(viewParam)) {
      navigate("/library/explore", { replace: true });
    }
  }, [navigate, viewParam]);

  useEffect(() => {
    if (displayParam !== "compact") return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("display", "grid");
    setSearchParams(nextParams, { replace: true });
  }, [displayParam, searchParams, setSearchParams]);

  useEffect(() => {
    setSelectedBookIds((current) => {
      const visibleIds = new Set(books.map((book) => book.id));
      const next = new Set(Array.from(current).filter((bookId) => visibleIds.has(bookId)));
      return next.size === current.size ? current : next;
    });
  }, [books]);

  useEffect(() => {
    if (!shouldLoadNotes || notesLoaded) return;

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
        setNotesError(fetchError instanceof Error ? fetchError.message : "Could not load notes.");
      })
      .finally(() => {
        if (isMounted) setNotesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [notesLoaded, shouldLoadNotes]);

  useEffect(() => {
    if (librarySort !== "last-read" || readingLogsLoaded) return;

    let isMounted = true;

    fetchReadingLogs()
      .then((data) => {
        if (!isMounted) return;
        setReadingLogs(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setReadingLogs([]);
      })
      .finally(() => {
        if (isMounted) setReadingLogsLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, [librarySort, readingLogsLoaded]);

  function openBook(book: Book) {
    navigate(`/books/${book.id}`);
  }

  function retryNotes() {
    setNotesLoaded(false);
    setNotesError(null);
  }

  function updateLibraryParam(key: "q" | "sort" | "display", value: string) {
    const nextParams = new URLSearchParams(searchParams);
    const normalizedValue = key === "q" ? value.trim() : value;
    const isDefaultValue =
      !normalizedValue ||
      (key === "sort" && normalizedValue === "title") ||
      (key === "display" && normalizedValue === "grid");

    if (isDefaultValue) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, normalizedValue);
    }

    setSearchParams(nextParams, { replace: true });
  }

  function updateLibraryShelfFilters(shelf: SmartShelf) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("view");
    nextParams.delete("value");
    nextParams.delete("sort");
    filterKeys.forEach((key) => nextParams.delete(key));

    Object.entries(getShelfFilters(shelf)).forEach(([key, values]) => {
      values?.forEach((value) => nextParams.append(key, value));
    });

    const shelfSort = getShelfSort(shelf);
    if (shelfSort) nextParams.set("sort", shelfSort);

    setSearchParams(nextParams, { replace: true });
  }

  function updateLibraryFilter(key: LibraryFilterKey, value: string) {
    const nextParams = new URLSearchParams(searchParams);
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      nextParams.delete(key);
    } else {
      const currentValues = getFilterValues(nextParams, key);
      nextParams.delete(key);
      const nextValues = currentValues.includes(normalizedValue)
        ? currentValues.filter((item) => item !== normalizedValue)
        : [...currentValues, normalizedValue];
      nextValues.forEach((item) => nextParams.append(key, item));
    }

    setSearchParams(nextParams, { replace: true });
  }

  function removeLibraryFilters(keys: LibraryFilterKey[]) {
    const nextParams = new URLSearchParams(searchParams);
    keys.forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams, { replace: true });
  }

  function clearLibraryFilters() {
    const nextParams = new URLSearchParams(searchParams);
    filterKeys.forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams, { replace: true });
  }

  function openManageMode() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mode", "manage");
    setSearchParams(nextParams);
  }

  function closeManageMode() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("mode");
    setSearchParams(nextParams);
    setSelectedBookIds(new Set());
    setBulkError(null);
  }

  function toggleSelectedBook(bookId: string) {
    setSelectedBookIds((current) => {
      const next = new Set(current);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  }

  function toggleAllVisibleBooks(visibleBooksForMode: Book[]) {
    setSelectedBookIds((current) => {
      const visibleIds = visibleBooksForMode.map((book) => book.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((bookId) => current.has(bookId));
      const next = new Set(current);

      visibleIds.forEach((bookId) => {
        if (allSelected) {
          next.delete(bookId);
        } else {
          next.add(bookId);
        }
      });

      return next;
    });
  }

  async function applyBulkUpdate(payloadForBook: (book: Book) => BookUpdate | null) {
    const selectedBooks = managementBooks.filter((book) => selectedBookIds.has(book.id));
    if (selectedBooks.length === 0) return;

    setBulkSaving(true);
    setBulkError(null);

    try {
      for (const book of selectedBooks) {
        const payload = payloadForBook(book);
        if (!payload) continue;
        await updateBook(book.id, payload);
      }
    } catch (bulkUpdateError) {
      const message =
        bulkUpdateError instanceof Error
          ? bulkUpdateError.message
          : "One of the selected books could not be updated.";
      setBulkError(`Bulk update stopped: ${message}`);
    } finally {
      setBulkSaving(false);
    }
  }

  function applyBulkStatus() {
    void applyBulkUpdate(() => ({ status: bulkStatus }));
  }

  function addBulkGenres() {
    const genresToAdd = genreInput;
    if (genresToAdd.length === 0) return;

    void applyBulkUpdate((book) => {
      const existingGenres = book.genre_ids ?? [];
      const nextGenres = Array.from(new Set([...existingGenres, ...genresToAdd]));
      if (nextGenres.length === existingGenres.length) return null;
      return { genre_ids: nextGenres };
    });
  }

  function exportSelectedBooks() {
    const selectedBooks = managementBooks.filter((book) => selectedBookIds.has(book.id));
    if (selectedBooks.length === 0) return;
    downloadBooksCsv(selectedBooks);
  }

  const latestReadTimesByBook = useMemo(
    () => buildLatestReadTimesByBook(readingLogs),
    [readingLogs],
  );

  const activePrimaryShelf = activePrimaryShelfForView(contentView);
  const visibleBooks = useMemo(() => {
    if (!activePrimaryShelf) return [];
    return filterAndSortBooks({
      books: applyLibraryFilters(books.filter(activePrimaryShelf.matches), libraryFilters, series),
      series,
      query: libraryQuery,
      sort: librarySort,
      latestReadTimesByBook,
    });
  }, [activePrimaryShelf, books, latestReadTimesByBook, libraryFilters, libraryQuery, librarySort, series]);

  const continueReadingBooks = useMemo(
    () =>
      readingShelfBooks(
        applyLibraryFilters(books, libraryFilters, series),
        series,
        libraryQuery,
        librarySort,
        latestReadTimesByBook,
      ),
    [books, latestReadTimesByBook, libraryFilters, libraryQuery, librarySort, series],
  );

  const smartShelves = useMemo(
    () => buildSmartShelves(visibleBooks),
    [visibleBooks],
  );

  const filteredBooks = useMemo(() => {
    if (!activeValueShelf || !selectedValue || activeValueShelf === "notes") return [];
    return filterAndSortBooks({
      books: applyLibraryFilters(
        filterBooksByShelfValue({
          shelf: activeValueShelf,
          value: selectedValue,
          books,
          series,
        }),
        libraryFilters,
        series,
      ),
      series,
      query: libraryQuery,
      sort: librarySort,
      latestReadTimesByBook,
    });
  }, [activeValueShelf, books, latestReadTimesByBook, libraryFilters, libraryQuery, librarySort, selectedValue, series]);

  const groupedBooks = useMemo(() => {
    const filterableBooks = filterAndSortBooks({
      books: applyLibraryFilters(books, libraryFilters, series),
      series,
      query: libraryQuery,
      sort: librarySort,
      latestReadTimesByBook,
    });
    if (contentView === "series") return buildSeriesGroups(filterableBooks, series);
    if (contentView === "authors") return buildMultiValueGroups(filterableBooks, (book) => book.authors);
    if (contentView === "genres") return buildMultiValueGroups(filterableBooks, (book) => book.genres);
    if (contentView === "rating") return buildRatingGroups(filterableBooks);
    if (contentView === "languages") return buildSingleValueGroups(filterableBooks, (book) => book.language);
    if (contentView === "format") return buildSingleValueGroups(filterableBooks, (book) => book.format);
    if (contentView === "source") {
      return buildSingleValueGroups(filterableBooks, (book) => book.source);
    }
    return [];
  }, [contentView, books, latestReadTimesByBook, libraryFilters, libraryQuery, librarySort, series]);

  const groupedNotes = useMemo(() => {
    if (isNotesView && selectedValue) {
      return filterNotesByShelfValue({
        value: selectedValue,
        notes,
        books,
      });
    }
    if (!isNotesView) return [];
    return buildNoteGroups(notes, books);
  }, [books, isNotesView, notes, selectedValue]);

  const displayedCountLabel = (() => {
    if (activePrimaryShelf) return itemCountLabel(visibleBooks.length, "book");
    if (selectedValue && activeValueShelf === "notes") {
      return itemCountLabel(groupedNotes.reduce((count, group) => count + group.notes.length, 0), "entry", "entries");
    }
    if (selectedValue) return itemCountLabel(filteredBooks.length, "book");
    if (contentView === "series") return itemCountLabel(groupedBooks.length, "series", "series");
    if (contentView === "authors") return itemCountLabel(groupedBooks.length, "author");
    if (contentView === "genres") return itemCountLabel(groupedBooks.length, "genre");
    if (contentView === "rating") {
      return itemCountLabel(groupedBooks.reduce((count, group) => count + group.books.length, 0), "book");
    }
    if (contentView === "notes") return itemCountLabel(notes.length, "entry", "entries");
    return itemCountLabel(books.length, "book");
  })();
  const hasActiveFilters = activeFilterChips.length > 0;
  const isMyBooksOverview = false;
  const managementBooks = activePrimaryShelf
    ? visibleBooks
    : selectedValue && activeValueShelf && activeValueShelf !== "notes"
      ? filteredBooks
      : groupedBooks.flatMap((group) => group.books);

  useEffect(() => {
    const visibleIds = new Set(managementBooks.map((book) => book.id));
    setSelectedBookIds((current) => {
      const next = new Set(Array.from(current).filter((bookId) => visibleIds.has(bookId)));
      return next.size === current.size ? current : next;
    });
  }, [managementBooks]);
  const controlsBar = (
    <LibraryControlsBar
      sort={librarySort}
      display={libraryDisplay}
      filters={libraryFilters}
      filterOptions={filterOptions}
      activeFilterChips={activeFilterChips}
      onSortChange={(sort) => updateLibraryParam("sort", sort)}
      onDisplayChange={(display) => updateLibraryParam("display", display)}
      onFilterChange={updateLibraryFilter}
      onRemoveFilter={removeLibraryFilters}
      onClearFilters={clearLibraryFilters}
    />
  );

  return (
    <div className="space-y-4">
      {showLibraryToolbar && (
        <LibraryToolbar
          title={pageTitle}
          countLabel={displayedCountLabel}
          loading={loading}
          onManageLibrary={isManageMode ? undefined : openManageMode}
        />
      )}

      {!showLibraryToolbar && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading leading-snug font-medium">
            {pageTitle}
          </h1>
          <span className="text-sm text-muted-foreground">
            {loading ? "..." : displayedCountLabel}
          </span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      {notesError && isNotesView && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">{notesError}</p>
          <Button variant="outline" size="sm" onClick={retryNotes}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      {isMyBooksOverview ? (
        <MyBooksOverview
          books={visibleBooks}
          continueReadingBooks={continueReadingBooks}
          smartShelves={smartShelves}
          display={libraryDisplay}
          loading={loading}
          hasActiveFilters={hasActiveFilters}
          query={libraryQuery}
          countLabel={displayedCountLabel}
          controls={controlsBar}
          onDisplayChange={(display) => updateLibraryParam("display", display)}
          onViewAll={updateLibraryShelfFilters}
          onBook={openBook}
        />
      ) : (
        <>
          {showLibraryToolbar && controlsBar}
          {isManageMode ? (
            <ManagementMode
              books={managementBooks}
              selectedIds={selectedBookIds}
              saving={bulkSaving}
              bulkError={bulkError}
              genreInput={genreInput}
              bulkStatus={bulkStatus}
              onGenreInputChange={setGenreInput}
              onBulkStatusChange={setBulkStatus}
              onToggleBook={toggleSelectedBook}
              onToggleAll={() => toggleAllVisibleBooks(managementBooks)}
              onClose={closeManageMode}
              onExport={exportSelectedBooks}
              onApplyStatus={applyBulkStatus}
              onAddGenres={addBulkGenres}
            />
          ) : (
            <section className="min-w-0">
              {loading ? (
                <LoadingGrid />
              ) : activePrimaryShelf ? (
                visibleBooks.length === 0 ? (
                  <EmptyLibraryView
                    message={libraryResultsEmptyMessage({
                      hasSearch: Boolean(normalizeSearchText(libraryQuery)),
                      hasActiveFilters,
                      fallback: activePrimaryShelf.emptyMessage,
                    })}
                  />
                ) : (
                  <BooksView
                    books={visibleBooks}
                    display={libraryDisplay}
                    onBook={openBook}
                  />
                )
              ) : selectedValue && activeValueShelf && activeValueShelf !== "notes" ? (
                filteredBooks.length === 0 ? (
                  <EmptyLibraryView
                    message={
                      normalizeSearchText(libraryQuery)
                        ? `No books match your search in ${selectedValue}.`
                        : hasActiveFilters
                          ? `No books match your filters in ${selectedValue}.`
                        : `No books found for ${selectedValue}.`
                    }
                  />
                ) : (
                  <BooksView
                    books={filteredBooks}
                    display={libraryDisplay}
                    onBook={openBook}
                  />
                )
              ) : isNotesView ? (
                notesError ? null : <GroupedNotesView groups={groupedNotes} onBook={openBook} />
              ) : (
                <GroupedBooksView groups={groupedBooks} onBook={openBook} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
