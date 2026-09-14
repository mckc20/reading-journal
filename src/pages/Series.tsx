import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Download, Heart, Trash2, X } from "lucide-react";
import BackButton from "@/components/BackButton";
import OverflowMenu from "@/components/OverflowMenu";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { pruneSelectedIds, runBulkOperation, toggleAllVisibleIds } from "@/lib/bulkManagement";
import { buildSeriesGroups, type SeriesBookGroup } from "@/lib/libraryShelves";
import { getDerivedSeriesStatus } from "@/lib/seriesDetails";
import SeriesStackCard from "@/pages/library/SeriesStackCard";

function downloadSeriesCsv(groups: SeriesBookGroup[]) {
  const rows = [["Name", "Favorite", "Books"], ...groups.map((group) => [group.name, group.isFavorite ? "Yes" : "No", String(group.books.length)])];
  const blob = new Blob([rows.map((row) => row.map((value) => `\"${value.replace(/\"/g, '\"\"')}\"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "series.csv"; link.click(); URL.revokeObjectURL(url);
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
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { series, loading: seriesLoading, error: seriesError, removeSeries } = useSeries();
  const navigate = useNavigate();
  const allGroups = useMemo(() => buildSeriesGroups(books, series, { includeEmpty: true }), [books, series]);
  const loading = booksLoading || seriesLoading;
  const error = booksError || seriesError;
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ongoing" | "completed" | "all">("all");
  const groups = useMemo(
    () => statusFilter === "all" ? allGroups : allGroups.filter((group) => getDerivedSeriesStatus(group.books).toLocaleLowerCase() === statusFilter),
    [allGroups, statusFilter],
  );
  useEffect(() => setSelected((current) => pruneSelectedIds(current, groups.map((group) => group.seriesId))), [groups]);
  const selectedGroups = groups.filter((group) => selected.has(group.seriesId));
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  async function apply(operation: (group: SeriesBookGroup) => Promise<void>, deleting = false) {
    if (!selectedGroups.length) return; setSaving(true);
    const result = await runBulkOperation(selectedGroups, (group) => ({ id: group.seriesId, label: group.name }), operation);
    setSaving(false); if (deleting) setSelected((current) => new Set([...current].filter((id) => !selectedGroups.some((group) => group.seriesId === id && !result.failures.some((failure) => failure.id === id)))));
  }

  function openSeries(seriesId: string) {
    navigate(`/series/${seriesId}`);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-2">
        <BackButton fallbackTo="/library" className="mt-1" />
        <div className="space-y-1">
          <AppHeading level={1} as="h1">Series</AppHeading>
          <HeadingDescription>
            {loading ? "..." : `${groups.length} series`}
          </HeadingDescription>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {managing && selected.size > 0 && <>
            <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => downloadSeriesCsv(selectedGroups)}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
            <Button type="button" size="icon-sm" variant="ghost" className="text-destructive hover:bg-transparent hover:text-destructive" aria-label="Delete selected series" disabled={saving} onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /></Button>
          </>}
          {managing && <>
            <Button type="button" size="sm" variant="ghost" disabled={groups.length === 0 || saving} onClick={() => setSelected((current) => current.size > 0 ? new Set() : toggleAllVisibleIds(current, groups.map((group) => group.seriesId)))}>
              {selected.size > 0 ? "Deselect all" : "Select all"}
            </Button>
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Exit Select mode" disabled={saving} onClick={() => { setManaging(false); setSelected(new Set()); }}><X className="h-4 w-4" /></Button>
          </>}
          <div className="ml-3"><OverflowMenu label="Series options">{(close) => <>
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Filter series</p>
            {(["all", "ongoing", "completed"] as const).map((value) => <button key={value} role="menuitem" type="button" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setStatusFilter(value); close(); }}>{value === "all" ? "All series" : value === "ongoing" ? "Ongoing" : "Completed"}{statusFilter === value ? " ✓" : ""}</button>)}
            <div className="my-1 border-t" />
            <button role="menuitem" type="button" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setManaging((value) => !value); setSelected(new Set()); close(); }}>{managing ? "Done selecting" : "Select"}</button>
          </>}</OverflowMenu></div>
        </div>
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
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>Delete selected series?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This permanently deletes the series. Linked books remain in your library and are detached from the series.</p><DialogFooter><Button variant="destructive" onClick={() => { setDeleteOpen(false); void apply((group) => removeSeries(group.seriesId), true); }}>Delete series</Button><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
