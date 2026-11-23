import { BookCover } from '@/components/reading-journal/BookCover';
import { BookProgress } from '@/components/reading-journal/BookProgress';
import { cn } from '@/lib/utils';
import type { LibraryPreviewBook } from './LibraryPreview';

/** Shared book presentation for Books and individual collections. */
export function LibraryBookGrid({ books, onOpenBook, view = 'grid', animateLayout = false }: {
  books: LibraryPreviewBook[];
  onOpenBook: (book: LibraryPreviewBook) => void;
  view?: 'grid' | 'list';
  animateLayout?: boolean;
}) {
  return <ul className={cn("rj-library-books", animateLayout && "rj-layout-enter")} data-view={view} aria-label="Library books">{books.map(book => <li key={book.id}><article className="rj-library-book">
    <div className="rj-library-cover"><BookCover src={book.cover} title={book.title} showFallbackTitle paused={book.status === 'Paused'} favorite={book.favorite} /></div>
    <div className="rj-library-book-copy"><button className="rj-book-title rj-library-title" onClick={() => onOpenBook(book)}>{book.title}</button><span className="rj-muted">{book.author}</span><span className="rj-library-status">{book.status}</span>{(book.status === 'Reading' || book.status === 'Paused') && <div className="rj-library-progress"><span>{book.currentPage}{book.totalPages ? ` / ${book.totalPages}` : ''} pages</span><BookProgress currentPage={book.currentPage} totalPages={book.totalPages} /></div>}</div>
  </article></li>)}</ul>;
}
