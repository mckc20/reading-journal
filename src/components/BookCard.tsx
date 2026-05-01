import { BookOpen, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { statusVariant } from "@/lib/utils";
import type { Book } from "@/types";

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
  showQuickProgress?: boolean;
  textSize?: "default" | "compact";
}

export default function BookCard({
  book,
  onClick,
  showQuickProgress = false,
  textSize = "default",
}: BookCardProps) {
  const { updateBook } = useBooksContext();

  const currentPage = Math.max(0, book.current_page ?? 0);
  const totalPages = Math.max(0, book.total_pages ?? 0);
  const hasTotalPages = totalPages > 0;
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
      className="cursor-pointer overflow-hidden pt-0 gap-0 pb-2 hover:ring-2 hover:ring-primary/40 transition-shadow"
      onClick={() => onClick(book)}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] w-full bg-muted flex-shrink-0">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {book.is_favorite && (
          <Heart
            className="absolute right-1.5 top-1.5 h-4 w-4 fill-rose-500 text-rose-500 drop-shadow"
            aria-label="Favorite"
          />
        )}
      </div>

      <CardContent className="p-2 space-y-1">
        <p className={textSize === "compact" ? "text-xs font-medium leading-tight line-clamp-2" : "text-sm font-medium leading-tight line-clamp-2"}>
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
                await updateBook(book.id, { current_page: newPage });
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
