import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronRight, Copy, Download, Heart, SquareMousePointer, Trash2, X } from "lucide-react";
import BackButton from "@/components/BackButton";
import DuplicateOptionsDialog, { resolveDuplicateOptions, type DuplicateOptions } from "@/components/DuplicateOptionsDialog";
import DeleteSeriesBooksOption from "@/components/DeleteSeriesBooksOption";
import { selectionLabel } from "@/lib/selectionLabels";
import OverflowMenu from "@/components/OverflowMenu";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth, useUserSettings } from "@/context";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { pruneSelectedIds, runBulkOperation, toggleAllVisibleIds } from "@/lib/bulkManagement";
import { buildSeriesGroups, type SeriesBookGroup } from "@/lib/libraryShelves";
import { getDerivedSeriesStatus } from "@/lib/seriesDetails";
import { duplicateSeriesRecord } from "@/lib/duplication";
import { DEFAULT_LIBRARY_SETTINGS } from "@/lib/userSettings";
import SeriesStackCard from "@/pages/library/SeriesStackCard";

function downloadSeriesCsv(groups: SeriesBookGroup[]) {
  const rows = [["Name", "Favorite", "Books"], ...groups.map((group) => [group.name, group.isFavorite ? "Yes" : "No", String(group.books.length)])];
  const blob = new Blob([rows.map((row) => row.map((value) => `\"${value.replace(/\"/g, '\"\"')}\"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "series.csv"; link.click(); URL.revokeObjectURL(url);
}

function getSeriesAuthors(group: SeriesBookGroup): string[] {
  return [...new Set(group.books.flatMap((book) => book.authors))];
}

function LoadingSeriesGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(122px,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fit,minmax(148px,1fr))] sm:gap-x-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="min-w-0">
          <div className="mx-auto h-[145px] max-w-[148px] animate-pulse rounded-md bg-muted sm:h-[178px]" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-14 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function EmptySeriesCard({
  group,
  onSeries,
  interactive = true,
  selected = false,
}: {
  group: SeriesBookGroup;
  onSeries: (seriesId: string) => void;
  interactive?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={interactive ? () => onSeries(group.seriesId) : undefined}
      className={`group block w-full min-w-0 rounded-xl text-left transition-shadow duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "bg-muted" : ""}`}
    >
      <div className="relative mx-auto h-[145px] w-[122px] sm:h-[178px] sm:w-[148px]">
        <div className="absolute left-0 top-2 flex h-[135px] w-[90px] items-center justify-center overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border transition-colors group-hover:bg-muted/80 sm:h-[168px] sm:w-[112px]">
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          {group.isFavorite && (
            <span className="absolute right-1.5 top-1.5">
              <Heart className="h-4 w-4 fill-favorite text-favorite drop-shadow" aria-hidden="true" />
              <span className="sr-only">Favorite series</span>
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 min-w-0">
        {selected ? (
          <div className="inline-block max-w-full rounded bg-primary px-1.5 py-0.5 text-primary-foreground">
            <p className="line-clamp-2 text-xs font-medium leading-tight">{group.name}</p>
          </div>
        ) : (
          <p className="line-clamp-2 text-xs font-medium leading-tight text-foreground">{group.name}</p>
        )}
      </div>
    </button>
  );
}

export default function Series() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const { books, loading: booksLoading, error: booksError, reload: reloadBooks } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError, removeSeries, reload: reloadSeries } = useSeries();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const display = searchParams.get("display") === "table" ? "table" : "grid";
  const librarySeries = useMemo(() => series.filter((item) => !item.is_wishlist_only), [series]);
  const allGroups = useMemo(() => buildSeriesGroups(books, librarySeries, { includeEmpty: true }), [books, librarySeries]);
  const loading = booksLoading || seriesLoading;
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError || booksError || seriesError;
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLinkedBooks, setDeleteLinkedBooks] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ongoing" | "completed" | "all">("all");
  const groups = useMemo(
    () => statusFilter === "all" ? allGroups : allGroups.filter((group) => getDerivedSeriesStatus(group.books).toLocaleLowerCase() === statusFilter),
    [allGroups, statusFilter],
  );
  useEffect(() => setSelected((current) => pruneSelectedIds(current, groups.map((group) => group.seriesId))), [groups]);
  const selectedGroups = groups.filter((group) => selected.has(group.seriesId));
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  async function deleteSelectedSeries() {
    if (!selectedGroups.length) return;
    setSaving(true);
    setActionError(null);
    try {
      const result = await runBulkOperation(
        selectedGroups,
        (group) => ({ id: group.seriesId, label: group.name }),
        (group) => removeSeries(group.seriesId, deleteLinkedBooks),
      );
      await Promise.all([reloadSeries(), reloadBooks()]);
      setSelected(new Set(result.failures.map((failure) => failure.id)));
      if (result.failures.length) setActionError(`Could not delete: ${result.failures.map((failure) => failure.label).join(", ")}.`);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Could not refresh after deleting series. Please reload.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateSelected(options: DuplicateOptions) {
    if (!user || selectedGroups.length === 0) return;
    setSaving(true);
    const result = await runBulkOperation(
      selectedGroups,
      (group) => ({ id: group.seriesId, label: group.name }),
      (group) => {
        const source = series.find((item) => item.id === group.seriesId);
        if (!source) throw new Error("Series not found");
        return duplicateSeriesRecord(source, group.books, user.id, options).then(() => undefined);
      },
    );
    setSaving(false);
    setDuplicateOpen(false);
    await Promise.all([reloadSeries(), reloadBooks()]);
    if (result.failures.length > 0) {
      // Keep the existing selection so failed items can be retried.
      setSelected((current) => new Set([...current].filter((id) => result.failures.some((failure) => failure.id === id))));
    } else {
      setSelected(new Set());
    }
  }

  function openDuplicateDialog() {
    if (!selectedGroups.length) return;
    const library = settings?.library ?? DEFAULT_LIBRARY_SETTINGS;
    const linkedBookCount = selectedGroups.reduce((count, group) => count + group.books.length, 0);
    const resolved = resolveDuplicateOptions("series", library.duplicate_journal_entries, library.duplicate_books, linkedBookCount);
    if (resolved.needsDialog) {
      setDuplicateOpen(true);
      return;
    }
    void duplicateSelected(resolved.options);
  }

  function openSeries(seriesId: string) {
    navigate(`/series/${seriesId}`);
  }

  return (
    <div className="space-y-8">
      <div className="relative flex flex-wrap items-start gap-2 pr-10">
        <BackButton fallbackTo="/library" className="mt-1" />
        <div className="space-y-1">
          <AppHeading level={1} as="h1">Series</AppHeading>
          <HeadingDescription>
            {loading ? "..." : `${groups.length} series`}
          </HeadingDescription>
        </div>
        <div className="flex w-[calc(100%+2.5rem)] shrink-0 flex-row-reverse flex-wrap items-center justify-start gap-1 sm:gap-2">
          {managing && <>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Exit Select mode" disabled={saving} onClick={() => { setManaging(false); setSelected(new Set()); }}><X className="h-4 w-4" /></Button>
            <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">{selected.size} selected</span>
            <Button type="button" size="sm" variant="ghost" className="px-1.5 sm:px-2.5" disabled={groups.length === 0 || saving} onClick={() => setSelected((current) => current.size > 0 ? new Set() : toggleAllVisibleIds(current, groups.map((group) => group.seriesId)))}>
              {selected.size > 0 ? "Deselect all" : "Select all"}
            </Button>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button type="button" size="sm" variant="ghost" className="px-1.5 sm:px-2.5" disabled={selected.size === 0 || saving} onClick={() => downloadSeriesCsv(selectedGroups)}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
                <Button type="button" size="icon-sm" variant="ghost" className="text-destructive hover:bg-transparent hover:text-destructive" aria-label="Delete selected series" disabled={selected.size === 0 || saving} onClick={() => { setDeleteLinkedBooks(false); setDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Duplicate selected series" title="Duplicate selected series" disabled={selected.size === 0 || saving} onClick={openDuplicateDialog}><Copy className="h-4 w-4" aria-hidden="true" /></Button>
            </div>
          </>}
        </div>
        <div className="absolute right-0 top-0"><OverflowMenu label="Series options">{(close) => <>
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">View</p>
            {(["grid", "table"] as const).map((value) => <button key={value} role="menuitem" type="button" className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => {
              setSearchParams((current) => { const next = new URLSearchParams(current); next.set("display", value); return next; }, { replace: true });
              close();
            }}>
              <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">{display === value ? "✓" : ""}</span>
              <span>{value === "grid" ? "Grid" : "List"}</span>
            </button>)}
            <div className="my-1 border-t" />
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Filter series</p>
            {(["all", "ongoing", "completed"] as const).map((value) => <button key={value} role="menuitem" type="button" className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setStatusFilter(value); close(); }}>
              <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">{statusFilter === value ? "✓" : ""}</span>
              <span>{value === "all" ? "All series" : value === "ongoing" ? "Ongoing" : "Completed"}</span>
            </button>)}
            <div className="my-1 border-t" />
            <button role="menuitem" type="button" className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setManaging((value) => !value); setSelected(new Set()); close(); }}>
              <SquareMousePointer className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{managing ? "Done selecting" : "Select"}</span>
            </button>
        </>}</OverflowMenu></div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : loading ? (
        <LoadingSeriesGrid />
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Series you add will appear here.
          </p>
        </div>
      ) : display === "table" ? (
        <div aria-label="Series collection" className="bg-background">
          <table className="w-full table-fixed text-left text-sm">
            <tbody className="divide-y divide-border/70">
              {groups.map((group) => (
                <tr key={group.seriesId} className={selected.has(group.seriesId) ? "bg-muted/50" : "hover:bg-muted/50"}>
                  {managing && <td className="w-9 py-1.5 pr-2">
                    <input type="checkbox" checked={selected.has(group.seriesId)} disabled={saving} onChange={() => toggle(group.seriesId)} aria-label={`Select ${group.name}`} className="h-4 w-4 rounded border-border" />
                  </td>}
                  <td className="py-2.5">
                    <button type="button" className="flex w-full items-center gap-2 text-left" disabled={managing && saving} onClick={() => managing ? toggle(group.seriesId) : openSeries(group.seriesId)}>
                      <span className="relative h-9 w-10 shrink-0">
                        {group.books.slice(0, 3).map((book, index) => <span key={book.id} className="absolute top-0 h-9 w-6 overflow-hidden rounded-sm border border-background bg-muted" style={{ left: `${index * 7}px`, zIndex: 3 - index }}>{book.cover_url ? <img src={book.cover_url} alt="" className="h-full w-full object-cover" /> : <BookOpen className="m-1 h-4 w-4 text-muted-foreground/50" />}</span>)}
                        {group.books.length === 0 && <span className="flex h-9 w-7 items-center justify-center rounded-sm bg-muted"><BookOpen className="h-4 w-4 text-muted-foreground/50" /></span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium" style={{ maskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)" }}>{group.name}</span>
                        {getSeriesAuthors(group).length > 0 && <span className="mt-0.5 block truncate text-xs text-muted-foreground" style={{ maskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black calc(100% - 1rem), transparent 100%)" }}>{getSeriesAuthors(group).join(", ")}</span>}
                      </span>
                      <ChevronRight className="mr-3 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          aria-label="Series collection"
          className="grid grid-cols-[repeat(auto-fit,minmax(122px,1fr))] gap-x-4 gap-y-7 sm:grid-cols-[repeat(auto-fit,minmax(148px,1fr))] sm:gap-x-6"
        >
          {groups.map((group) => (
            <div key={group.seriesId} className={`relative rounded-lg ${managing ? "cursor-pointer" : ""}`} onClick={managing ? () => toggle(group.seriesId) : undefined} onKeyDown={managing ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(group.seriesId); } } : undefined} role={managing ? "checkbox" : undefined} aria-checked={managing ? selected.has(group.seriesId) : undefined} tabIndex={managing ? 0 : undefined}>
              {group.books.length === 0 ? (
              <EmptySeriesCard key={group.seriesId} group={group} onSeries={openSeries} interactive={!managing} selected={selected.has(group.seriesId)} />
            ) : (
              <SeriesStackCard key={group.seriesId} group={group} onSeries={openSeries} interactive={!managing} selected={selected.has(group.seriesId)} showBookCount={false} />
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {selectionLabel("series", selected.size)}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This permanently deletes the selected series. Choose whether their linked books should be deleted too.</p>
          <DeleteSeriesBooksOption checked={deleteLinkedBooks} onChange={setDeleteLinkedBooks} disabled={saving} />
          <DialogFooter>
            <Button variant="destructive" disabled={saving} onClick={() => { setDeleteOpen(false); void deleteSelectedSeries(); }}>
              Delete {selectionLabel("series", selected.size)}{deleteLinkedBooks ? " and books" : ""}
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => setDeleteOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DuplicateOptionsDialog
        open={duplicateOpen}
        kind="series"
        selectedCount={selected.size}
        linkedBookCount={selectedGroups.reduce((count, group) => count + group.books.length, 0)}
        journalPreference={(settings?.library ?? DEFAULT_LIBRARY_SETTINGS).duplicate_journal_entries}
        booksPreference={(settings?.library ?? DEFAULT_LIBRARY_SETTINGS).duplicate_books}
        onOpenChange={setDuplicateOpen}
        onConfirm={duplicateSelected}
      />
    </div>
  );
}
