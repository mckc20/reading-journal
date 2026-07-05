import { BookOpen, Heart, PauseCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { getTodayLocalDate, statusVariant } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
  showQuickProgress?: boolean;
  textSize?: "default" | "compact";
  cornerLabel?: string;
}

export default function BookCard({
  book,
  onClick,
  showQuickProgress = false,
  textSize = "default",
  cornerLabel,
}: BookCardProps) {
  const { updateBook } = useBooksContext();

  const currentPage = Math.max(0, book.current_page ?? 0);
  const totalPages = Math.max(0, book.total_pages ?? 0);
  const hasTotalPages = totalPages > 0;
  const isPaused = book.status === "Paused";
  const progressPercent = hasTotalPages
    ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)))
    : 0;

  const showDashboardQuickProgress = showQuickProgress && book.status === "Reading";

  const progress =
    book.status === "Reading" && book.current_page && book.total_pages
      ? Math.round((book.current_page / book.total_pages) * 100)
      : null;

  return (
    <Card
      role="button"
      tabIndex={0}
      className="cursor-pointer overflow-hidden pt-0 gap-0 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() => onClick(book)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(book);
        }
      }}
    >
      {/* Cover */}
      <div
        className={cn(
          "relative aspect-[2/3] w-full bg-muted flex-shrink-0",
          isPaused && "opacity-70",
        )}
      >
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            loading="lazy"
            className={cn("h-full w-full object-cover", isPaused && "grayscale")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]">
            <PauseCircle className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {cornerLabel && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">
            {cornerLabel}
          </span>
        )}
        {book.is_favorite && (
          <Heart
            className="absolute right-1.5 top-1.5 h-4 w-4 fill-favorite text-favorite drop-shadow"
            aria-label="Favorite"
          />
        )}
      </div>

      <CardContent className="p-2 space-y-1">
        <p className={textSize === "compact" ? "font-heading text-sm font-medium leading-tight line-clamp-2" : "font-heading text-base font-medium leading-tight line-clamp-2"}>
          {book.title}
        </p>
        <p className={textSize === "compact" ? "text-[11px] text-muted-foreground line-clamp-1" : "text-xs text-muted-foreground line-clamp-1"}>
          {book.authors.join(", ")}
        </p>
        <Badge variant={statusVariant(book.status)} className={textSize === "compact" ? "text-[10px]" : "text-xs"}>
          {book.status}
        </Badge>
        {!showDashboardQuickProgress && progress !== null && (
          <Progress value={progress} className="h-1 mt-1" />
        )}
      </CardContent>

      {showDashboardQuickProgress && (
        <div className="border-t px-2 pb-2 pt-1.5 space-y-1.5">
          <Progress value={progressPercent} className="h-1" />
          <div className="grid grid-cols-[auto_auto] items-center gap-2 sm:grid-cols-[auto_1fr_auto]">
            <p className="text-[11px] text-muted-foreground">{progressPercent}%</p>
            <p className="hidden text-[11px] text-center text-muted-foreground truncate sm:block">
              {currentPage} / {hasTotalPages ? totalPages : "-"}
            </p>
            <ReadingProgressDialog
              book={book}
              onProgressSaved={async (newPage) => {
                const shouldFinish = hasTotalPages && newPage >= totalPages;

                await updateBook(book.id, {
                  current_page: newPage,
                  ...(shouldFinish
                    ? {
                        status: "Finished",
                        ...(book.date_finished ? {} : { date_finished: getTodayLocalDate() }),
                      }
                    : {}),
                });
              }}
              trigger={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  Update Progress
                </Button>
              }
            />
          </div>
        </div>
      )}
    </Card>
  );
}
