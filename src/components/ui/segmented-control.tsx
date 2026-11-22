import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SlidingIndicator } from "@/components/ui/sliding-indicator";
import { cn } from "@/lib/utils";

export function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  onChange,
  className,
  size = "sm",
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: ReactNode; accessibleLabel?: string }[];
  onChange: (value: Value) => void;
  className?: string;
  size?: "xs" | "sm";
}) {
  return (
    <div role="group" aria-label={label} className={cn("rj-tab-track rj-segmented-control inline-flex flex-wrap rounded-full bg-card", className)}>
      <SlidingIndicator />
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size={size}
          variant="ghost"
          aria-label={option.accessibleLabel}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
