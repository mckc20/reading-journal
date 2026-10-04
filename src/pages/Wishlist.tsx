import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronRight, Copy, Download, ExternalLink, Loader2, Pencil, SquareMousePointer, Trash2, X } from "lucide-react";
import BackButton from "@/components/BackButton";
import BookCard from "@/components/BookCard";
import OverflowMenu from "@/components/OverflowMenu";
import DuplicateOptionsDialog, { resolveDuplicateOptions, type DuplicateOptions } from "@/components/DuplicateOptionsDialog";
import { selectionLabel } from "@/lib/selectionLabels";
import { useUserSettings } from "@/context";
import { DEFAULT_LIBRARY_SETTINGS } from "@/lib/userSettings";
import { BookCover } from "@/components/reading-journal";
import { PageHeader, EmptyState } from "@/components/reading-journal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { pruneSelectedIds, runBulkOperation, toggleAllVisibleIds } from "@/lib/bulkManagement";
import { acquireWishlistItem, duplicateWishlistItem, removeWishlistItem, wishlistCsv } from "@/lib/wishlist";
import type { Book } from "@/types";
import type { AppLayoutOutletContext } from "@/components/AppLayout";

type WishlistSort = "title" | "date-added";
type WishlistDisplay = "grid" | "table";

function normalizeWishlistSort(value: string | null): WishlistSort {
  return value === "date-added" ? "date-added" : "title";
}

function normalizeWishlistDisplay(value: string | null): WishlistDisplay {
  return value === "table" ? "table" : "grid";
}

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wishlist.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function getWishlistErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = typeof record.message === "string" ? record.message : "";
    const details = typeof record.details === "string" ? record.details : "";
    const hint = typeof record.hint === "string" ? record.hint : "";
    const code = typeof record.code === "string" ? ` (${record.code})` : "";
    return [message, details, hint].filter(Boolean).join(" ") + code || fallback;
  }
  return fallback;
}

function wishlistItemAsBook(item: Book): Book { return item; }

function WishlistCard({
  item,
  book,
  onOpen,
  selectMode = false,
  selected = false,
  onToggle,
}: {
  item: Book;
  book: Book;
  onOpen?: (item: Book) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggle?: (item: Book) => void;
}) {
  return (
    <BookCard
      book={book}
      onClick={selectMode ? undefined : () => onOpen?.(item)}
      onSelect={selectMode ? () => onToggle?.(item) : undefined}
      selected={selectMode && selected}
      textSize="compact"
      footer={<Badge variant="outline" className="text-[10px]">Wishlist</Badge>}
    />
  );
}

function compareBooks(a: Book, b: Book, sort: WishlistSort): number {
  if (sort === "date-added") {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA || a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
  }
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
}

function groupBooks(items: Book[], series: Array<{ id: string; name: string }>, sort: WishlistSort) {
  const names = new Map(series.map((item) => [item.id, item.name]));
  const groups = new Map<string, Book[]>();
  for (const item of items) {
    const key = item.series_id ?? "__uncategorized__";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .map(([seriesId, groupItems]) => ({
      seriesId,
      name: seriesId === "__uncategorized__" ? "Unsorted" : names.get(seriesId) ?? "Series",
      items: [...groupItems].sort((a, b) => compareBooks(a, b, sort)),
    }))
    .sort((a, b) => {
      if (a.seriesId === "__uncategorized__") return b.seriesId === "__uncategorized__" ? 0 : 1;
      if (b.seriesId === "__uncategorized__") return -1;
      if (sort === "date-added") {
        const latestA = Math.max(...a.items.map((item) => new Date(item.created_at).getTime()));
        const latestB = Math.max(...b.items.map((item) => new Date(item.created_at).getTime()));
        return latestB - latestA || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
}

function WishlistTable({
  items,
  managing,
  selectedIds,
  onToggle,
  onOpen,
  bookForItem,
}: {
  items: Book[];
  managing: boolean;
  selectedIds: Set<string>;
  onToggle: (item: Book) => void;
  onOpen: (item: Book) => void;
  bookForItem: (item: Book) => Book;
}) {
  const selectable = items.length > 0;

  return (
    <div className="bg-background">
      <table className="w-full table-fixed text-left text-sm">
        <tbody className="divide-y divide-border/70">
          {items.map((item) => {
            const book = bookForItem(item);
            const isSelecting = managing;
            const isSelected = selectedIds.has(item.id);
            return (
              <tr
                key={item.id}
                tabIndex={0}
                role="button"
                aria-pressed={isSelecting ? isSelected : undefined}
                onClick={() => isSelecting ? onToggle(item) : onOpen(item)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (isSelecting) onToggle(item);
                  else onOpen(item);
                }}
                className={`cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none ${isSelected ? "bg-muted" : ""}`}
              >
                {selectable && managing ? <td className="w-9 py-1.5 pr-2">
                  {isSelecting && <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => onToggle(item)}
                    aria-label={`Select ${item.title}`}
                    className="h-4 w-4 rounded border-border"
                  />}
                </td> : null}
                <td className="w-12 py-2.5 pr-2">
                  <div className="h-10 w-7 shrink-0 overflow-hidden rounded-sm bg-muted">
                    {book.cover_url ? <img src={book.cover_url} alt={book.title} loading="lazy" className="block h-full w-full object-cover object-top" /> : <div className="flex h-full w-full items-center justify-center"><BookOpen className="h-4 w-4 text-muted-foreground/40" /></div>}
                  </div>
                </td>
                <td className="min-w-0 py-2.5">
                  <p className="truncate font-medium leading-snug" style={{ maskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)" }}>{book.title}</p>
                  {book.authors.length > 0 && <p className="mt-0.5 truncate text-xs text-muted-foreground" style={{ maskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)" }}>{book.authors.join(", ")}</p>}
                </td>
                <td className="w-8 py-2.5 pl-2 pr-3"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WishlistCollectionView({
  items,
  display,
  managing,
  selectedIds,
  onToggle,
  onOpen,
  bookForItem,
}: {
  items: Book[];
  display: WishlistDisplay;
  managing: boolean;
  selectedIds: Set<string>;
  onToggle: (item: Book) => void;
  onOpen: (item: Book) => void;
  bookForItem: (item: Book) => Book;
}) {
  if (display === "table") {
    return <WishlistTable items={items} managing={managing} selectedIds={selectedIds} onToggle={onToggle} onOpen={onOpen} bookForItem={bookForItem} />;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(126px,1fr))] sm:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
      {items.map((item) => (
        <WishlistCard key={item.id} item={item} book={bookForItem(item)} onOpen={onOpen} selectMode={managing} selected={selectedIds.has(item.id)} onToggle={onToggle} />
      ))}
    </div>
  );
}

export default function Wishlist() {
  const { settings } = useUserSettings();
  const libraryPreferences = settings?.library ?? DEFAULT_LIBRARY_SETTINGS;
  const { wishlistBooks: items, reload: reloadBooks } = useBooksContext();
  const { series } = useSeries();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Book | null>(null);
  const [groupSeriesBooks, setGroupSeriesBooks] = useState(true);
  const [managing, setManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateItem, setDuplicateItem] = useState<Book | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wishlistSort = normalizeWishlistSort(searchParams.get("sort"));
  const wishlistDisplay = normalizeWishlistDisplay(searchParams.get("display"));

  const load = reloadBooks;
  const pending = items;
  const sortedPending = useMemo(() => [...pending].sort((a, b) => compareBooks(a, b, wishlistSort)), [pending, wishlistSort]);
  const pendingGroups = useMemo(() => groupBooks(sortedPending, series, wishlistSort), [sortedPending, series, wishlistSort]);
  const selectedPending = useMemo(() => pending.filter((item) => selectedIds.has(item.id)), [pending, selectedIds]);
  const selectedDetails = selected && {
    title: selected.title,
    authors: selected.authors,
    cover: selected.cover_url,
    description: selected.description,
    genres: selected.genres ?? [],
    language: selected.language,
    format: selected.format,
    pages: selected.total_pages,
    publicationDate: selected.publication_date,
    isbn: selected.isbn,
    metadataSource: selected.metadata_source,
    metadataSourceUrl: selected.metadata_source_url,
    seriesId: selected.series_id,
    volumeNumber: selected.volume_number,
    price: selected.price,
    purchaseUrl: selected.purchase_url,
  };

  useEffect(() => {
    setSelectedIds((current) => pruneSelectedIds(current, pending.map((item) => item.id)));
  }, [pending]);

  function updateWishlistParam(key: "sort" | "display", value: string) {
    const nextParams = new URLSearchParams(searchParams);
    const isDefault = (key === "sort" && value === "title") || (key === "display" && value === "grid");
    if (isDefault) nextParams.delete(key);
    else nextParams.set(key, value);
    setSearchParams(nextParams, { replace: true });
  }

  function toggleManageMode() {
    if (bulkSaving) return;
    setManaging((current) => !current);
    setSelectedIds(new Set());
    setError(null);
  }

  function toggleSelected(item: Book) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function toggleAllPending() {
    setSelectedIds((current) => toggleAllVisibleIds(current, pending.map((item) => item.id)));
  }

  function exportSelected() {
    if (!selectedPending.length) return;
    download(wishlistCsv(selectedPending));
  }

  function openDuplicateDialog() {
    if (!selectedPending.length) return;
    setDuplicateItem(null);
    const preferences = libraryPreferences;
    const resolved = resolveDuplicateOptions("book", preferences.duplicate_journal_entries, preferences.duplicate_books);
    if (resolved.needsDialog) setDuplicateOpen(true);
    else void duplicateSelected(resolved.options);
  }

  function openItemDuplicateDialog(item: Book) {
    setSelected(null);
    setDuplicateItem(item);
    const resolved = resolveDuplicateOptions("book", libraryPreferences.duplicate_journal_entries, libraryPreferences.duplicate_books);
    if (resolved.needsDialog) setDuplicateOpen(true);
    else void duplicateSingleItem(item, resolved.options);
  }

  async function duplicateSingleItem(item: Book, options: DuplicateOptions) {
    setSaving(item.id);
    setError(null);
    try {
      const copy = await duplicateWishlistItem(item, options);
      await load();
      setDuplicateOpen(false);
      setDuplicateItem(null);
      edit(copy);
    } catch (duplicateError) {
      setDuplicateOpen(false);
      setDuplicateItem(null);
      setSelected(item);
      setError(getWishlistErrorMessage(duplicateError, "Could not duplicate this wish."));
    } finally {
      setSaving(null);
    }
  }

  async function duplicateSelected(options: DuplicateOptions) {
    if (!selectedPending.length) return;
    setBulkSaving(true);
    setError(null);
    const result = await runBulkOperation(
      selectedPending,
      (item) => ({ id: item.id, label: item.title }),
      (item) => duplicateWishlistItem(item, options).then(() => undefined),
    );
    await load();
    setBulkSaving(false);
    setDuplicateOpen(false);
    if (result.failures.length > 0) {
      setError(`Could not duplicate: ${result.failures.map((failure) => failure.label).join(", ")}.`);
      setSelectedIds(new Set(result.failures.map((failure) => failure.id)));
      return;
    }
    setManaging(false);
    setSelectedIds(new Set());
  }

  async function addSelectedToLibrary() {
    if (!selectedPending.length) return;
    setBulkSaving(true);
    setError(null);
    const result = await runBulkOperation(
      selectedPending,
      (item) => ({ id: item.id, label: item.title }),
      (item) => acquireWishlistItem(item.id).then(() => undefined),
    );
    await load();
    setBulkSaving(false);
    if (result.failures.length > 0) {
      setError(`Could not add: ${result.failures.map((failure) => failure.label).join(", ")}.`);
      setSelectedIds(new Set(result.failures.map((failure) => failure.id)));
      return;
    }
    setManaging(false);
    setSelectedIds(new Set());
  }

  async function deleteSelected() {
    if (!selectedPending.length) return;
    setDeleteOpen(false);
    setBulkSaving(true);
    setError(null);
    const result = await runBulkOperation(
      selectedPending,
      (item) => ({ id: item.id, label: item.title }),
      (item) => removeWishlistItem(item),
    );
    await load();
    setBulkSaving(false);
    if (result.failures.length > 0) {
      setError(`Could not delete: ${result.failures.map((failure) => failure.label).join(", ")}.`);
      setSelectedIds(new Set(result.failures.map((failure) => failure.id)));
      return;
    }
    setManaging(false);
    setSelectedIds(new Set());
  }

  async function acquire(item: Book) {
    setSaving(item.id);
    setError(null);
    let bookId: string;
    try {
      bookId = await acquireWishlistItem(item.id);
    } catch (saveError) {
      setError(getWishlistErrorMessage(saveError, "Could not add this book."));
      setSaving(null);
      return;
    }

    try {
      await load();
    } catch (refreshError) {
      setError(`Book added successfully, but the library could not refresh: ${getWishlistErrorMessage(refreshError, "please reload the page.")}`);
    } finally {
      setSelected(null);
      navigate(`/books/${bookId}`);
      setSaving(null);
    }
  }

  async function remove(item: Book) {
    if (!confirm(`Delete “${item.title}” from your wishlist? Any saved journal and reading data will also be deleted.`)) return;
    setSaving(item.id);
    setError(null);
    try {
      await removeWishlistItem(item);
      setSelected(null);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove this wish.");
    } finally {
      setSaving(null);
    }
  }

  function edit(item: Book) {
    setSelected(null);
    openAddBook({
      initialBook: item,
      onWishlistSaved: () => { void load(); },
    });
  }

  function openBook(item: Book) { setSelected(item); }

  return (
    <div className="space-y-6">
      <div className="relative flex items-start gap-1 pr-10">
        <BackButton fallbackTo="/library" className="mt-0.5 shrink-0" />
        <PageHeader title="Wishlist" description="Books you want to read and wish for." />
        <div className="absolute right-0 top-0">
          <OverflowMenu label="Wishlist options">{(close) => <>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => { setGroupSeriesBooks((current) => !current); close(); }}
            >
              <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">{groupSeriesBooks ? "✓" : ""}</span>
              <span>Group series books</span>
            </button>
            <div className="my-1 border-t" />
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Sort by</p>
            {(["title", "date-added"] as const).map((value) => <button
              key={value}
              type="button"
              role="menuitem"
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => { updateWishlistParam("sort", value); close(); }}
            >
              <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">{wishlistSort === value ? "✓" : ""}</span>
              <span>{value === "title" ? "Title A-Z" : "Recently Added"}</span>
            </button>)}
            <div className="my-1 border-t" />
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">View</p>
            {(["grid", "table"] as const).map((value) => <button
              key={value}
              type="button"
              role="menuitem"
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => { updateWishlistParam("display", value); close(); }}
            >
              <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">{wishlistDisplay === value ? "✓" : ""}</span>
              <span>{value === "grid" ? "Grid" : "List"}</span>
            </button>)}
            <div className="my-1 border-t" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => { toggleManageMode(); close(); }}
            >
              <SquareMousePointer className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{managing ? "Done selecting" : "Select"}</span>
            </button>
          </>}</OverflowMenu>
        </div>
      </div>

      {error && <p role="status" className="text-sm text-destructive">{error}</p>}

      {managing && <div className="space-y-1">
        <div className="flex flex-row-reverse flex-wrap items-center justify-start gap-1 sm:gap-2">
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Exit Select mode" disabled={bulkSaving} onClick={toggleManageMode}>
            <X className="h-4 w-4" />
          </Button>
          <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">{selectedIds.size} selected</span>
          <Button type="button" size="sm" variant="ghost" className="px-1.5 sm:px-2.5" disabled={!pending.length || bulkSaving} onClick={toggleAllPending}>
            {selectedIds.size > 0 ? "Deselect all" : "Select all"}
          </Button>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button type="button" size="sm" variant="ghost" className="px-1.5 sm:px-2.5" disabled={!selectedIds.size || bulkSaving} onClick={exportSelected}>
              <Download className="mr-1 h-4 w-4" />Export CSV
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" className="text-destructive hover:bg-transparent hover:text-destructive" aria-label="Delete selected wishlist items" disabled={!selectedIds.size || bulkSaving} onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Duplicate selected wishlist items" title="Duplicate selected wishlist items" disabled={!selectedIds.size || bulkSaving} onClick={openDuplicateDialog}>
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1 sm:gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={!selectedIds.size || bulkSaving} onClick={() => void addSelectedToLibrary()}>
            Add to Library
          </Button>
        </div>
      </div>}

      {!pending.length ? <EmptyState icon={BookOpen} message="No pending wishes yet." /> : (
        <div className={groupSeriesBooks ? "space-y-6" : ""}>
          {groupSeriesBooks ? pendingGroups.map((group, index) => {
            const isUnsorted = group.seriesId === "__uncategorized__";
            return (
              <section key={group.seriesId} className={isUnsorted && index > 0 ? "space-y-3 border-t pt-5" : "space-y-3"}>
                {!isUnsorted && <h3 className="text-sm font-semibold">{group.name}</h3>}
                <WishlistCollectionView
                  items={group.items}
                  display={wishlistDisplay}
                  managing={managing}
                  selectedIds={selectedIds}
                  onToggle={toggleSelected}
                  onOpen={openBook}
                  bookForItem={wishlistItemAsBook}
                />
              </section>
            );
          }) : <WishlistCollectionView
            items={sortedPending}
            display={wishlistDisplay}
            managing={managing}
            selectedIds={selectedIds}
            onToggle={toggleSelected}
            onOpen={openBook}
            bookForItem={wishlistItemAsBook}
          />}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && selectedDetails && <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
          <div className="absolute right-10 top-2">
            <OverflowMenu label="Wishlist item actions" portal={false}>{(close) => <>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => { close(); edit(selected); }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                disabled={saving === selected.id}
                onClick={() => { close(); openItemDuplicateDialog(selected); }}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                disabled={saving === selected.id}
                onClick={() => { close(); void remove(selected); }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>}</OverflowMenu>
          </div>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <BookCover src={selectedDetails.cover} title={selectedDetails.title} className="w-full" />
            <div className="min-w-0 space-y-3">
              <DialogTitle className="pr-8">{selectedDetails.title}</DialogTitle>
              {selectedDetails.authors.length > 0 && <p className="text-sm text-muted-foreground">{selectedDetails.authors.join(", ")}</p>}
              {selectedDetails.description && <p className="max-h-40 overflow-y-auto whitespace-pre-line text-sm">{selectedDetails.description}</p>}
              {selectedDetails.genres.length > 0 && <div className="flex flex-wrap gap-1.5" aria-label="Genres">
                {selectedDetails.genres.map((genre) => <Badge key={genre} variant="outline" className="normal-case tracking-normal">{genre}</Badge>)}
              </div>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
            {selectedDetails.publicationDate && <div><dt className="text-xs text-muted-foreground">Publication date</dt><dd>{formatDate(selectedDetails.publicationDate)}</dd></div>}
            {selectedDetails.pages && <div><dt className="text-xs text-muted-foreground">Pages</dt><dd>{selectedDetails.pages}</dd></div>}
            {selectedDetails.language && <div><dt className="text-xs text-muted-foreground">Language</dt><dd>{selectedDetails.language}</dd></div>}
            {selectedDetails.format && <div><dt className="text-xs text-muted-foreground">Format</dt><dd>{selectedDetails.format}</dd></div>}
            {selectedDetails.seriesId && <div><dt className="text-xs text-muted-foreground">Series</dt><dd>{series.find((entry) => entry.id === selectedDetails.seriesId)?.name ?? "Series"}</dd></div>}
            {selectedDetails.volumeNumber != null && <div><dt className="text-xs text-muted-foreground">Volume</dt><dd>{selectedDetails.volumeNumber}</dd></div>}
            {selectedDetails.price != null && <div><dt className="text-xs text-muted-foreground">Price</dt><dd>{selectedDetails.price}</dd></div>}
            {selectedDetails.isbn && <div><dt className="text-xs text-muted-foreground">ISBN</dt><dd>{selectedDetails.isbn}</dd></div>}
            {selectedDetails.metadataSource && <div><dt className="text-xs text-muted-foreground">Source</dt><dd className="capitalize">{selectedDetails.metadataSource.replace("_", " ")}</dd></div>}
          </dl>

          {selectedDetails.metadataSourceUrl && <a href={selectedDetails.metadataSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
            View catalogue source <ExternalLink className="h-3.5 w-3.5" />
          </a>}
          {selectedDetails.purchaseUrl && <a href={selectedDetails.purchaseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
            Purchase link <ExternalLink className="h-3.5 w-3.5" />
          </a>}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button disabled={saving === selected.id} onClick={() => void acquire(selected)}>
                {saving === selected.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add to Library
              </Button>
          </div>
        </DialogContent>}
      </Dialog>

      <DuplicateOptionsDialog
        open={duplicateOpen}
        kind="book"
        selectedCount={duplicateItem ? undefined : selectedPending.length}
        journalPreference={libraryPreferences.duplicate_journal_entries}
        booksPreference={libraryPreferences.duplicate_books}
        onOpenChange={(open) => {
          setDuplicateOpen(open);
          if (!open && duplicateItem && !saving) {
            setSelected(duplicateItem);
            setDuplicateItem(null);
          }
        }}
        onConfirm={(options) => duplicateItem ? duplicateSingleItem(duplicateItem, options) : duplicateSelected(options)}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {selectionLabel("wish", selectedPending.length)}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This permanently deletes the selected {selectedPending.length === 1 ? "book" : "books"} and any saved journal and reading data.</p>
          <DialogFooter>
            <Button variant="destructive" disabled={bulkSaving} onClick={() => void deleteSelected()}>Delete {selectionLabel("wish", selectedPending.length)}</Button>
            <Button variant="outline" disabled={bulkSaving} onClick={() => setDeleteOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
