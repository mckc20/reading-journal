import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BulkOperationSummary } from "@/lib/bulkManagement";

interface BulkManagementBarProps {
  itemLabel: string;
  selectedCount: number;
  visibleCount: number;
  saving?: boolean;
  summary?: BulkOperationSummary | null;
  onToggleAll: () => void;
  onClear: () => void;
  onClose: () => void;
  children: ReactNode;
}

export default function BulkManagementBar({
  itemLabel, selectedCount, visibleCount, saving = false, summary, onToggleAll, onClear, onClose, children,
}: BulkManagementBarProps) {
  const allSelected = visibleCount > 0 && selectedCount === visibleCount;
  return (
    <div className="sticky top-2 z-20 space-y-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur dark:bg-card/95">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{selectedCount} selected from {visibleCount} visible {itemLabel}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={visibleCount === 0 || saving} onClick={onToggleAll}>
            {allSelected ? "Deselect all visible" : "Select all visible"}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={selectedCount === 0 || saving} onClick={onClear}>
            <X className="mr-1 h-4 w-4" /> Clear selection
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onClose}>Done selecting</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">{children}</div>
      {summary && (
        <div className={summary.failures.length ? "rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm" : "rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"}>
          <p className="font-medium"><Check className="mr-1 inline h-4 w-4" />{summary.completed} {itemLabel} updated.</p>
          {summary.failures.length > 0 && <p className="mt-1 text-destructive">Failed: {summary.failures.map((failure) => `${failure.label} (${failure.message})`).join(", ")}</p>}
        </div>
      )}
    </div>
  );
}
