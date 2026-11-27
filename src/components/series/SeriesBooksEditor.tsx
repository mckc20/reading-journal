import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { BookSearchPicker } from "@/components/BookSearchPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sortSeriesBooks } from "@/lib/seriesDetails";
import { ReorderableBookList } from "@/components/ReorderableBookList";
import { formatVolumeNumber, parseVolumeNumberInput } from "@/lib/volumeNumbers";
import type { Book } from "@/types";

export type EditableSeriesBook = {
  book: Book;
  volumeInput: string;
  removed: boolean;
};

export function formatEditableVolume(value?: number | null): string {
  return formatVolumeNumber(value);
}

export function parseVolumeInput(value: string): number | null {
  return parseVolumeNumberInput(value);
}

function stepVolumeInput(value: string, direction: 1 | -1): string {
  const currentValue = parseVolumeInput(value) ?? 1;
  const nextValue = Math.max(0.01, currentValue + direction);
  return formatEditableVolume(nextValue);
}

export function compareEditableSeriesBooks(left: EditableSeriesBook, right: EditableSeriesBook): number {
  const leftVolume = parseVolumeInput(left.volumeInput) ?? Number.MAX_SAFE_INTEGER;
  const rightVolume = parseVolumeInput(right.volumeInput) ?? Number.MAX_SAFE_INTEGER;
  return leftVolume - rightVolume || left.book.title.localeCompare(right.book.title, undefined, { sensitivity: "base", numeric: true });
}

export function getSortedVolumeInputs(rows: EditableSeriesBook[]): string[] {
  return rows
    .map((row, index) => parseVolumeInput(row.volumeInput) ?? index + 1)
    .sort((left, right) => left - right)
    .map(formatEditableVolume);
}

export function buildEditableSeriesBooks(books: Book[]): EditableSeriesBook[] {
  return sortSeriesBooks(books).map((book) => ({
    book,
    volumeInput: formatEditableVolume(book.volume_number),
    removed: false,
  }));
}

function getNextVolumeInput(rows: EditableSeriesBook[]): string {
  const visibleRows = rows.filter((row) => !row.removed);
  const largestVolume = visibleRows.reduce((largest, row) => {
    const volume = parseVolumeInput(row.volumeInput);
    return volume === null ? largest : Math.max(largest, volume);
  }, 0);

  return formatEditableVolume(largestVolume + 1 || visibleRows.length + 1);
}

function SeriesVolumeControl({
  row,
  saving,
  editingVolumeId,
  setEditingVolumeId,
  onVolumeChange,
  onVolumeStep,
}: {
  row: EditableSeriesBook;
  saving: boolean;
  editingVolumeId: string | null;
  setEditingVolumeId: (bookId: string | null) => void;
  onVolumeChange: (bookId: string, value: string) => void;
  onVolumeStep: (bookId: string, direction: 1 | -1) => void;
}) {
  const isEditingVolume = editingVolumeId === row.book.id;
  const volumeLabel = row.volumeInput.trim() || "--";

  return isEditingVolume ? (
    <div className="flex w-24 shrink-0 items-center overflow-hidden rounded-md border bg-background">
      <Input
        autoFocus
        inputMode="decimal"
        value={row.volumeInput}
        disabled={saving}
        aria-label={`Volume number for ${row.book.title}`}
        onChange={(event) => onVolumeChange(row.book.id, event.target.value)}
        onBlur={() => setEditingVolumeId(null)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            setEditingVolumeId(null);
          }
        }}
        className="h-8 border-0 text-sm shadow-none focus-visible:ring-0"
      />
      <div className="grid h-8 w-7 shrink-0 border-l">
        <button
          type="button"
          className="flex items-center justify-center hover:bg-muted"
          disabled={saving}
          aria-label={`Increase volume number for ${row.book.title}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onVolumeStep(row.book.id, 1)}
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          className="flex items-center justify-center border-t hover:bg-muted"
          disabled={saving}
          aria-label={`Decrease volume number for ${row.book.title}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onVolumeStep(row.book.id, -1)}
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      className="h-8 shrink-0 rounded-md px-2 text-left text-sm tabular-nums hover:bg-muted"
      disabled={saving}
      onClick={() => setEditingVolumeId(row.book.id)}
    >
      Vol. {volumeLabel}
    </button>
  );
}

export default function SeriesBooksEditor({
  rows,
  allBooks = [],
  saving,
  emptyLabel,
  removedLabel,
  enableSearch = false,
  createBookLabel = "Create new book",
  onRowsChange,
  onCreateBook,
}: {
  rows: EditableSeriesBook[];
  allBooks?: Book[];
  saving: boolean;
  emptyLabel: string;
  removedLabel?: (count: number) => string;
  enableSearch?: boolean;
  createBookLabel?: string;
  onRowsChange: (rows: EditableSeriesBook[]) => void;
  onCreateBook?: (trigger: HTMLButtonElement) => void;
}) {
  const [search, setSearch] = useState("");
  const [editingVolumeId, setEditingVolumeId] = useState<string | null>(null);
  const visibleRows = useMemo(() => rows.filter((row) => !row.removed).sort(compareEditableSeriesBooks), [rows]);
  const removedCount = rows.length - visibleRows.length;
  const visibleBookIds = useMemo(() => new Set(visibleRows.map((row) => row.book.id)), [visibleRows]);
  const pickerBooks = useMemo(() => allBooks.map(book => ({
    id: book.id,
    title: book.title,
    author: book.authors.join(", "),
    cover: book.cover_url,
    status: book.status,
  })), [allBooks]);

  function changeRows(updater: (currentRows: EditableSeriesBook[]) => EditableSeriesBook[]) {
    onRowsChange(updater(rows));
  }

  function handleAddBook(book: Book) {
    changeRows((currentRows) => {
      const nextVolumeInput = getNextVolumeInput(currentRows);
      if (currentRows.some((row) => row.book.id === book.id)) {
        return currentRows.map((row) =>
          row.book.id === book.id ? { ...row, removed: false, volumeInput: nextVolumeInput } : row,
        );
      }
      return [...currentRows, { book, volumeInput: nextVolumeInput, removed: false }];
    });
  }

  function handleVolumeChange(bookId: string, value: string) {
    changeRows((currentRows) =>
      currentRows.map((row) => (row.book.id === bookId ? { ...row, volumeInput: value } : row)),
    );
  }

  function handleVolumeStep(bookId: string, direction: 1 | -1) {
    changeRows((currentRows) =>
      currentRows.map((row) =>
        row.book.id === bookId
          ? { ...row, volumeInput: stepVolumeInput(row.volumeInput, direction) }
          : row,
      ),
    );
  }

  function handleRemoveBook(bookId: string) {
    changeRows((currentRows) =>
      currentRows.map((row) => (row.book.id === bookId ? { ...row, removed: true } : row)),
    );
  }

  function handleReorder(bookIds: string[]) {
    const volumeInputs = getSortedVolumeInputs(visibleRows);
    const volumeInputsByBook = new Map(bookIds.map((id, index) => [id, volumeInputs[index]]));
    changeRows(currentRows => currentRows.map(row => ({
      ...row,
      volumeInput: volumeInputsByBook.get(row.book.id) ?? row.volumeInput,
    })));
  }

  return (
    <div className="space-y-3">
      {(enableSearch || onCreateBook) && (
        <div className="space-y-2">
          {enableSearch && <BookSearchPicker books={pickerBooks} selected={visibleBookIds} query={search} onQueryChange={setSearch}
            disabled={saving} onToggle={(id, checked) => {
              if (!checked) {
                handleRemoveBook(id);
                return;
              }
              const book = allBooks.find(item => item.id === id);
              if (book) handleAddBook(book);
            }} />}
          {onCreateBook && (
            <Button type="button" variant="outline" disabled={saving} onClick={(event) => onCreateBook(event.currentTarget)}>
              <Plus aria-hidden="true" />
              {createBookLabel}
            </Button>
          )}
        </div>
      )}

      {visibleRows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ReorderableBookList books={visibleRows.map(({ book }) => ({
          id: book.id, title: book.title, author: book.authors.join(", "), cover: book.cover_url,
        }))} disabled={saving} onReorder={handleReorder} onRemove={handleRemoveBook}
          renderDetails={index => <SeriesVolumeControl row={visibleRows[index]} saving={saving}
            editingVolumeId={editingVolumeId} setEditingVolumeId={setEditingVolumeId}
            onVolumeChange={handleVolumeChange} onVolumeStep={handleVolumeStep} />} />
      )}
      {removedCount > 0 && removedLabel && (
        <p className="text-xs text-muted-foreground">{removedLabel(removedCount)}</p>
      )}
    </div>
  );
}
