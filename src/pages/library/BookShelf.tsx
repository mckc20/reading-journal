import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Book } from "@/types";
import LibraryBookCard from "./LibraryBookCard";

interface BookShelfProps {
  title: string;
  books: Book[];
  onBook: (book: Book) => void;
  onViewAll?: () => void;
  emptyMessage?: string;
}

function bookCountLabel(count: number) {
  return `${count} book${count === 1 ? "" : "s"}`;
}

export default function BookShelf({
  title,
  books,
  onBook,
  onViewAll,
  emptyMessage = "No books here yet.",
}: BookShelfProps) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-medium leading-snug">{title}</h3>
          <p className="text-xs text-muted-foreground">{bookCountLabel(books.length)}</p>
        </div>
        {onViewAll && (
          <Button type="button" variant="ghost" size="sm" onClick={onViewAll}>
            View All
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      {books.length > 0 ? (
        <div
          aria-label={`${title} shelf`}
          className="grid grid-cols-[repeat(auto-fill,110px)] justify-start gap-3 sm:grid-cols-[repeat(auto-fill,140px)]"
        >
          {books.map((book) => (
            <LibraryBookCard key={book.id} book={book} onBook={onBook} variant="shelf" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}
