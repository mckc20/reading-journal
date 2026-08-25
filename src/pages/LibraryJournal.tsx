import { useEffect, useMemo, useState } from "react";
import { NotebookPen } from "lucide-react";
import JournalTimeline from "@/components/JournalTimeline";
import { fetchAllAuthorJournalEntryRecords } from "@/lib/authorJournal";
import { fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import {
  authorJournalToJournalEntries,
  bookJournalToJournalEntries,
  seriesJournalToJournalEntries,
  sortJournalEntries,
} from "@/lib/journal";
import { fetchAllSeriesJournalEntryRecords } from "@/lib/seriesJournal";
import type { JournalTimelineEntry } from "@/lib/journal";

export default function LibraryJournal() {
  const [entries, setEntries] = useState<JournalTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      try {
        setLoading(true);
        setError(null);
        const [bookEntries, seriesEntries, authorEntries] = await Promise.all([
          fetchAllBookJournalEntryRecords(),
          fetchAllSeriesJournalEntryRecords(),
          fetchAllAuthorJournalEntryRecords(),
        ]);

        if (!cancelled) {
          setEntries(
            sortJournalEntries([
              ...bookJournalToJournalEntries(bookEntries),
              ...seriesJournalToJournalEntries(seriesEntries),
              ...authorJournalToJournalEntries(authorEntries),
            ]),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load journal entries");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedEntries = useMemo(() => sortJournalEntries(entries), [entries]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-medium leading-tight">Journal</h1>
        <p className="text-sm text-muted-foreground">All book, series, and author journal entries, newest first.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        <JournalTimeline
          entries={sortedEntries}
          layout="list"
          emptyMessage="Journal entries from books, series, and authors will appear here."
          onEntryCreated={(entry) => setEntries((current) => sortJournalEntries([entry, ...current]))}
          onEntryUpdated={(entry) =>
            setEntries((current) => sortJournalEntries([entry, ...current.filter((item) => item.id !== entry.id)]))
          }
          onEntryDeleted={(entry) => setEntries((current) => current.filter((item) => item.id !== entry.id))}
        />
      )}

      {!loading && sortedEntries.length === 0 && !error && (
        <div className="sr-only">
          <NotebookPen aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
