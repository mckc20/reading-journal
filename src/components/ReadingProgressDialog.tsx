import { useState, type ReactNode } from "react";
import ReadingProgressPanel from "@/components/ReadingProgressPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { notifyBookFinished } from "@/lib/confetti";
import type { Book } from "@/types";

interface ReadingProgressDialogProps {
  book: Book;
  trigger: ReactNode;
  onProgressSaved: (newCurrentPage: number) => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ReadingProgressDialog({
  book,
  trigger,
  onProgressSaved,
  open,
  onOpenChange,
}: ReadingProgressDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [entryComposerOpen, setEntryComposerOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setEntryComposerOpen(false);
    if (!isControlled) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={entryComposerOpen ? "sm:max-w-2xl" : "sm:max-w-md"}
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Update progress</DialogTitle>
        </DialogHeader>
        <ReadingProgressPanel
          book={book}
          defaultExpanded
          hideTrigger
          onEntryComposerOpenChange={setEntryComposerOpen}
          onCancel={() => handleOpenChange(false)}
          onProgressSaved={async (newPage) => {
            const totalPages = book.total_pages ?? 0;
            const finishedBook = totalPages > 0 && newPage >= totalPages;

            await onProgressSaved(newPage);
            handleOpenChange(false);

            if (finishedBook) {
              notifyBookFinished();
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
