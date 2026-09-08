import { BookOpen, Heart, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type BookCoverSize = "sm" | "md" | "lg" | "fill";

const sizeClasses: Record<BookCoverSize, string> = {
  sm: "w-14",
  md: "w-24",
  lg: "w-32",
  fill: "w-full",
};

interface BookCoverProps {
  src?: string | null;
  title: string;
  size?: BookCoverSize;
  paused?: boolean;
  favorite?: boolean;
  cornerLabel?: string;
  className?: string;
  imageClassName?: string;
}

/** The shared visual treatment for every book-cover image and fallback. */
export function BookCover({
  src,
  title,
  size = "fill",
  paused = false,
  favorite = false,
  cornerLabel,
  className,
  imageClassName,
}: BookCoverProps) {
  return (
    <div
      className={cn(
        "relative aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm",
        sizeClasses[size],
        paused && "opacity-70",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          className={cn(
            "block h-full w-full object-cover object-top transition-transform duration-200 ease-out group-hover:scale-[1.02]",
            paused && "grayscale",
            imageClassName,
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center" aria-label={`No cover for ${title}`}>
          <BookOpen className="h-1/3 w-1/3 min-h-5 min-w-5 text-muted-foreground/40" aria-hidden="true" />
        </div>
      )}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]">
          <PauseCircle className="h-1/3 w-1/3 min-h-5 min-w-5 text-muted-foreground" aria-label="Paused" />
        </div>
      )}
      {favorite && (
        <Heart
          className="absolute right-1.5 top-1.5 h-4 w-4 fill-favorite text-favorite drop-shadow"
          aria-label="Favorite"
        />
      )}
      {cornerLabel && (
        <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">
          {cornerLabel}
        </span>
      )}
    </div>
  );
}

export type { BookCoverProps, BookCoverSize };
