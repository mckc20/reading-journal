import { useId } from "react";
import { useLocation } from "react-router-dom";
import AnnotationCard from "@/components/AnnotationCard";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useDetailSectionAnchor } from "@/hooks/useDetailSectionAnchor";
import { sortBookJournalEntryRecords } from "@/lib/bookJournal";
import type { Book, BookJournalEntryRecord } from "@/types";

export function DetailBookAnnotations({ books, notes, loading = false }: {
  books: Book[];
  notes: BookJournalEntryRecord[];
  loading?: boolean;
}) {
  const titleId = useId();
  const sectionRef = useDetailSectionAnchor("book-annotations");
  const { hash, key } = useLocation();
  const anchored = hash === "#book-annotations";
  const bookNames = new Map(books.map((book) => [book.id, book.title]));
  const annotations = sortBookJournalEntryRecords(notes.filter((note) => bookNames.has(note.book_id)));
  if (!annotations.length && !anchored) return null;

  return (
    <section id="book-annotations" ref={sectionRef} aria-labelledby={titleId} className="scroll-mt-4">
      <details key={anchored ? key : "annotations"} open={anchored || undefined} className="rj-detail-metadata">
        <summary id={titleId}>Book annotations</summary>
        {loading ? <LoadingIndicator label="Loading book annotations…" /> : annotations.length > 0 ? (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {annotations.map((note) => (
              <AnnotationCard key={note.id} note={note} bookId={note.book_id} bookTitle={bookNames.get(note.book_id)} />
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No book annotations yet.</p>}
      </details>
    </section>
  );
}
