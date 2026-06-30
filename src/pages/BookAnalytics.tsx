import { useParams } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import BackButton from "@/components/BackButton";
import BookAnalyticsPanel from "@/components/BookAnalyticsPanel";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";

export default function BookAnalytics() {
  const { bookId } = useParams<{ bookId: string }>();
  const { books, loading, error, reload } = useBooksContext();
  const book = bookId ? books.find((item) => item.id === bookId) ?? null : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-lg font-heading leading-snug font-medium">Book not found</h1>
        <BackButton fallbackTo="/library" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackTo="/library" />

      <div>
        <p className="text-sm text-muted-foreground">{book.title}</p>
        <h1 className="text-2xl font-heading leading-snug font-medium">Analytics</h1>
      </div>

      <BookAnalyticsPanel book={book} />
    </div>
  );
}
