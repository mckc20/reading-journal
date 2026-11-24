import { BookCover } from '@/components/reading-journal/BookCover';
import { BookProgress } from '@/components/reading-journal/BookProgress';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
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

/** Shared book presentation for Books and individual collections. */
export function LibraryBookGrid({ books, onOpenBook, view = 'grid', animateLayout = false }: {
  books: LibraryPreviewBook[];
  onOpenBook: (book: LibraryPreviewBook) => void;
  view?: 'grid' | 'list';
  animateLayout?: boolean;
}) {
  return (
    <ul className={cn(view === 'list' ? 'rj-library-list' : 'rj-library-books', animateLayout && 'rj-layout-enter')}
      data-view={view} aria-label="Library books">
      {books.map(book => {
        const cover = <BookCover src={book.cover} title={book.title} className="rj-library-book-thumbnail" showFallbackTitle status={book.status}
          paused={book.status === 'Paused'} favorite={book.favorite} />;
        return <li key={book.id}>{view === 'list' ? (
          <article className="rj-library-list-row">
            <div className="rj-library-list-media">{cover}</div>
            <div className="rj-library-list-copy">
              <button type="button" className="rj-book-title rj-library-title rj-library-list-title" onClick={() => onOpenBook(book)}>{book.title}</button>
              <span className="rj-muted rj-library-list-description">{book.author}</span>
              <ReadingProgress book={book} />
            </div>
            <ChevronRight className="rj-library-list-arrow" aria-hidden="true" />
          </article>
        ) : (
          <article className="rj-library-book">
            <div className="rj-library-cover">{cover}</div>
            <div className="rj-library-book-copy">
              <button type="button" className="rj-book-title rj-library-title" onClick={() => onOpenBook(book)}>{book.title}</button>
              <span className="rj-muted">{book.author}</span>
              <ReadingProgress book={book} />
            </div>
          </article>
        )}</li>;
      })}
    </ul>
  );
}
