import { BookOpen, Heart, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { statusVariant } from "@/lib/utils";
import type { Book } from "@/types";

interface CompactBookCardProps {
  book: Book;
  onBook: (book: Book) => void;
}

function getProgress(book: Book) {
  if (book.status !== "Reading") return null;

  const currentPage = Math.max(0, book.current_page ?? 0);
  const totalPages = Math.max(0, book.total_pages ?? 0);

  if (totalPages <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)));
}

export default function CompactBookCard({ book, onBook }: CompactBookCardProps) {
  const progress = getProgress(book);

  return (
    <button
      type="button"
      onClick={() => onBook(book)}
      className="group flex min-w-0 gap-3 rounded-lg border bg-background p-2 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-card"
    >
      <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md bg-muted">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-200 ease-out group-hover:scale-[1.015]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
        {book.is_favorite && (
          <Heart className="absolute right-1 top-1 h-3.5 w-3.5 fill-rose-500 text-rose-500 drop-shadow" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium leading-tight">{book.title}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{book.authors.join(", ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={statusVariant(book.status)} className="text-[10px]">
            {book.status}
          </Badge>
          {book.rating ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-current" />
              {book.rating}
            </span>
          ) : null}
        </div>
        {progress !== null && <Progress value={progress} className="h-1" />}
      </div>
    </button>
  );
}
