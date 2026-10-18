import { ChevronRight } from "lucide-react";
import { AppHeading } from "@/components/design";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/reading-journal";
import type { Book } from "@/types";
import LibraryBookCard from "./LibraryBookCard";
import HorizontalShelf from "./HorizontalShelf";

interface BookShelfProps {
  title: string;
  books: Book[];
  onBook: (book: Book) => void;
  onViewAll?: () => void;
  emptyMessage?: string;
  showAuthor?: boolean;
}

export default function BookShelf({
  title,
  books,
  onBook,
  onViewAll,
  emptyMessage = "No books here yet.",
  showAuthor = true,
}: BookShelfProps) {
  return (
    <section className="min-w-0 border-b px-4 py-3 last:border-b-0 sm:px-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <AppHeading level={4} as="h2">{title}</AppHeading>
          <p className="text-xs text-muted-foreground">{books.length}</p>
        </div>
        {onViewAll && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onViewAll}>
            View all
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      {books.length > 0 ? (
        <HorizontalShelf title={title} className="items-stretch py-1">
          {books.map((book) => (
            <div key={book.id} data-shelf-item className="shrink-0 basis-[90px] sm:basis-[112px]">
              <LibraryBookCard book={book} onBook={onBook} variant="shelf" showAuthor={showAuthor} />
            </div>
          ))}
        </HorizontalShelf>
      ) : (
        <EmptyState compact message={emptyMessage} className="rounded-lg border border-dashed bg-background/55" />
      )}
    </section>
  );
}
