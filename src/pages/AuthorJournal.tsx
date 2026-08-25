import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { NotebookPen } from "lucide-react";
import BackButton from "@/components/BackButton";
import JournalTimeline from "@/components/JournalTimeline";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { authorJournalToJournalEntries, sortJournalEntries } from "@/lib/journal";
import { fetchAuthorJournalEntryRecords, sortAuthorJournalEntryRecords } from "@/lib/authorJournal";
import type { AuthorJournalEntryRecord } from "@/types";

export default function AuthorJournal() {
  const { authorId } = useParams<{ authorId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { authors, loading: authorsLoading } = useAuthorsContext();
  const [journalEntries, setJournalEntries] = useState<AuthorJournalEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const author = authors.find((item) => item.id === authorId) ?? null;
  const selectedEntryId = searchParams.get("entry");

  useEffect(() => {
    if (searchParams.get("new") === "1") setComposerOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!authorId) return;
    let cancelled = false;
    setLoading(true);
    fetchAuthorJournalEntryRecords(authorId)
      .then((data) => {
        if (!cancelled) setJournalEntries(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load author journal");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authorId]);

  const entries = useMemo(
    () => sortJournalEntries(authorJournalToJournalEntries(journalEntries)),
    [journalEntries],
  );

  if (authorsLoading || loading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  if (!author) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Author not found.</div>;
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo={`/authors/${author.id}`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{author.name}</p>
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
        layout="list"
        selectedEntryId={selectedEntryId}
        inlineComposer={{
          open: composerOpen,
          entity: { type: "Author", id: author.id },
          onOpenChange: setComposerOpen,
        }}
        emptyMessage="Author journal entries will appear here."
        onEntryCreated={(entry) => {
          if (entry.source === "author_note") setJournalEntries((current) => sortAuthorJournalEntryRecords([entry.authorJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
        }}
        onEntryUpdated={(entry) => {
          if (entry.source === "author_note") setJournalEntries((current) => sortAuthorJournalEntryRecords([entry.authorJournalEntry, ...current.filter((note) => note.id !== entry.sourceId)]));
        }}
        onEntryDeleted={(entry) => {
          if (entry.source === "author_note") setJournalEntries((current) => current.filter((note) => note.id !== entry.sourceId));
        }}
      />
    </div>
  );
}
