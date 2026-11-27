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
import type { Book, ReadingActivityKind } from "@/types";
import "@/components/redesign/redesign.css";

const ReadingProgressPanel = lazy(() => import("@/components/ReadingProgressPanel"));

export type ReadingProgressMode = ReadingActivityKind | "change_date";

interface ReadingProgressDialogProps {
  book: Book;
  trigger?: ReactNode;
  mode?: ReadingProgressMode;
  onProgressSaved?: () => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export default function ReadingProgressDialog({
  book,
  trigger,
  mode = "progress_update",
  onProgressSaved,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: ReadingProgressDialogProps) {
  const navigate = useNavigate();
  const bookDetail = useMatch("/books/:bookId");
  const bookPath = `/books/${encodeURIComponent(book.id)}`;
  const destinationAfterClose = useRef<string | null>(null);
  const finishedAfterClose = useRef<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  function handleOpenChange(nextOpen: boolean) {
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
    destinationAfterClose.current = null;
    const finishedBookId = finishedAfterClose.current;
    finishedAfterClose.current = null;
    // Let the dialog restore focus before opening another dialog or the phone sheet.
    if (destination) queueMicrotask(() => void navigate(destination));
    if (finishedBookId) queueMicrotask(() => notifyBookFinished(finishedBookId));
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={next => { if (!saving) handleOpenChange(next); }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="rj-progress-dialog"
        showCloseButton={!saving}
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DialogTitle>{mode === "session" ? "Log session" : "Update Progress"}</DialogTitle>
        <DialogDescription className="sr-only">
          {mode === "session"
            ? `Record the page you reached and the start and end times for a session with ${book.title}.`
            : `Record the page you reached in ${book.title} and, optionally, your reading time.`}
          {" "}Scroll the wheels, tap a nearby value, or use the arrow keys or number keys.
          {mode === "session" && " Page Up and Page Down move the time by an hour."}
        </DialogDescription>
        <Suspense fallback={<LoadingIndicator variant="section" label="Loading progress form…" />}>
          <ReadingProgressPanel
            key={`${book.id}:${mode}`}
            book={book}
            mode={mode}
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
            onCancel={() => handleOpenChange(false)}
            onProgressSaved={async (log) => {
              const totalPages = book.total_pages ?? 0;
              const finishedBook = totalPages > 0 && log.current_page >= totalPages;

              await onProgressSaved?.();
              if (finishedBook) finishedAfterClose.current = book.id;
              handleOpenChange(false);
            }}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
