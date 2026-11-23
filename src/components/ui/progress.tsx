import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const maximum = Number.isFinite(max) && max > 0 ? max : 100
  const progress = typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(0, value))
    : null

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-2 w-full items-center overflow-hidden rounded-full bg-card ring-1 ring-border/60",
        className
      )}
      value={progress}
      max={maximum}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full rounded-full bg-[var(--rj-blue,var(--accent))] transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${((progress ?? 0) / maximum) * 100}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
