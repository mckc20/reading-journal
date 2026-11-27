import type { ComponentProps } from "react";
import { X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDialogVisualViewport } from "@/hooks/useDialogVisualViewport";
import { cn } from "@/lib/utils";
import "./book-form-dialog.css";

interface CreationDialogContentProps extends Pick<ComponentProps<typeof DialogContent>, "children" | "className" | "onOpenAutoFocus" | "onCloseAutoFocus"> {
  title: string;
  description: string;
  icon: LucideIcon;
  fitVisualViewport?: boolean;
  closeDisabled?: boolean;
}

export function CreationDialogContent({ title, description, icon: Icon, className, children, onOpenAutoFocus, onCloseAutoFocus, fitVisualViewport = false, closeDisabled }: CreationDialogContentProps) {
  const dialog = useDialogVisualViewport(fitVisualViewport);
  return (
    <DialogContent ref={dialog} data-fit-visual-viewport={fitVisualViewport || undefined}
      className={cn("rj-book-form-dialog rj-creation-dialog", className)} showCloseButton={false} onOpenAutoFocus={onOpenAutoFocus} onCloseAutoFocus={onCloseAutoFocus}>
      <header className="rj-book-form-heading">
        <span className="rj-book-form-icon" aria-hidden="true"><Icon size={24} /></span>
        <div>
          <DialogTitle info={description}>{title}</DialogTitle>
        </div>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon" className="rj-book-form-close" aria-label="Close" disabled={closeDisabled}>
            <X aria-hidden="true" />
          </Button>
        </DialogClose>
      </header>
      {children}
    </DialogContent>
  );
}
