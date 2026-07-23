import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { NotebookPen } from "lucide-react";
import BackButton from "@/components/BackButton";
import JournalTimeline from "@/components/JournalTimeline";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useSeries } from "@/hooks/useSeries";
import { seriesJournalToJournalEntries, sortJournalEntries } from "@/lib/journal";
import { fetchSeriesJournalEntryRecords, sortSeriesJournalEntryRecords } from "@/lib/seriesJournal";
import type { SeriesJournalEntryRecord } from "@/types";

export default function SeriesJournal() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { series, loading: seriesLoading } = useSeries();
  const [journalEntries, setJournalEntries] = useState<SeriesJournalEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const seriesRecord = series.find((item) => item.id === seriesId) ?? null;
  const selectedEntryId = searchParams.get("entry");

  useEffect(() => {
    if (searchParams.get("new") === "1") setComposerOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!seriesId) return;
    let cancelled = false;
    setLoading(true);
    fetchSeriesJournalEntryRecords(seriesId)
      .then((data) => {
        if (!cancelled) setJournalEntries(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load series journal");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const entries = useMemo(
    () => sortJournalEntries(seriesJournalToJournalEntries(journalEntries)),
    [journalEntries],
  );

  if (seriesLoading || loading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  if (!seriesRecord) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Series not found.</div>;
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo={`/series/${seriesRecord.id}`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{seriesRecord.name}</p>
          <h1 className="text-2xl font-heading leading-snug font-medium">Journal</h1>
        </div>
        <Button type="button" size="sm" onClick={() => setComposerOpen(true)} disabled={!user}>
          <NotebookPen className="mr-1.5 h-4 w-4" />
          Add entry
        </Button>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <JournalTimeline
        entries={entries}
        layout="pages"
        selectedEntryId={selectedEntryId}
        inlineComposer={{
          open: composerOpen,
          entity: { type: "Series", id: seriesRecord.id },
          onOpenChange: setComposerOpen,
        }}
        emptyMessage="Series journal entries will appear here."
        onEntryCreated={(entry) => {
          if (entry.source === "series_note") setJournalEntries((current) => sortSeriesJournalEntryRecords([entry.seriesJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
        }}
        onEntryUpdated={(entry) => {
          if (entry.source === "series_note") setJournalEntries((current) => sortSeriesJournalEntryRecords([entry.seriesJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
        }}
        onEntryDeleted={(entry) => {
          if (entry.source === "series_note") setJournalEntries((current) => current.filter((note) => note.id !== entry.sourceId));
        }}
      />
    </div>
  );
}
