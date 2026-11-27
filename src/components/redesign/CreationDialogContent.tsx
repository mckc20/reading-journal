import type { ComponentProps } from "react";
import { X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import "./book-form-dialog.css";

interface CreationDialogContentProps extends Pick<ComponentProps<typeof DialogContent>, "children" | "className" | "onCloseAutoFocus"> {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function CreationDialogContent({ title, description, icon: Icon, className, children, onCloseAutoFocus }: CreationDialogContentProps) {
  return (
    <DialogContent className={cn("rj-book-form-dialog rj-creation-dialog", className)} showCloseButton={false} onCloseAutoFocus={onCloseAutoFocus}>
      <header className="rj-book-form-heading">
        <span className="rj-book-form-icon" aria-hidden="true"><Icon size={24} /></span>
        <div>
          <DialogTitle info={description}>{title}</DialogTitle>
        </div>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon" className="rj-book-form-close" aria-label="Close">
            <X aria-hidden="true" />
          </Button>
        </DialogClose>
      </header>
      {children}
    </DialogContent>
  );
}
