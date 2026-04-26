import { useState, type ReactNode } from "react";
import ReadingProgressPanel from "@/components/ReadingProgressPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const isControlled = typeof open === "boolean";
  const resolvedOpen = isControlled ? open : internalOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (!isControlled) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Update progress</DialogTitle>
        </DialogHeader>
        <ReadingProgressPanel
          book={book}
          defaultExpanded
          hideTrigger
          onCancel={() => handleOpenChange(false)}
          onProgressSaved={async (newPage) => {
            await onProgressSaved(newPage);
            handleOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
