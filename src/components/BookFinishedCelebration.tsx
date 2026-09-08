import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { BOOK_FINISHED_EVENT, launchBookFinishedConfetti } from "@/lib/confetti";

export default function BookFinishedCelebration() {
  const [open, setOpen] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const { books, updateBook } = useBooksContext();
  const navigate = useNavigate();
  const book = bookId ? books.find((item) => item.id === bookId) ?? null : null;

  useEffect(() => {
    function handleBookFinished(event: Event) {
      const finishedEvent = event as CustomEvent<{ bookId?: string }>;
      setBookId(finishedEvent.detail?.bookId ?? null);
      setRatingError(null);
      setOpen(true);
      launchBookFinishedConfetti();
    }

    window.addEventListener(BOOK_FINISHED_EVENT, handleBookFinished);
    return () => {
      window.removeEventListener(BOOK_FINISHED_EVENT, handleBookFinished);
    };
  }, []);

  async function setRating(rating: number) {
    if (!bookId) return;

    try {
      setSavingRating(true);
      setRatingError(null);
      await updateBook(bookId, { rating });
    } catch (error) {
      setRatingError(error instanceof Error ? error.message : "Could not save your rating.");
    } finally {
      setSavingRating(false);
    }
  }

  function addReview() {
    if (!bookId) return;
    setOpen(false);
    navigate(`/books/${bookId}/journal?new=1&tag=review`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Yeah! You've finished the book!</DialogTitle>
          <DialogDescription>
            Nice work{book ? ` — ${book.title} is now marked as finished.` : ". This book is now marked as finished."}
          </DialogDescription>
        </DialogHeader>
        {bookId && (
          <div className="space-y-2">
            <p className="text-sm font-medium">How would you rate it?</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1" role="group" aria-label="Book rating">
                {[1, 2, 3, 4, 5].map((rating) => {
                  const selected = (book?.rating ?? 0) >= rating;
                  return (
                    <Button
                      key={rating}
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={selected ? "text-rating hover:text-rating" : "text-muted-foreground hover:text-rating"}
                      aria-label={`Rate ${rating} out of 5`}
                      aria-pressed={book?.rating === rating}
                      disabled={savingRating}
                      onClick={() => void setRating(rating)}
                    >
                      <Star className={selected ? "fill-current" : undefined} />
                    </Button>
                  );
                })}
                <span className="ml-1 text-xs text-muted-foreground" aria-live="polite">
                  {book?.rating ? `${book.rating} out of 5` : "Not rated"}
                </span>
              </div>
              <Button type="button" size="sm" onClick={addReview} disabled={!bookId}>Add a review</Button>
            </div>
            {ratingError && <p className="text-sm text-destructive" role="alert">{ratingError}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
