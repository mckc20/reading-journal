import { bookCardInteractiveClassName } from "@/components/BookCardContent";
import { getAuthorInitials } from "@/lib/authorShelf";
import { cn } from "@/lib/utils";
import type { AuthorSummary } from "@/lib/authorShelf";

interface AuthorCardProps {
  author: AuthorSummary;
  onClick: (author: AuthorSummary) => void;
  compact?: boolean;
  interactive?: boolean;
  selected?: boolean;
  onSelect?: (author: AuthorSummary) => void;
}

export default function AuthorCard({ author, onClick, compact = false, interactive = true, selected = false, onSelect }: AuthorCardProps) {
  const handleClick = interactive ? onClick : onSelect;

  return (
    <div
      role={handleClick ? "button" : undefined}
      tabIndex={handleClick ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        "group flex min-w-0 flex-col items-center gap-3 rounded-md py-2 text-center sm:flex-row sm:gap-4 sm:text-left",
        handleClick && bookCardInteractiveClassName,
        selected && "ring-2 ring-primary ring-offset-2",
      )}
      onClick={handleClick ? () => handleClick(author) : undefined}
      onKeyDown={handleClick ? (event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick(author);
        }
      } : undefined}
    >
      <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-medium text-primary-foreground shadow-sm", compact && "h-14 w-14 text-lg")}>
        {author.photo_url ? (
          <img src={author.photo_url} alt={author.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="text-center text-base font-medium leading-none">{getAuthorInitials(author.name)}</span>
        )}
      </div>
      <div className="min-w-0 w-full sm:w-auto">
        <p className={cn("line-clamp-2 break-words font-medium underline-offset-4", compact ? "text-sm" : "text-base", "leading-relaxed", handleClick && "group-hover:underline group-focus-visible:underline")}>{author.name}</p>
        <p className={cn("mt-1 line-clamp-2 break-words text-muted-foreground", compact ? "text-xs" : "text-sm")}>{author.bookCount} {author.bookCount === 1 ? "book" : "books"}</p>
      </div>
    </div>
  );
}
