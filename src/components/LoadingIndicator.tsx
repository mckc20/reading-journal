import { cn } from "@/lib/utils";
import turningPages from "@/assets/loading/turning-pages.webp";
import stillBook from "@/assets/loading/turning-pages-still.webp";

interface LoadingIndicatorProps {
  variant?: "page" | "section" | "inline";
  label?: string;
  className?: string;
  /** Silence secondary indicators when a parent already announces the same wait. */
  announce?: boolean;
}

/** A shared content-loading status. Action buttons keep their own progress indicators. */
export default function LoadingIndicator({
  variant = "section",
  label = "Loading…",
  className,
  announce = true,
}: LoadingIndicatorProps) {
  return (
    <span
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : "off"}
      aria-atomic={announce ? true : undefined}
      className={cn(
        "text-sm text-muted-foreground",
        variant === "inline"
          ? "inline-flex items-center gap-2 align-middle"
          : "flex w-full flex-col items-center justify-center gap-3 text-center",
        variant === "page" && "min-h-80 py-12",
        variant === "section" && "min-h-40 py-6",
        className,
      )}
    >
      <picture
        aria-hidden="true"
        className={cn(
          "block shrink-0",
          variant === "page" && "h-24 w-32",
          variant === "section" && "h-16 w-24",
          variant === "inline" && "h-5 w-7",
        )}
      >
        {/* Converted from the original transparent video; the browser selects a still
            frame for reduced motion, including when that preference changes. */}
        <source media="(prefers-reduced-motion: reduce)" srcSet={stillBook} />
        <img
          src={turningPages}
          alt=""
          width={384}
          height={308}
          decoding="async"
          className="h-full w-full object-contain"
        />
      </picture>
      <span>{label}</span>
    </span>
  );
}
