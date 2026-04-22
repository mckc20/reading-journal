import { cn } from "@/lib/utils";

interface GenreTagsProps {
  genres?: string[];
  className?: string;
  tagClassName?: string;
  emptyLabel?: string;
}

export default function GenreTags({
  genres,
  className,
  tagClassName,
  emptyLabel = "No genres",
}: GenreTagsProps) {
  if (!genres || genres.length === 0) {
    if (!emptyLabel) return null;
    return <span className="text-sm text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      {genres.map((genre) => (
        <span
          key={genre}
          className={cn(
            "inline-flex pb-0.5 text-sm font-semibold leading-none text-foreground transition-shadow duration-150",
            "shadow-[inset_0_-1px_0_0_currentColor] hover:shadow-[inset_0_-2px_0_0_currentColor]",
            tagClassName
          )}
        >
          {genre}
        </span>
      ))}
    </div>
  );
}
