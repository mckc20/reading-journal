import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BookOpen, MessageSquarePlus, RefreshCw } from "lucide-react";
import AnnotationCard from "@/components/AnnotationCard";
import BackButton from "@/components/BackButton";
import BookNotesPanel from "@/components/BookNotesPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBooksContext } from "@/context/BooksContext";
import { fetchBookNotes } from "@/lib/bookNotes";
import type { BookNote, BookNoteLabel } from "@/types";

const TAB_LABELS: Record<BookNoteLabel, string> = {
  quote: "Quotes",
  note: "Notes",
  review: "Review",
};

export default function BookAnnotations() {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const { books, loading: booksLoading, error: booksError, reload } = useBooksContext();
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(searchParams.get("new") === "1");

  const book = bookId ? books.find((item) => item.id === bookId) ?? null : null;

  useEffect(() => {
    if (!bookId) return;
    const currentBookId = bookId;
    let cancelled = false;

    async function run() {
      try {
        setNotesLoading(true);
        setNotesError(null);
        const data = await fetchBookNotes(currentBookId);
        if (!cancelled) setNotes(data);
      } catch (err) {
        if (!cancelled) {
          setNotesError(err instanceof Error ? err.message : "Failed to load annotations");
        }
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const notesByLabel = useMemo(
    () => ({
      quote: notes.filter((note) => note.label === "quote"),
      note: notes.filter((note) => note.label === "note"),
      review: notes.filter((note) => note.label === "review"),
    }),
    [notes],
  );

  if (booksLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (booksError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">{booksError}</p>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-lg font-heading leading-snug font-medium">Book not found</h1>
        <BackButton fallbackTo="/library" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo="/library" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{book.title}</p>
          <h1 className="text-2xl font-heading leading-snug font-medium">Annotations</h1>
        </div>
        <Button type="button" size="sm" onClick={() => setShowEditor((current) => !current)}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" />
          Add entry
        </Button>
      </div>

      {showEditor && <BookNotesPanel book={book} initialComposerOpen={searchParams.get("new") === "1"} />}

      {notesError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {notesError}
        </div>
      )}

      <Tabs defaultValue="quote" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          {(Object.keys(TAB_LABELS) as BookNoteLabel[]).map((label) => (
            <TabsTrigger key={label} value={label} className="flex-1 sm:flex-none">
              {TAB_LABELS[label]} ({notesByLabel[label].length})
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(TAB_LABELS) as BookNoteLabel[]).map((label) => (
          <TabsContent key={label} value={label}>
            {notesLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-40 animate-pulse rounded-lg bg-muted" />
                <div className="h-40 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : notesByLabel[label].length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                No {TAB_LABELS[label].toLowerCase()} yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {notesByLabel[label].map((note) => (
                  <AnnotationCard key={note.id} note={note} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
