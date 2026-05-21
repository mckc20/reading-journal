import BookCard from "@/components/BookCard";
import type { Book } from "@/types";

interface ContinueReadingCardProps {
  book: Book;
  onBook: (book: Book) => void;
}

export default function ContinueReadingCard({ book, onBook }: ContinueReadingCardProps) {
  return (
    <BookCard
      book={book}
      onClick={onBook}
      showQuickProgress
    />
  );
}
