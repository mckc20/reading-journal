import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OverflowMenuProps {
  label: string;
  children: (close: () => void) => ReactNode;
  className?: string;
}

/** Shared three-dot menu used by book, author, and series experiences. */
export default function OverflowMenu({ label, children, className }: OverflowMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeWhenOutside = (event: Event) => {
      const target = event.target as Node | null;
      if (target && (buttonRef.current?.contains(target) || menuRef.current?.contains(target))) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", closeWhenOutside);
    window.addEventListener("scroll", closeWhenOutside, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("mousedown", closeWhenOutside); window.removeEventListener("scroll", closeWhenOutside, true); window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  function toggle() {
    if (open) return setOpen(false);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 8, left: Math.max(8, rect.right - 192) });
    setOpen(true);
  }

  return <>
    <Button ref={buttonRef} type="button" size="icon-sm" variant="ghost" aria-label={label} aria-expanded={open} onClick={toggle} className={className}><MoreHorizontal className="h-5 w-5" /></Button>
    {open && position && createPortal(<div ref={menuRef} role="menu" className="fixed z-50 w-48 rounded-lg border bg-popover p-1 shadow-md" style={position}>{children(() => setOpen(false))}</div>, document.body)}
  </>;
}
