import { ChevronRight } from 'lucide-react';
import { BookCover } from '@/components/reading-journal/BookCover';
import { BookProgress } from '@/components/reading-journal/BookProgress';
import { BookStatus } from '@/components/reading-journal/BookStatus';
import type { LibraryPreviewBook } from './LibraryPreview';

function ReadingProgress({ book }: { book: LibraryPreviewBook }) {
  if (book.status !== 'Reading' && book.status !== 'Paused') return null;
  return (
    <div className="rj-library-progress">
      <span>{book.currentPage}{book.totalPages ? ` / ${book.totalPages}` : ''} pages</span>
      <BookProgress currentPage={book.currentPage} totalPages={book.totalPages} />
    </div>
  );
}

/** Shared book rows for Books and opened collections. */
export function LibraryBookList({ books, onOpenBook }: {
  books: LibraryPreviewBook[];
  onOpenBook: (book: LibraryPreviewBook) => void;
}) {
  return (
    <ul className="rj-library-list" data-view="list" aria-label="Library books">
      {books.map(book => (
        <li key={book.id}>
          <article className="rj-library-list-row">
            <div className="rj-library-list-media">
              <BookCover src={book.cover} title={book.title} className="rj-library-book-thumbnail" showFallbackTitle
                paused={book.status === 'Paused'} favorite={book.favorite} />
            </div>
            <div className="rj-library-list-copy">
              <div className="rj-library-list-heading">
                <button type="button" className="rj-book-title rj-library-title rj-library-list-title" onClick={() => onOpenBook(book)}>{book.title}</button>
                <span className="rj-muted rj-library-list-description">{book.author}</span>
              </div>
              <div className="rj-library-list-status">
                <BookStatus status={book.status} />
                <ReadingProgress book={book} />
              </div>
            </div>
            <ChevronRight className="rj-library-list-arrow" aria-hidden="true" />
          </article>
        </li>
      ))}
    </ul>
  );
}
