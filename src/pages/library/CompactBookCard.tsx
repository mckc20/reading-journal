import BookCard from '@/components/BookCard';
import type { Book } from '@/types';

export default function CompactBookCard({ book, onBook }: { book: Book; onBook: (book: Book) => void }) {
  return <BookCard book={book} onBook={onBook} textSize="compact" showRating />;
}
