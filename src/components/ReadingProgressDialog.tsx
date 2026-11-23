import { lazy, Suspense, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useMatch, useNavigate } from "react-router-dom";
import LoadingIndicator from "@/components/LoadingIndicator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { notifyBookFinished } from "@/lib/confetti";
import type { Book, BookJournalEntryRecord } from "@/types";
import "@/components/redesign/redesign.css";

// The panel includes the journal editor; fetch it only when the dialog opens.
const ReadingProgressPanel = lazy(() => import("@/components/ReadingProgressPanel"));

interface ReadingProgressDialogProps {
  book: Book;
  trigger?: ReactNode;
  onProgressSaved: (newCurrentPage: number) => Promise<void> | void;
  onJournalEntrySaved?: (entry: BookJournalEntryRecord) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export default function ReadingProgressDialog({
  book,
  trigger,
  onProgressSaved,
  onJournalEntrySaved,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: ReadingProgressDialogProps) {
  const navigate = useNavigate();
  const bookDetail = useMatch("/books/:bookId");
  const bookPath = `/books/${encodeURIComponent(book.id)}`;
  const destinationAfterClose = useRef<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [entryComposerOpen, setEntryComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setEntryComposerOpen(false);
    if (!isControlled) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  function handleBookTitleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    destinationAfterClose.current = bookDetail?.params.bookId === book.id ? null : bookPath;
    handleOpenChange(false);
  }

  function handleCloseAutoFocus(event: Event) {
    onCloseAutoFocus?.(event);
    const destination = destinationAfterClose.current;
    if (!destination) return;
    destinationAfterClose.current = null;
    // Let the dialog restore focus before the phone sheet remembers the page behind it.
    queueMicrotask(() => void navigate(destination));
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={next => { if (!saving) handleOpenChange(next); }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={entryComposerOpen ? "rj-progress-dialog rj-progress-dialog-wide" : "rj-progress-dialog"}
        showCloseButton={!saving}
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DialogTitle>Update Progress</DialogTitle>
        <DialogDescription className="sr-only">Record the page you reached in {book.title} and, optionally, your reading time.</DialogDescription>
        <Suspense fallback={<LoadingIndicator variant="section" label="Loading progress form…" />}>
          <ReadingProgressPanel
            key={book.id}
            book={book}
            titleLink={saving ? undefined : (
              <Link
                to={bookPath}
                onClick={handleBookTitleClick}
                className="rounded-sm underline decoration-muted-foreground/45 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {book.title}
              </Link>
            )}
            onSavingChange={setSaving}
            onEntryComposerOpenChange={setEntryComposerOpen}
            onJournalEntrySaved={onJournalEntrySaved}
            onCancel={() => handleOpenChange(false)}
            onProgressSaved={async (newPage) => {
              const totalPages = book.total_pages ?? 0;
              const finishedBook = totalPages > 0 && newPage >= totalPages;

              await onProgressSaved(newPage);
              handleOpenChange(false);

              if (finishedBook) {
                notifyBookFinished(book.id);
              }
            }}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
