import { Card, CardContent } from "@/components/ui/card";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import { Button } from "@/components/ui/button";
import { BookCover, BookProgress, BookStatus, getBookProgress } from "@/components/reading-journal";
import { useBooksContext } from "@/context/BooksContext";
import { getTodayLocalDate } from "@/lib/utils";
import type { Book } from "@/types";

interface CurrentlyReadingBookCardProps {
  book: Book;
  onBook?: (book: Book) => void;
  onClick?: (book: Book) => void;
  showQuickProgress?: boolean;
  textSize?: "default" | "compact";
  cornerLabel?: string;
}

export default function CurrentlyReadingBookCard({
  book,
  onBook,
  onClick,
  showQuickProgress = false,
  textSize = "default",
  cornerLabel,
}: CurrentlyReadingBookCardProps) {
  const { updateBook } = useBooksContext();
  const handleBook = onBook ?? onClick;

  const currentPage = Math.max(0, book.current_page ?? 0);
  const totalPages = Math.max(0, book.total_pages ?? 0);
  const hasTotalPages = totalPages > 0;
  const isPaused = book.status === "Paused";
  const progressPercent = getBookProgress(currentPage, totalPages) ?? 0;

  const showDashboardQuickProgress = showQuickProgress && book.status === "Reading";

  const progress = book.status === "Reading" ? getBookProgress(book.current_page, book.total_pages) : null;

  return (
    <Card
      role="button"
      tabIndex={0}
      variant="interactive"
      className="group gap-0 overflow-hidden pb-2 pt-0"
      onClick={() => handleBook?.(book)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleBook?.(book);
        }
      }}
    >
      <BookCover
        src={book.cover_url}
        title={book.title}
        paused={isPaused}
        favorite={book.is_favorite}
        cornerLabel={cornerLabel}
        className="w-full rounded-none"
      />

      <CardContent className="space-y-1 p-2">
        <p
          className={
            textSize === "compact"
              ? "line-clamp-2 font-heading text-sm font-medium leading-tight"
              : "line-clamp-2 font-heading text-base font-medium leading-tight"
          }
        >
          {book.title}
        </p>
        <p
          className={
            textSize === "compact"
              ? "line-clamp-1 text-[11px] text-muted-foreground"
              : "line-clamp-1 text-xs text-muted-foreground"
          }
        >
          {book.authors.join(", ")}
        </p>
        <BookStatus status={book.status} className={textSize === "compact" ? "text-[10px]" : "text-xs"} />
        {!showDashboardQuickProgress && progress !== null && <BookProgress currentPage={book.current_page} totalPages={book.total_pages} className="mt-1" />}
      </CardContent>

      {showDashboardQuickProgress && (
        <div className="space-y-1.5 border-t px-2 pb-2 pt-1.5">
          <BookProgress currentPage={currentPage} totalPages={totalPages} />
          <div className="grid grid-cols-[auto_auto] items-center gap-2 sm:grid-cols-[auto_1fr_auto]">
            <p className="text-[11px] text-muted-foreground">{progressPercent}%</p>
            <p className="hidden truncate text-center text-[11px] text-muted-foreground sm:block">
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
