import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BookProgressProps {
  currentPage?: number | null;
  totalPages?: number | null;
  showLabel?: boolean;
  className?: string;
  barClassName?: string;
}

export function getBookProgress(currentPage?: number | null, totalPages?: number | null): number | null {
  const total = Math.max(0, totalPages ?? 0);
  if (total === 0) return null;
  return Math.min(100, Math.max(0, Math.round((Math.max(0, currentPage ?? 0) / total) * 100)));
}

/** A safe, consistent reading-progress indicator. */
export function BookProgress({ currentPage, totalPages, showLabel = false, className, barClassName }: BookProgressProps) {
  const value = getBookProgress(currentPage, totalPages);
  if (value === null) return null;

  return (
    <div className={cn("space-y-1", className)}>
      <Progress value={value} className={cn("h-1", barClassName)} />
      {showLabel && <p className="text-xs text-muted-foreground">{value}% · {Math.max(0, currentPage ?? 0)} / {totalPages}</p>}
    </div>
  );
}

export type { BookProgressProps };
