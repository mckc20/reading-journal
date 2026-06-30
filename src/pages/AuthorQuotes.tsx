import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import AnnotationCard from "@/components/AnnotationCard";
import BackButton from "@/components/BackButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { buildAuthorSummaries, findAuthorSummary } from "@/lib/authorShelf";
import { fetchAllBookNotes, sortBookNotes } from "@/lib/bookNotes";
import type { BookNote, BookNoteLabel } from "@/types";

const TAB_LABELS: Record<BookNoteLabel, string> = {
  quote: "Quotes",
  note: "Notes",
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
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetchAllBookNotes()
      .then((data) => {
        if (!ignore) setNotes(data);
      })
      .catch((error) => {
        if (!ignore) {
          setNotesError(error instanceof Error ? error.message : "Failed to load annotations");
        }
      })
      .finally(() => {
        if (!ignore) setNotesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const authors = useMemo(() => buildAuthorSummaries(authorRecords, books, notes), [authorRecords, books, notes]);
  const author = useMemo(() => findAuthorSummary(authors, authorId), [authors, authorId]);
  const bookTitleById = useMemo(
    () => new Map((author?.books ?? []).map((book) => [book.id, book.title])),
    [author],
  );
  const authorNotes = useMemo(
    () => sortBookNotes(notes.filter((note) => author?.books.some((book) => book.id === note.book_id))),
    [author, notes],
  );
  const notesByLabel = useMemo(
    () => ({
      quote: authorNotes.filter((note) => note.label === "quote"),
      note: authorNotes.filter((note) => note.label === "note"),
      review: authorNotes.filter((note) => note.label === "review"),
    }),
    [authorNotes],
  );

  if (authorsLoading || booksLoading || notesLoading) {
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

  if (notesError) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{notesError}</div>;
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
          <p className="text-sm text-muted-foreground">{author.name}</p>
          <h1 className="text-2xl font-heading leading-snug font-medium">Annotations</h1>
        </div>
      </div>

      <Tabs defaultValue="quote" className="space-y-4">
        <TabsList variant="line" className="w-full justify-start gap-6 rounded-none border-0 border-b border-border bg-transparent p-0">
          {(Object.keys(TAB_LABELS) as BookNoteLabel[]).map((label) => (
            <TabsTrigger
              key={label}
              value={label}
              className="h-auto flex-none rounded-none border-0 bg-transparent px-0 pb-2 pt-0 text-sm font-medium text-muted-foreground shadow-none data-active:bg-transparent data-active:text-primary data-active:shadow-none"
            >
              {TAB_LABELS[label]} ({notesByLabel[label].length})
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(TAB_LABELS) as BookNoteLabel[]).map((label) => (
          <TabsContent key={label} value={label}>
            {notesByLabel[label].length === 0 ? (
              <EmptyState message={`No ${TAB_LABELS[label].toLowerCase()} yet.`} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {notesByLabel[label].map((note) => (
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
