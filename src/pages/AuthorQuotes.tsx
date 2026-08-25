import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import AnnotationCard from "@/components/AnnotationCard";
import BackButton from "@/components/BackButton";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { buildAuthorSummaries, findAuthorSummary } from "@/lib/authorShelf";
import { fetchAllBookJournalEntryRecords, sortBookJournalEntryRecords } from "@/lib/bookJournal";
import type { BookJournalEntryRecord, JournalEntryLabel } from "@/types";

const TAB_LABELS: Record<JournalEntryLabel, string> = {
  quote: "Quotes",
  note: "Journal entries",
  review: "Review",
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function AuthorQuotes() {
  const { authorId } = useParams();
  const { authors: authorRecords, loading: authorsLoading, error: authorsError } = useAuthorsContext();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(true);
  const [journalEntriesError, setJournalEntriesError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetchAllBookJournalEntryRecords()
      .then((data) => {
        if (!ignore) setJournalEntries(data);
      })
      .catch((error) => {
        if (!ignore) {
          setJournalEntriesError(error instanceof Error ? error.message : "Failed to load annotations");
        }
      })
      .finally(() => {
        if (!ignore) setJournalEntriesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const authors = useMemo(() => buildAuthorSummaries(authorRecords, books, journalEntries), [authorRecords, books, journalEntries]);
  const author = useMemo(() => findAuthorSummary(authors, authorId), [authors, authorId]);
  const bookTitleById = useMemo(
    () => new Map((author?.books ?? []).map((book) => [book.id, book.title])),
    [author],
  );
  const authorJournal = useMemo(
    () => sortBookJournalEntryRecords(journalEntries.filter((note) => author?.books.some((book) => book.id === note.book_id))),
    [author, journalEntries],
  );
  const journalEntriesByLabel = useMemo(
    () => ({
      quote: authorJournal.filter((note) => note.label === "quote"),
      note: authorJournal.filter((note) => note.label === "note"),
      review: authorJournal.filter((note) => note.label === "review"),
    }),
    [authorJournal],
  );

  if (authorsLoading || booksLoading || journalEntriesLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/50" />
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }

  if (booksError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{booksError}</div>;
  }

  if (authorsError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{authorsError}</div>;
  }

  if (journalEntriesError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{journalEntriesError}</div>;
  }

  if (!author) {
    return (
      <div className="space-y-4">
        <BackButton fallbackTo="/authors" />
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="font-heading text-lg font-medium">Author not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This author was not found in your current library.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo="/authors" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <HeadingDescription>{author.name}</HeadingDescription>
          <AppHeading level={1} as="h1">Annotations</AppHeading>
        </div>
      </div>

      <Tabs defaultValue="quote" className="space-y-4">
        <TabsList variant="line" className="w-full justify-start gap-6 rounded-none border-0 border-b border-border bg-transparent p-0">
          {(Object.keys(TAB_LABELS) as JournalEntryLabel[]).map((label) => (
            <TabsTrigger
              key={label}
              value={label}
              className="h-auto flex-none rounded-none border-0 bg-transparent px-0 pb-2 pt-0 text-sm font-medium text-muted-foreground shadow-none data-active:bg-transparent data-active:text-primary data-active:shadow-none"
            >
              {TAB_LABELS[label]} ({journalEntriesByLabel[label].length})
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(TAB_LABELS) as JournalEntryLabel[]).map((label) => (
          <TabsContent key={label} value={label}>
            {journalEntriesByLabel[label].length === 0 ? (
              <EmptyState message={`No ${TAB_LABELS[label].toLowerCase()} yet.`} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {journalEntriesByLabel[label].map((note) => (
                <AnnotationCard
                  key={note.id}
                  note={note}
                  bookId={note.book_id}
                  bookTitle={bookTitleById.get(note.book_id) ?? null}
                />
              ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
