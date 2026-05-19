import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Grid2X2,
  Heart,
  List,
  Plus,
  RefreshCw,
  Search,
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
import type { Book, BookNote, Series } from "@/types";

type LibraryView =
  | "all"
  | "tbr"
  | "reading"
  | "finished"
  | "wishlist"
  | "dnf"
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

type LibraryDisplay = "grid" | "table";

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
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
  return display === "table" ? (
    <BooksTable books={books} onBook={onBook} />
  ) : (
    <BooksGrid books={books} onBook={onBook} />
  );
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

function LibraryToolbar({
  title,
  countLabel,
  query,
  sort,
  display,
  activeView,
  filters,
  filterOptions,
  activeFilterChips,
  loading,
  onAddBook,
  onQueryChange,
  onSortChange,
  onDisplayChange,
  onViewChange,
  onFilterChange,
  onRemoveFilter,
  onClearFilters,
}: {
  title: string;
  countLabel: string;
  query: string;
  sort: LibrarySort;
  display: LibraryDisplay;
  activeView?: LibraryView;
  filters: LibraryFilters;
  filterOptions: LibraryFilterOptions;
  activeFilterChips: ActiveFilterChip[];
  loading: boolean;
  onAddBook: () => void;
  onQueryChange: (query: string) => void;
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
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading leading-snug font-medium">{title}</h1>
          <p className="text-sm text-muted-foreground">{loading ? "..." : countLabel}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <div className="relative min-w-0 sm:w-72 lg:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search books..."
              className="pl-8"
            />
          </div>

          <Button type="button" onClick={onAddBook} className="sm:w-auto">
            <Plus className="h-4 w-4" />
            Add Book
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-y py-3 lg:flex-row lg:items-center lg:justify-between">
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
              aria-label="Table view"
              aria-pressed={display === "table"}
              onClick={() => onDisplayChange("table")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
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

function getViewLabel(view: LibraryView) {
  return (
    primaryShelves.find((shelf) => shelf.value === view)?.label ??
    categoryShelves.find((shelf) => shelf.value === view)?.label ??
    "Library"
  );
}

function activePrimaryShelfForView(view: LibraryView) {
  return primaryShelves.find((shelf) => shelf.value === view);
}

type AppLayoutOutletContext = {
  onAddBookClick: () => void;
};

export default function Library() {
  const { books, loading: booksLoading, error, reload } = useBooksContext();
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
  const libraryFilters = useMemo(() => getLibraryFilters(searchParams), [searchParams]);
  const activeFilterChips = useMemo(() => buildActiveFilterChips(libraryFilters), [libraryFilters]);
  const hasExplicitView = isLibraryView(viewParam);
  const activeView = hasExplicitView ? viewParam : undefined;
  const contentView = activeView ?? "all";
  const libraryQuery = queryParam;
  const librarySort: LibrarySort = isLibrarySort(sortParam) ? sortParam : "date-added";
  const libraryDisplay: LibraryDisplay = isLibraryDisplay(displayParam) ? displayParam : "grid";
  const isNotesView = contentView === "notes";
  const activeCategoryShelf = categoryShelves.find((shelf) => shelf.value === contentView);
  const activeValueShelf = activeCategoryShelf?.value;
  const selectedValue = activeValueShelf ? valueParam : undefined;
  const showLibraryToolbar = Boolean(
    !isNotesView && (activePrimaryShelfForView(contentView) || activeValueShelf || activeFilterChips.length)
  );
  const shouldLoadNotes = isNotesView;
  const loading = booksLoading || seriesLoading || (isNotesView && notesLoading);
  const isPrimaryShelfView = Boolean(activePrimaryShelfForView(contentView));
  const pageTitle = isPrimaryShelfView ? "My Books" : selectedValue ?? getViewLabel(contentView);
  const filterOptions = useMemo(() => buildLibraryFilterOptions(books), [books]);

  useEffect(() => {
    if (viewParam && !isLibraryView(viewParam)) {
      navigate("/library", { replace: true });
    }
  }, [navigate, viewParam]);

  useEffect(() => {
    if (displayParam === "compact") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("display");
      setSearchParams(nextParams, { replace: true });
    }
  }, [displayParam, searchParams, setSearchParams]);

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

  return (
    <div className="space-y-4">
      {showLibraryToolbar && (
        <LibraryToolbar
          title={pageTitle}
          countLabel={displayedCountLabel}
          query={libraryQuery}
          sort={librarySort}
          display={libraryDisplay}
          activeView={toolbarStatusView}
          filters={libraryFilters}
          filterOptions={filterOptions}
          activeFilterChips={activeFilterChips}
          loading={loading}
          onAddBook={onAddBookClick}
          onQueryChange={(query) => updateLibraryParam("q", query)}
          onSortChange={(sort) => updateLibraryParam("sort", sort)}
          onDisplayChange={(display) => updateLibraryParam("display", display)}
          onViewChange={updateLibraryView}
          onFilterChange={updateLibraryFilter}
          onRemoveFilter={removeLibraryFilters}
          onClearFilters={clearLibraryFilters}
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

      <section className="min-w-0">
        {loading ? (
          <LoadingGrid />
        ) : activePrimaryShelf ? (
          visibleBooks.length === 0 ? (
            <EmptyLibraryView
              message={
                normalizeSearchText(libraryQuery)
                  ? "No books match your search."
                  : hasActiveFilters
                    ? "No books match your filters."
                  : activePrimaryShelf.emptyMessage
              }
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
    </div>
  );
}
