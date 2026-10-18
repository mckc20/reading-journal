import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { bookCardBaseClassName, bookCardInteractiveClassName } from '@/components/BookCardContent';
import type { ReportBook } from '@/lib/wrapUpReports';
import { BookCover } from '@/components/reading-journal/BookCover';
import BookRating from '@/components/reading-journal/BookRating';

export default function ReportBookFeature({ book, children }: {
  book: ReportBook;
  children: ReactNode;
}) {
  const info = (
    <div className="min-w-0">
      <p className="break-words text-base font-medium leading-relaxed underline-offset-4 group-hover:underline group-focus-visible:underline">{book.title}</p>
      <p className="mt-1 break-words text-sm text-muted-foreground">{book.authors.join(', ')}</p>
      <BookRating rating={book.rating ?? null} />
    </div>
  );
  return (
    <article className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3 py-6 first:pt-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-5">
      <Link to={`/books/${book.id}`} aria-label={book.title} className={`${bookCardBaseClassName} ${bookCardInteractiveClassName} max-w-32`}>
        <BookCover src={book.cover_url} title={book.title} favorite={book.is_favorite} />
      </Link>
      <div className="min-w-0 space-y-3 sm:space-y-4">
        <Link to={`/books/${book.id}`} className={`${bookCardBaseClassName} ${bookCardInteractiveClassName}`}>
          {info}
        </Link>
        {children}
      </div>
    </article>
  );
}
