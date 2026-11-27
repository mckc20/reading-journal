import LoadingIndicator from "@/components/LoadingIndicator";
import { useEffect, useMemo, useState } from "react";
import { NotebookPen } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AppHeading } from "@/components/design";
import JournalTimeline from "@/components/JournalTimeline";
import { useBooksContext } from "@/context/BooksContext";
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
  const [searchParams] = useSearchParams();
  const authorId = searchParams.get("author");
  const seriesId = searchParams.get("series");
  const { books, loading: booksLoading } = useBooksContext();
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

  const sortedEntries = useMemo(() => {
    if (authorId) return entries.filter(entry => entry.entityType === "Author" && entry.entityId === authorId);
    if (seriesId) return entries.filter(entry => entry.entityType === "Series" && entry.entityId === seriesId);
    const libraryIds = new Set(books.map((book) => book.id));
    return sortJournalEntries(entries.filter((entry) => entry.entityType !== "Book" || libraryIds.has(entry.entityId)));
  }, [entries, books, authorId, seriesId]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <AppHeading level={1} info={authorId ? "Entries for this author." : seriesId ? "Entries for this series."
          : "All book, series, and author journal entries, newest first."}>Journal</AppHeading>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading || booksLoading ? (
        <LoadingIndicator />
      ) : (
        <JournalTimeline
          entries={sortedEntries}
          layout="list"
          selectedEntryId={searchParams.get("entry")}
          emptyMessage={authorId || seriesId ? "No journal entries yet." : "Journal entries from books, series, and authors will appear here."}
          onEntryCreated={(entry) => setEntries((current) => sortJournalEntries([entry, ...current]))}
          onEntryUpdated={(entry) =>
            setEntries((current) => sortJournalEntries([entry, ...current.filter((item) => item.id !== entry.id)]))
          }
          onEntryDeleted={(entry) => setEntries((current) => current.filter((item) => item.id !== entry.id))}
        />
      )}

      {!loading && !booksLoading && sortedEntries.length === 0 && !error && (
        <div className="sr-only">
          <NotebookPen aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
