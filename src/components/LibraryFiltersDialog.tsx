import { useEffect, useRef, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function LibraryFiltersDialog({ open, onOpenChange, children, id }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  id: string;
}) {
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    // Desktop controls are inline. Release the modal if the viewport grows.
    const closeOnDesktop = () => { if (desktop.matches) onOpenChange(false); };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id={id}
        onOpenAutoFocus={() => {
          trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (trigger.current?.isConnected) {
            event.preventDefault();
            trigger.current.focus({ preventScroll: true });
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Filters and sorting</DialogTitle>
          <DialogDescription>Changes apply to your library immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
