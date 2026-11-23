import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  roundedFill = false,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { roundedFill?: boolean }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-muted ring-1 ring-border/60",
        className
      )}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={roundedFill
          ? "h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          : "size-full flex-1 bg-primary transition-all duration-300"}
        style={roundedFill ? { width: `${value ?? 0}%` } : { transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
