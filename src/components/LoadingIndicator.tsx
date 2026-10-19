import { cn } from "@/lib/utils";

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
      <svg
        viewBox="0 0 100 72"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={cn(
          "loading-book shrink-0 text-primary",
          variant === "page" && "h-24 w-32",
          variant === "section" && "h-16 w-24",
          variant === "inline" && "h-5 w-7",
        )}
      >
        <path d="M50 22C39 14 23 13 8 17V59C24 55 39 57 50 64C61 57 76 55 92 59V17C77 13 61 14 50 22Z" fill="var(--muted)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M50 19C39 11 24 10 12 13V53C26 51 39 54 50 60C61 54 74 51 88 53V13C76 10 61 11 50 19Z" fill="var(--background)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M50 20V60M20 23C29 23 37 25 43 28M20 32C29 32 37 34 43 37M20 41C29 41 37 43 43 46M57 28C63 25 71 23 80 23M57 37C63 34 71 32 80 32M57 46C63 43 71 41 80 41" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" />
        <g className="loading-book-page">
          <path d="M50 19C61 11 76 10 88 13V53C74 51 61 54 50 60Z" fill="var(--background)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M58 27C65 24 72 23 80 23M58 36C65 33 72 32 80 32M58 45C65 42 72 41 80 41" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
      <span>{label}</span>
    </span>
  );
}
