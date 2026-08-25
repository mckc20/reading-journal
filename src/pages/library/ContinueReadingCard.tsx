import CurrentlyReadingBookCard from "@/components/CurrentlyReadingBookCard";
import type { Book } from "@/types";

interface ContinueReadingCardProps {
  book: Book;
  onBook: (book: Book) => void;
}

export default function ContinueReadingCard({ book, onBook }: ContinueReadingCardProps) {
  return (
    <CurrentlyReadingBookCard
      book={book}
      onBook={onBook}
      showQuickProgress
    />
  );
}
