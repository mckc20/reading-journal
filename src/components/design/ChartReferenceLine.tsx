import { cn } from "@/lib/utils";

const lineStyle = "border-t border-dashed border-favorite";

export function ChartReferenceLine({ value, max }: { value: number; max: number }) {
  return (
    <div
      aria-hidden="true"
      data-chart-reference-line
      className={cn("pointer-events-none absolute inset-x-0 z-[4]", lineStyle)}
      style={{ top: `${(1 - value / max) * 100}%` }}
    />
  );
}

export function ChartReferenceLegend({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("w-5 shrink-0", lineStyle)} aria-hidden="true" />
      {label}
    </p>
  );
}
