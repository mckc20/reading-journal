import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignJustify, ChevronDown, ChevronUp, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sortSeriesBooks } from "@/lib/seriesDetails";
import { cn } from "@/lib/utils";
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

function matchesBookSearch(book: Book, searchTerm: string): boolean {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return false;
  return [book.title, ...book.authors].some((value) => value.toLowerCase().includes(normalized));
}

function SortableSeriesBookRow({
  row,
  saving,
  editingVolumeId,
  setEditingVolumeId,
  onVolumeChange,
  onVolumeStep,
  onRemove,
}: {
  row: EditableSeriesBook;
  saving: boolean;
  editingVolumeId: string | null;
  setEditingVolumeId: (bookId: string | null) => void;
  onVolumeChange: (bookId: string, value: string) => void;
  onVolumeStep: (bookId: string, direction: 1 | -1) => void;
  onRemove: (bookId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.book.id, disabled: saving });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const isEditingVolume = editingVolumeId === row.book.id;
  const volumeLabel = row.volumeInput.trim() || "--";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[2rem_2rem_minmax(0,1fr)_7rem] items-center gap-2 rounded-lg border bg-card p-2 shadow-sm transition-shadow",
        isDragging && "relative z-10 shadow-lg",
      )}
    >
      <button
        type="button"
        className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label={`Reorder ${row.book.title}`}
        disabled={saving}
        {...attributes}
        {...listeners}
      >
        <AlignJustify className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
        aria-label={`Remove ${row.book.title} from this series`}
        disabled={saving}
        onClick={() => onRemove(row.book.id)}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{row.book.title}</p>
        <p className="truncate text-xs text-muted-foreground">{row.book.authors.join(", ") || "Unknown author"}</p>
      </div>
      {isEditingVolume ? (
        <div className="flex items-center overflow-hidden rounded-md border bg-background">
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
          className="h-8 rounded-md px-2 text-left text-sm tabular-nums hover:bg-muted"
          disabled={saving}
          onClick={() => setEditingVolumeId(row.book.id)}
        >
          Vol. {volumeLabel}
        </button>
      )}
    </div>
  );
}

export default function SeriesBooksEditor({
  rows,
  allBooks = [],
  saving,
  emptyLabel,
  removedLabel,
  searchPlaceholder = "Search books",
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
  searchPlaceholder?: string;
  enableSearch?: boolean;
  createBookLabel?: string;
  onRowsChange: (rows: EditableSeriesBook[]) => void;
  onCreateBook?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editingVolumeId, setEditingVolumeId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visibleRows = useMemo(() => rows.filter((row) => !row.removed).sort(compareEditableSeriesBooks), [rows]);
  const removedCount = rows.length - visibleRows.length;
  const visibleBookIds = useMemo(() => new Set(visibleRows.map((row) => row.book.id)), [visibleRows]);
  const searchResults = useMemo(() => {
    if (!enableSearch || !search.trim()) return [];
    return allBooks
      .filter((book) => !visibleBookIds.has(book.id) && matchesBookSearch(book, search))
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base", numeric: true }))
      .slice(0, 6);
  }, [allBooks, enableSearch, search, visibleBookIds]);

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
    setSearch("");
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    changeRows((currentRows) => {
      const currentVisibleRows = currentRows.filter((row) => !row.removed).sort(compareEditableSeriesBooks);
      const oldIndex = currentVisibleRows.findIndex((row) => row.book.id === active.id);
      const newIndex = currentVisibleRows.findIndex((row) => row.book.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return currentRows;

      const reorderedVisibleRows = arrayMove(currentVisibleRows, oldIndex, newIndex);
      const volumeInputsByPosition = getSortedVolumeInputs(currentVisibleRows);
      const volumeInputByBookId = new Map(
        reorderedVisibleRows.map((row, index) => [row.book.id, volumeInputsByPosition[index]]),
      );

      return currentRows.map((row) =>
        volumeInputByBookId.has(row.book.id)
          ? { ...row, volumeInput: volumeInputByBookId.get(row.book.id) ?? row.volumeInput }
          : row,
      );
    });
  }

  return (
    <div className="space-y-3">
      {(enableSearch || onCreateBook) && (
        <div className="space-y-2">
          {enableSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                disabled={saving}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
              />
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border bg-popover p-1 shadow-sm">
              {searchResults.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
                  disabled={saving}
                  onClick={() => handleAddBook(book)}
                >
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{book.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {book.authors.join(", ") || "Unknown author"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {onCreateBook && (
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onCreateBook}>
              <Plus className="h-4 w-4" />
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleRows.map((row) => row.book.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {visibleRows.map((row) => (
                <SortableSeriesBookRow
                  key={row.book.id}
                  row={row}
                  saving={saving}
                  editingVolumeId={editingVolumeId}
                  setEditingVolumeId={setEditingVolumeId}
                  onVolumeChange={handleVolumeChange}
                  onVolumeStep={handleVolumeStep}
                  onRemove={handleRemoveBook}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {removedCount > 0 && removedLabel && (
        <p className="text-xs text-muted-foreground">{removedLabel(removedCount)}</p>
      )}
    </div>
  );
}
