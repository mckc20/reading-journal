import BookCard from '@/components/BookCard';
import type { Book } from '@/types';

interface CoverOnlyBookCardProps {
  book: Book;
  onBook: (book: Book) => void;
  className?: string;
}

// Keep existing callers while bringing related-book shelves into the shared design.
export default function CoverOnlyBookCard(props: CoverOnlyBookCardProps) {
  return <BookCard {...props} variant="shelf" />;
}
