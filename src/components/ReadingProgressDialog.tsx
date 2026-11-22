import { lazy, Suspense, useState, type ReactNode } from "react";
import LoadingIndicator from "@/components/LoadingIndicator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { notifyBookFinished } from "@/lib/confetti";
import type { Book } from "@/types";
import "@/components/redesign/redesign.css";

// The panel includes the journal editor; fetch it only when the dialog opens.
const ReadingProgressPanel = lazy(() => import("@/components/ReadingProgressPanel"));

interface ReadingProgressDialogProps {
  book: Book;
  trigger?: ReactNode;
  onProgressSaved: (newCurrentPage: number) => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export default function ReadingProgressDialog({
  book,
  trigger,
  onProgressSaved,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: ReadingProgressDialogProps) {
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

  return (
    <Dialog open={resolvedOpen} onOpenChange={next => { if (!saving) handleOpenChange(next); }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={entryComposerOpen ? "rj-progress-dialog rj-progress-dialog-wide" : "rj-progress-dialog"}
        showCloseButton={!saving}
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogTitle>Update Progress</DialogTitle>
        <DialogDescription className="sr-only">Record the page you reached in {book.title} and, optionally, your reading time.</DialogDescription>
        <Suspense fallback={<LoadingIndicator variant="section" label="Loading progress form…" />}>
          <ReadingProgressPanel
            key={book.id}
            book={book}
            onSavingChange={setSaving}
            onEntryComposerOpenChange={setEntryComposerOpen}
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
