import { createContext, useContext, useId, useLayoutEffect, useState, type MutableRefObject, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";

export const HeadingInfoDismissContext = createContext<MutableRefObject<(() => void) | null> | null>(null);

export function HeadingInfo({ children, label = "More information" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const dismiss = useContext(HeadingInfoDismissContext);

  useLayoutEffect(() => {
    if (!open || !dismiss) return;
    const close = () => setOpen(false);
    dismiss.current = close;
    return () => {
      if (dismiss.current === close) dismiss.current = null;
    };
  }, [dismiss, open]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild aria-haspopup={undefined} aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}>
        <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 text-muted-foreground" aria-label={label}>
          <Info aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Content id={id} role="tooltip" sideOffset={4} collisionPadding={16}
        className="z-10 w-60 max-w-[var(--radix-popover-content-available-width)] break-words rounded-md border border-border bg-popover px-3 py-2 text-left font-sans text-sm font-normal not-italic text-popover-foreground shadow-[var(--shadow-popover)]"
        onOpenAutoFocus={event => event.preventDefault()}>
        {children}
        <Popover.Arrow className="fill-popover" />
      </Popover.Content>
    </Popover.Root>
  );
}
