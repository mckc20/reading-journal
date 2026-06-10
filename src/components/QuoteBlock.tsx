import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface QuoteBlockProps {
  children: ReactNode;
  attribution?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  attributionClassName?: string;
  markClassName?: string;
}

export default function QuoteBlock({
  children,
  attribution,
  actions,
  className,
  contentClassName,
  attributionClassName,
  markClassName,
}: QuoteBlockProps) {
  return (
    <figure className={cn("grid grid-cols-[2.25rem_1fr] gap-x-3", className)}>
      <div aria-hidden="true" className="flex justify-center">
        <span
          className={cn(
            "font-serif text-4xl font-semibold leading-none text-primary",
            markClassName,
          )}
        >
          “
        </span>
      </div>
      <div className="min-w-0">
        <blockquote
          className={cn(
            "font-heading text-base italic leading-7 text-foreground",
            contentClassName,
          )}
        >
          {children}
        </blockquote>
        {(attribution || actions) && (
          <figcaption
            className={cn(
              "mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground",
              attributionClassName,
            )}
          >
            <div className="min-w-0">{attribution}</div>
            {actions}
          </figcaption>
        )}
      </div>
    </figure>
  );
}
