import { cn } from "@/lib/utils";

interface JournalFilterSwitchProps {
  checked: boolean;
  label: string;
  count: number;
  onCheckedChange: (checked: boolean) => void;
}

export default function JournalFilterSwitch({
  checked,
  label,
  count,
  onCheckedChange,
}: JournalFilterSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
        checked
          ? "border-primary/35 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span>
        {label} ({count})
      </span>
    </button>
  );
}
