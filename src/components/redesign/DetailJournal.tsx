import { useId } from "react";
import { ChevronRight, NotebookPen } from "lucide-react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import JournalTimeline from "@/components/JournalTimeline";
import LoadingIndicator from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import type { JournalTimelineEntry } from "@/lib/journal";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord, SeriesJournalEntryRecord } from "@/types";

export function DetailJournal({
  entity,
  entries,
  loading,
  error,
  onSaved,
  onEntryUpdated,
  onEntryDeleted,
}: {
  entity: { type: "Author" | "Series"; id: string };
  entries: JournalTimelineEntry[];
  loading: boolean;
  error: string | null;
  onSaved: (entry: AuthorJournalEntryRecord | SeriesJournalEntryRecord | BookJournalEntryRecord) => void;
  onEntryUpdated: (entry: JournalTimelineEntry) => void;
  onEntryDeleted: (entry: JournalTimelineEntry) => void;
}) {
  const { openAddJournalEntry } = useOutletContext<AppLayoutOutletContext>();
  const [searchParams] = useSearchParams();
  const titleId = useId();
  const journalPath = `/${entity.type === "Author" ? "authors" : "series"}/${encodeURIComponent(entity.id)}/journal`;
  const launchEditor = (trigger: HTMLButtonElement) => openAddJournalEntry({ entity, onSaved }, trigger);

  return (
    <section aria-labelledby={titleId}>
      <div className="rj-detail-section-heading">
        <h2 id={titleId}>Journal</h2>
        <div className="flex flex-wrap gap-x-4">
          <Button type="button" variant="link" onClick={(event) => launchEditor(event.currentTarget)}>
            Add entry
          </Button>
          <Button asChild variant="link">
            <Link to={journalPath}>Open journal <ChevronRight aria-hidden="true" /></Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingIndicator label="Loading journal entries…" />
      ) : error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : entries.length > 0 ? (
        <JournalTimeline
          entries={entries}
          layout="list"
          initialEntryLimit={3}
          selectedEntryId={searchParams.get("entry")}
          onEntryCreated={onEntryUpdated}
          onEntryUpdated={onEntryUpdated}
          onEntryDeleted={onEntryDeleted}
        />
      ) : (
        <div className="rj-detail-empty">
          <NotebookPen aria-hidden="true" />
          <p>A place for your thoughts</p>
        </div>
      )}
    </section>
  );
}
