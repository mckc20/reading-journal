import type { RefObject } from "react";
import LoadingIndicator from "@/components/LoadingIndicator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LoadingDialogProps {
  title: string;
  onOpenChange: (open: boolean) => void;
  stillOpen: RefObject<boolean>;
  returnFocus: RefObject<HTMLElement | null>;
}

/** Holds focus while a requested dialog's code loads, and can be dismissed normally. */
export default function LoadingDialog({ title, onOpenChange, stillOpen, returnFocus }: LoadingDialogProps) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          // On code completion the real dialog takes focus. On dismissal return to the opener.
          event.preventDefault();
          if (!stillOpen.current) returnFocus.current?.focus();
        }}
      >
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <LoadingIndicator label="Loading form…" />
      </DialogContent>
    </Dialog>
  );
}
