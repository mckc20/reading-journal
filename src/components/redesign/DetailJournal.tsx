import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { useLocation, useOutletContext, useSearchParams } from "react-router-dom";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import JournalTimeline from "@/components/JournalTimeline";
import LoadingIndicator from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { useDetailSectionAnchor } from "@/hooks/useDetailSectionAnchor";
import { sortJournalEntries, type JournalTimelineEntry } from "@/lib/journal";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord, SeriesJournalEntryRecord } from "@/types";

type JournalRecord = AuthorJournalEntryRecord | BookJournalEntryRecord | SeriesJournalEntryRecord;

export function useDetailJournalEntries<Record extends JournalRecord>(
  entityId: string | undefined,
  fetchEntries: (id: string) => Promise<Record[]>,
  toEntries: (records: Record[]) => JournalTimelineEntry[],
) {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchEntries(entityId)
      .then((fetched) => {
        if (cancelled) return;
        // A new entry can be saved while the initial request is in flight.
        setRecords((current) => {
          const knownIds = new Set(current.map((record) => record.id));
          return [...current, ...fetched.filter((record) => !knownIds.has(record.id))];
        });
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load journal entries.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityId, fetchEntries]);

  const entries = useMemo(() => sortJournalEntries(toEntries(records)), [records, toEntries]);
  const save = useCallback((record: Record) => {
    setRecords((current) => {
      const otherRecords = current.filter((entry) => entry.id !== record.id);
      return record.parent_entry_id ? otherRecords : [record, ...otherRecords];
    });
  }, []);
  const remove = useCallback((id: string) => setRecords((current) => current.filter((entry) => entry.id !== id)), []);

  return { entries, loading, error, save, remove };
}

export function useDetailJournalEditor(
  type: "Author" | "Series",
  entityId: string | undefined,
  onSaved: (entry: JournalRecord) => void,
) {
  const { openAddJournalEntry } = useOutletContext<AppLayoutOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const launch = useCallback((trigger?: HTMLElement) => {
    if (entityId) openAddJournalEntry({ entity: { type, id: entityId }, onSaved }, trigger);
  }, [entityId, onSaved, openAddJournalEntry, type]);

  useEffect(() => {
    if (searchParams.get("new") !== "1" || !triggerRef.current || triggerRef.current.closest("[inert]")) return;
    launch(triggerRef.current);
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [launch, searchParams, setSearchParams]);

  return { launch, triggerRef };
}

export function DetailJournal({
  sectionId,
  entries,
  loading,
  error,
  onAdd,
  onEntryUpdated,
  onEntryDeleted,
  addDisabled,
}: {
  sectionId: string;
  entries: JournalTimelineEntry[];
  loading: boolean;
  error: string | null;
  onAdd: (trigger: HTMLButtonElement) => void;
  onEntryUpdated: (entry: JournalTimelineEntry) => void;
  onEntryDeleted: (entry: JournalTimelineEntry) => void;
  addDisabled?: boolean;
}) {
  const [searchParams] = useSearchParams();
  const showAll = useLocation().hash === `#${sectionId}`;
  const selectedEntryId = searchParams.get("entry");
  const sectionRef = useDetailSectionAnchor(sectionId, !selectedEntryId && searchParams.get("new") !== "1");
  const titleId = useId();

  return (
    <section id={sectionId} ref={sectionRef} aria-labelledby={titleId} className="scroll-mt-4">
      <div className="rj-detail-section-heading">
        <h2 id={titleId}>Journal</h2>
      </div>

      {loading ? (
        <LoadingIndicator label="Loading journal entries…" />
      ) : error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : entries.length > 0 ? (
        <JournalTimeline
          entries={entries}
          layout="list"
          initialEntryLimit={showAll ? undefined : 3}
          selectedEntryId={selectedEntryId}
          onEntryCreated={onEntryUpdated}
          onEntryUpdated={onEntryUpdated}
          onEntryDeleted={onEntryDeleted}
        />
      ) : (
        <div className="rj-detail-empty">
          <NotebookPen aria-hidden="true" />
          <p>A place for your thoughts</p>
          <Button type="button" variant="outline" disabled={addDisabled} onClick={(event) => onAdd(event.currentTarget)}>
            Write your first entry
          </Button>
        </div>
      )}
    </section>
  );
}
