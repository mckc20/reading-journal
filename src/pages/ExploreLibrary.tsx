import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Download,
  Grid2X2,
  Heart,
  Plus,
  RefreshCw,
  Rows3,
  Star,
  Table2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { fetchAllBookNotes, formatBookNotePageRange } from "@/lib/bookNotes";
import {
  parseNoteMarkdown,
  type NoteBlockNode,
  type NoteInlineNode,
} from "@/lib/noteFormatting";
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
import CompactBookCard from "@/pages/library/CompactBookCard";
import ContinueReadingCard from "@/pages/library/ContinueReadingCard";
import ShelfCarousel from "@/pages/library/ShelfCarousel";
import type { Book, BookNote, BookStatus, BookUpdate, Series } from "@/types";

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
  | "belongs-to";

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

type LibrarySort = "date-added" | "title" | "author" | "date-finished";

type LibraryDisplay = "grid" | "compact" | "table";

type LibraryFilterKey =
  | "genre"
  | "rating"
  | "year"
  | "format"
  | "language"
  | "belongsTo";

type LibraryFilters = Record<LibraryFilterKey, string>;

type LibraryFilterOptions = Record<LibraryFilterKey, string[]>;

type ActiveFilterChip = {
  keys: LibraryFilterKey[];
  label: string;
};

type SmartShelf = {
  key: "currently-reading" | "want-to-read" | "recently-finished" | "favorites";
  title: string;
  books: Book[];
  view: LibraryView;
  emptyMessage: string;
};

const bookStatuses: BookStatus[] = [
  "Wishlist",
  "Not Started",
  "Up Next",
  "Reading",
  "Finished",
  "DNF",
];

const recentlyFinishedWindowMs = 5 * 7 * 24 * 60 * 60 * 1000;

const filterKeys: LibraryFilterKey[] = [
  "genre",
  "rating",
  "year",
  "format",
  "language",
  "belongsTo",
];

const filterLabels: Record<LibraryFilterKey, string> = {
  genre: "Genre",
  rating: "Rating",
  year: "Year",
  format: "Format",
  language: "Language",
  belongsTo: "Belongs to",
};

const allFilterValue = "__all__";

const validSorts = new Set<LibrarySort>(["date-added", "title", "author", "date-finished"]);
const validDisplays = new Set<LibraryDisplay>(["grid", "compact", "table"]);
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
    matches: (book) => ["Wishlist", "Not Started", "Up Next"].includes(book.status),
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
    value: "wishlist",
    label: "Wishlist",
    matches: (book) => book.status === "Wishlist",
    emptyMessage: "No wishlist books yet.",
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
  { value: "belongs-to", label: "Belongs to" },
];

const statusFilterOptions: Array<Pick<PrimaryShelf, "value" | "label">> = [
  { value: "all", label: "Status" },
  { value: "reading", label: "Currently Reading" },
  { value: "tbr", label: "Want to Read" },
  { value: "finished", label: "Read" },
  { value: "dnf", label: "DNF" },
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
    <div className="grid grid-cols-[repeat(auto-fill,110px)] justify-start gap-3 sm:grid-cols-[repeat(auto-fill,140px)]">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onClick={onBook} textSize="compact" />
      ))}
    </div>
  );
}

function CompactBooksGrid({ books, onBook }: { books: Book[]; onBook: (b: Book) => void }) {
  if (books.length === 0) return null;
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {books.map((book) => (
        <CompactBookCard key={book.id} book={book} onBook={onBook} />
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

function BooksTable({ books, onBook }: { books: Book[]; onBook: (b: Book) => void }) {
  if (books.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border bg-background dark:bg-card">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Book</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Rating</th>
            <th className="px-3 py-2">Progress</th>
            <th className="px-3 py-2">Format</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {books.map((book) => (
            <BookTableRow key={book.id} book={book} onBook={onBook} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookTableRow({ book, onBook }: { book: Book; onBook: (b: Book) => void }) {
  const progress = getBookProgress(book);

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
        <div className="flex min-w-0 items-center gap-3">
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
          <div className="min-w-0">
            <p className="max-w-72 truncate font-medium leading-snug">{book.title}</p>
            <p className="max-w-72 truncate text-xs text-muted-foreground">
              {book.authors.join(", ")}
            </p>
          </div>
        </div>
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
          <Heart className="ml-2 inline h-3.5 w-3.5 fill-rose-500 text-rose-500" aria-label="Favorite" />
        )}
      </td>
      <td className="px-3 py-2">
        <span className="text-muted-foreground">{progress}%</span>
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {book.format ?? book.language ?? "-"}
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
  if (display === "compact") return <CompactBooksGrid books={books} onBook={onBook} />;
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
    "Belongs To",
    "Format",
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
    book.belongs_to ?? "",
    book.format ?? "",
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

function parseGenreInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean),
    ),
  );
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
  genreInput: string;
  bulkStatus: BookStatus;
  onGenreInputChange: (value: string) => void;
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
  const hasGenreInput = parseGenreInput(genreInput).length > 0;

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
                {bookStatuses.map((status) => (
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
            <Input
              value={genreInput}
              onChange={(event) => onGenreInputChange(event.target.value)}
              placeholder="Fantasy, Memoir"
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
        variant={display === "compact" ? "secondary" : "ghost"}
        aria-label="Compact view"
        aria-pressed={display === "compact"}
        onClick={() => onDisplayChange("compact")}
      >
        <Rows3 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant={display === "table" ? "secondary" : "ghost"}
        aria-label="Table view"
        aria-pressed={display === "table"}
        onClick={() => onDisplayChange("table")}
      >
        <Table2 className="h-4 w-4" />
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

function getLibraryFilters(searchParams: URLSearchParams): LibraryFilters {
  return {
    genre: searchParams.get("genre")?.trim() ?? "",
    rating: searchParams.get("rating")?.trim() ?? "",
    year: searchParams.get("year")?.trim() ?? "",
    format: searchParams.get("format")?.trim() ?? "",
    language: searchParams.get("language")?.trim() ?? "",
    belongsTo: searchParams.get("belongsTo")?.trim() ?? "",
  };
}

function hasActiveLibraryFilters(filters: LibraryFilters): boolean {
  return filterKeys.some((key) => Boolean(filters[key]));
}

function buildLibraryFilterOptions(books: Book[]): LibraryFilterOptions {
  const years = new Set<string>();

  books.forEach((book) => {
    const { year } = getBookFilterDateParts(book);
    if (year) years.add(year);
  });

  return {
    genre: uniqueSortedValues(books.flatMap((book) => book.genres ?? [])),
    rating: uniqueSortedValues(books.map((book) => book.rating?.toString())),
    year: Array.from(years).sort((a, b) => Number(b) - Number(a)),
    format: uniqueSortedValues(books.map((book) => book.format)),
    language: uniqueSortedValues(books.map((book) => book.language)),
    belongsTo: uniqueSortedValues(books.map((book) => book.belongs_to)),
  };
}

function bookMatchesLibraryFilters(book: Book, filters: LibraryFilters): boolean {
  if (filters.genre && !(book.genres ?? []).includes(filters.genre)) return false;

  if (filters.rating) {
    const rating = Number.parseInt(filters.rating, 10);
    if (!Number.isFinite(rating) || book.rating !== rating) return false;
  }

  if (filters.format && book.format !== filters.format) return false;
  if (filters.language && book.language !== filters.language) return false;
  if (filters.belongsTo && book.belongs_to !== filters.belongsTo) return false;

  if (filters.year) {
    const { year } = getBookFilterDateParts(book);
    if (filters.year && year !== filters.year) return false;
  }

  return true;
}

function applyLibraryFilters(books: Book[], filters: LibraryFilters): Book[] {
  if (!hasActiveLibraryFilters(filters)) return books;
  return books.filter((book) => bookMatchesLibraryFilters(book, filters));
}

function buildActiveFilterChips(filters: LibraryFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  filterKeys.forEach((key) => {
    const value = filters[key];
    if (!value) return;

    if (key === "year") return;

    chips.push({
      keys: [key],
      label: `${filterLabels[key]}: ${key === "rating" ? `${value}` : value}`,
    });
  });

  if (filters.year) {
    chips.push({
      keys: ["year"],
      label: `Time: ${filters.year}`,
    });
  }

  return chips;
}

function getBookProgress(book: Book): number {
  if (book.status === "Finished") return 100;
  if (["Wishlist", "Not Started", "Up Next"].includes(book.status)) return 0;

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

function sortLibraryBooks(books: Book[], sort: LibrarySort): Book[] {
  return [...books].sort((a, b) => {
    if (sort === "date-added") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    if (sort === "author") {
      const firstAuthorA = a.authors[0] ?? "";
      const firstAuthorB = b.authors[0] ?? "";
      return firstAuthorA.localeCompare(firstAuthorB) || a.title.localeCompare(b.title);
    }

    if (sort === "date-finished") {
      const finishedA = a.date_finished ? new Date(a.date_finished).getTime() : 0;
      const finishedB = b.date_finished ? new Date(b.date_finished).getTime() : 0;
      return finishedB - finishedA || a.title.localeCompare(b.title);
    }

    return a.title.localeCompare(b.title);
  });
}

function filterAndSortBooks({
  books,
  series,
  query,
  sort,
}: {
  books: Book[];
  series: Series[];
  query: string;
  sort: LibrarySort;
}) {
  return sortLibraryBooks(
    books.filter((book) => matchesLibrarySearch(book, series, query)),
    sort
  );
}

function formatNoteDate(value: string): string {
  const dateValue = value.includes("T") ? value : `${value}T00:00:00`;

  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function noteGroupCountLabel(count: number) {
  return `${count} entr${count === 1 ? "y" : "ies"}`;
}

function renderInlineNodes(nodes: NoteInlineNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.type === "text") {
      return node.text.split("\n").map((line, lineIndex) => (
        <span key={`${index}-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {line}
        </span>
      ));
    }

    if (node.type === "bold") {
      return <strong key={index}>{renderInlineNodes(node.children)}</strong>;
    }

    return <em key={index}>{renderInlineNodes(node.children)}</em>;
  });
}

function renderNoteBlock(block: NoteBlockNode, index: number): ReactNode {
  if (block.type === "quote") {
    return (
      <blockquote key={index} className="border-l-2 border-border pl-3 italic">
        {renderInlineNodes(block.children)}
      </blockquote>
    );
  }

  if (block.type === "list") {
    return (
      <ul key={index} className="list-disc space-y-1 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInlineNodes(item)}</li>
        ))}
      </ul>
    );
  }

  return <p key={index}>{renderInlineNodes(block.children)}</p>;
}

function FormattedNoteContent({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const blocks = parseNoteMarkdown(markdown);

  return (
    <div className={cn("space-y-2 whitespace-normal", className)}>
      {blocks.map(renderNoteBlock)}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  formatOption = (option) => option,
  showLabel = true,
  emptyLabel,
  triggerClassName,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  formatOption?: (option: string) => string;
  showLabel?: boolean;
  emptyLabel?: string;
  triggerClassName?: string;
}) {
  return (
    <div className={cn(showLabel && "space-y-1.5")}>
      {showLabel && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Select
        value={value || allFilterValue}
        onValueChange={(nextValue) => onChange(nextValue === allFilterValue ? "" : nextValue)}
      >
        <SelectTrigger aria-label={label} className={cn("w-full", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allFilterValue}>
            {emptyLabel ?? `Any ${label.toLowerCase()}`}
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {formatOption(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AdvancedFilterFields({
  filters,
  filterOptions,
  onFilterChange,
}: {
  filters: LibraryFilters;
  filterOptions: LibraryFilterOptions;
  onFilterChange: (key: LibraryFilterKey, value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FilterSelect
        label="Year"
        value={filters.year}
        options={filterOptions.year}
        onChange={(value) => onFilterChange("year", value)}
      />
      <FilterSelect
        label="Format"
        value={filters.format}
        options={filterOptions.format}
        onChange={(value) => onFilterChange("format", value)}
      />
      <FilterSelect
        label="Language"
        value={filters.language}
        options={filterOptions.language}
        onChange={(value) => onFilterChange("language", value)}
      />
      <FilterSelect
        label="Belongs to"
        value={filters.belongsTo}
        options={filterOptions.belongsTo}
        onChange={(value) => onFilterChange("belongsTo", value)}
      />
    </div>
  );
}

function StatusFilterSelect({
  activeView,
  onViewChange,
}: {
  activeView: LibraryView;
  onViewChange: (view: LibraryView) => void;
}) {
  return (
    <Select value={activeView} onValueChange={(value) => onViewChange(value as LibraryView)}>
      <SelectTrigger aria-label="Status" className="w-[8.75rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusFilterOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LibraryControlsBar({
  sort,
  display,
  activeView,
  filters,
  filterOptions,
  activeFilterChips,
  onSortChange,
  onDisplayChange,
  onViewChange,
  onFilterChange,
  onRemoveFilter,
  onClearFilters,
}: {
  sort: LibrarySort;
  display: LibraryDisplay;
  activeView?: LibraryView;
  filters: LibraryFilters;
  filterOptions: LibraryFilterOptions;
  activeFilterChips: ActiveFilterChip[];
  onSortChange: (sort: LibrarySort) => void;
  onDisplayChange: (display: LibraryDisplay) => void;
  onViewChange: (view: LibraryView) => void;
  onFilterChange: (key: LibraryFilterKey, value: string) => void;
  onRemoveFilter: (keys: LibraryFilterKey[]) => void;
  onClearFilters: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasActiveFilters = activeFilterChips.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-y py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {activeView && (
            <StatusFilterSelect activeView={activeView} onViewChange={onViewChange} />
          )}
          <FilterSelect
            label="Genre"
            value={filters.genre}
            options={filterOptions.genre}
            onChange={(value) => onFilterChange("genre", value)}
            showLabel={false}
            emptyLabel="Genre"
            triggerClassName="w-[8.5rem]"
          />
          <Button
            type="button"
            variant="outline"
            className="w-[8.5rem] justify-between text-muted-foreground"
            disabled
            title="Dedicated tags are planned for a later step."
          >
            Tags
          </Button>
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
            variant={hasActiveFilters ? "secondary" : "outline"}
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
          >
            More filters
            {hasActiveFilters && (
              <span className="ml-0.5 rounded-full bg-background px-1.5 text-xs text-muted-foreground">
                {activeFilterChips.length}
              </span>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Select value={sort} onValueChange={(value) => onSortChange(value as LibrarySort)}>
            <SelectTrigger className="w-[12.5rem] justify-start gap-1.5" aria-label="Sort books">
              <span className="text-muted-foreground">Sort by:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="author">Author</SelectItem>
              <SelectItem value="date-added">Date added</SelectItem>
              <SelectItem value="date-finished">Date finished</SelectItem>
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
            <DialogTitle>More filters</DialogTitle>
          </DialogHeader>
          <AdvancedFilterFields
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={onFilterChange}
          />
          <DialogFooter>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={onClearFilters}>
                Clear filters
              </Button>
            )}
            <Button type="button" onClick={() => setFiltersOpen(false)}>
              Done
            </Button>
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
  onAddBook,
  onManageLibrary,
}: {
  title: string;
  countLabel: string;
  loading: boolean;
  onAddBook: () => void;
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
        <Button type="button" onClick={onAddBook} className="sm:w-auto">
          <Plus className="h-4 w-4" />
          Add Book
        </Button>
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
        <Heart className="h-4 w-4 fill-rose-500 text-rose-500" aria-label="Favorite quote" />
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
        <div className="grid grid-cols-[3rem_1fr] gap-x-4">
          <div className="flex flex-col items-center">
            <div
              aria-hidden="true"
              className="font-serif text-5xl leading-none text-sky-600 dark:text-sky-400"
            >
              “
            </div>
            <div className="-mt-3 w-px flex-1 bg-sky-500 dark:bg-sky-400" />
          </div>
          <div className="min-w-0">
            <FormattedNoteContent
              markdown={note.content}
              className="line-clamp-4 font-serif text-sm italic leading-6 text-foreground"
            />
            {(note.quote_speaker || pageLabel) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {note.quote_speaker && (
                  <span className="font-serif text-sm italic text-muted-foreground">
                    - {note.quote_speaker}
                  </span>
                )}
                {pageLabel && (
                  <span className="text-xs font-medium text-muted-foreground">{pageLabel}</span>
                )}
              </div>
            )}
          </div>
        </div>
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

function readingShelfBooks(books: Book[], series: Series[], query: string, sort: LibrarySort) {
  return filterAndSortBooks({
    books: books.filter((book) => book.status === "Reading"),
    series,
    query,
    sort,
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
  const wantToRead = books.filter((book) =>
    ["Wishlist", "Not Started", "Up Next"].includes(book.status),
  );
  const recentlyFinished = books
    .filter((book) => wasFinishedInRecentWindow(book, now))
    .sort(compareRecentlyFinishedBooks);
  const favorites = books.filter((book) => book.is_favorite);

  return [
    {
      key: "currently-reading",
      title: "Currently Reading",
      books: currentlyReading,
      view: "reading",
      emptyMessage: "Books you are currently reading will appear here.",
    },
    {
      key: "want-to-read",
      title: "Want to Read",
      books: wantToRead,
      view: "tbr",
      emptyMessage: "Wishlist, Not Started, and Up Next books will appear here.",
    },
    {
      key: "recently-finished",
      title: "Recently Finished",
      books: recentlyFinished,
      view: "finished",
      emptyMessage: "Finished books will appear here.",
    },
    {
      key: "favorites",
      title: "Favorites",
      books: favorites,
      view: "favorites",
      emptyMessage: "Tap the heart on a book to collect favorites here.",
    },
  ];
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
  onViewAll: (view: LibraryView) => void;
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

      <LibrarySection title="Your Shelves">
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
                onViewAll={() => onViewAll(shelf.view)}
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
          <BooksView books={books} display={display} onBook={onBook} />
        )}
      </LibrarySection>
    </div>
  );
}

type AppLayoutOutletContext = {
  onAddBookClick: () => void;
};

export default function Library() {
  const { books, loading: booksLoading, error, reload, updateBook } = useBooksContext();
  const { series, loading: seriesLoading } = useSeries();
  const { onAddBookClick } = useOutletContext<AppLayoutOutletContext>();
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
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
  const librarySort: LibrarySort = isLibrarySort(sortParam) ? sortParam : "date-added";
  const libraryDisplay: LibraryDisplay = isLibraryDisplay(displayParam) ? displayParam : "grid";
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
  const filterOptions = useMemo(() => buildLibraryFilterOptions(books), [books]);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<BookStatus>("Reading");
  const [genreInput, setGenreInput] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    if (viewParam && !isLibraryView(viewParam)) {
      navigate("/library/explore", { replace: true });
    }
  }, [navigate, viewParam]);

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
      (key === "sort" && normalizedValue === "date-added") ||
      (key === "display" && normalizedValue === "grid");

    if (isDefaultValue) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, normalizedValue);
    }

    setSearchParams(nextParams, { replace: true });
  }

  function updateLibraryView(view: LibraryView) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", view);
    nextParams.delete("value");
    setSearchParams(nextParams, { replace: true });
  }

  function updateLibraryFilter(key: LibraryFilterKey, value: string) {
    const nextParams = new URLSearchParams(searchParams);
    const normalizedValue = value.trim();

    if (normalizedValue) {
      nextParams.set(key, normalizedValue);
    } else {
      nextParams.delete(key);
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
    const genresToAdd = parseGenreInput(genreInput);
    if (genresToAdd.length === 0) return;

    void applyBulkUpdate((book) => {
      const existingGenres = book.genres ?? [];
      const nextGenres = Array.from(new Set([...existingGenres, ...genresToAdd]));
      if (nextGenres.length === existingGenres.length) return null;
      return { genres: nextGenres };
    });
  }

  function exportSelectedBooks() {
    const selectedBooks = managementBooks.filter((book) => selectedBookIds.has(book.id));
    if (selectedBooks.length === 0) return;
    downloadBooksCsv(selectedBooks);
  }

  const activePrimaryShelf = activePrimaryShelfForView(contentView);
  const visibleBooks = useMemo(() => {
    if (!activePrimaryShelf) return [];
    return filterAndSortBooks({
      books: applyLibraryFilters(books.filter(activePrimaryShelf.matches), libraryFilters),
      series,
      query: libraryQuery,
      sort: librarySort,
    });
  }, [activePrimaryShelf, books, libraryFilters, libraryQuery, librarySort, series]);

  const continueReadingBooks = useMemo(
    () =>
      readingShelfBooks(
        applyLibraryFilters(books, libraryFilters),
        series,
        libraryQuery,
        librarySort,
      ),
    [books, libraryFilters, libraryQuery, librarySort, series],
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
      ),
      series,
      query: libraryQuery,
      sort: librarySort,
    });
  }, [activeValueShelf, books, libraryFilters, libraryQuery, librarySort, selectedValue, series]);

  const groupedBooks = useMemo(() => {
    const filterableBooks = filterAndSortBooks({
      books: applyLibraryFilters(books, libraryFilters),
      series,
      query: libraryQuery,
      sort: librarySort,
    });
    if (contentView === "series") return buildSeriesGroups(filterableBooks, series);
    if (contentView === "authors") return buildMultiValueGroups(filterableBooks, (book) => book.authors);
    if (contentView === "genres") return buildMultiValueGroups(filterableBooks, (book) => book.genres);
    if (contentView === "rating") return buildRatingGroups(filterableBooks);
    if (contentView === "languages") return buildSingleValueGroups(filterableBooks, (book) => book.language);
    if (contentView === "format") return buildSingleValueGroups(filterableBooks, (book) => book.format);
    if (contentView === "belongs-to") {
      return buildSingleValueGroups(filterableBooks, (book) => book.belongs_to);
    }
    return [];
  }, [contentView, books, libraryFilters, libraryQuery, librarySort, series]);

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
  const toolbarStatusView = statusFilterOptions.some((option) => option.value === contentView)
    ? contentView
    : undefined;
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
      activeView={toolbarStatusView}
      filters={libraryFilters}
      filterOptions={filterOptions}
      activeFilterChips={activeFilterChips}
      onSortChange={(sort) => updateLibraryParam("sort", sort)}
      onDisplayChange={(display) => updateLibraryParam("display", display)}
      onViewChange={updateLibraryView}
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
          onAddBook={onAddBookClick}
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
          onViewAll={updateLibraryView}
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
                  <BooksView books={visibleBooks} display={libraryDisplay} onBook={openBook} />
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
                  <BooksView books={filteredBooks} display={libraryDisplay} onBook={openBook} />
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
