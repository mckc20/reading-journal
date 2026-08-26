import { Search, Unlink } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { JournalLinkTarget } from "@/lib/journalLinks";
import { cn } from "@/lib/utils";

interface JournalEntryLinkPickerProps {
  open: boolean;
  targets: JournalLinkTarget[];
  trigger: ReactNode;
  className?: string;
  canRemoveLink?: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoveLink?: () => void;
  onSelect: (target: JournalLinkTarget) => void;
}

function searchableText(target: JournalLinkTarget): string {
  return `${target.label} ${target.description}`.toLocaleLowerCase();
}

export default function JournalEntryLinkPicker({
  open,
  targets,
  trigger,
  className,
  canRemoveLink = false,
  onOpenChange,
  onRemoveLink,
  onSelect,
}: JournalEntryLinkPickerProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const filteredTargets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return targets;
    return targets.filter((target) => searchableText(target).includes(normalizedQuery));
  }, [query, targets]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    window.requestAnimationFrame(() => searchRef.current?.focus());

  }, [open]);

  return (
    <div className={cn("relative", className)}>
      {trigger}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <div className="space-y-1">
            <DialogTitle>Insert journal entry link</DialogTitle>
            <DialogDescription>Choose an entry from your journal.</DialogDescription>
          </div>
          {canRemoveLink && (
            <button
              type="button"
              className="mb-2 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                onRemoveLink?.();
                onOpenChange(false);
              }}
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
              Remove link
            </button>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={searchRef}
              value={query}
              placeholder="Search entries"
              className="h-8 pl-8 text-sm"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {filteredTargets.length > 0 ? (
              filteredTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className="w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onSelect(target)}
                >
                  <span className="block truncate text-sm font-medium">{target.label}</span>
                  {target.description && (
                    <span className="block truncate text-xs text-muted-foreground">{target.description}</span>
                  )}
                </button>
              ))
            ) : (
              <p className="px-2.5 py-3 text-sm text-muted-foreground">No entries found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
