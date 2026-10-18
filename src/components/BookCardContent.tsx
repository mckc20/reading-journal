import type { ReactNode } from 'react';
import { BookCover } from '@/components/reading-journal/BookCover';
import BookRating from '@/components/reading-journal/BookRating';
import { cn } from '@/lib/utils';
import type { Book } from '@/types';

// Snapshots and recommendations can use the same presentation as library books.
type CardBook = Pick<Book, 'title' | 'authors' | 'cover_url' | 'rating'>
  & Partial<Pick<Book, 'status' | 'is_favorite'>>;

export const bookCardBaseClassName = 'group block min-w-0 w-full space-y-3 rounded-md text-left';
export const bookCardInteractiveClassName = 'cursor-pointer transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none';

interface BookCardContentProps {
  book: CardBook;
  textSize?: 'default' | 'compact';
  showAuthor?: boolean;
  showRating?: boolean;
  showStatus?: boolean;
  cornerLabel?: string;
  interactive?: boolean;
  footer?: ReactNode;
}

export default function BookCardContent({
  book, textSize = 'default', showAuthor = true, showRating = false, showStatus = false, cornerLabel, interactive = true, footer,
}: BookCardContentProps) {
  return (
    <>
      <BookCover
        src={book.cover_url}
        title={book.title}
        paused={book.status === 'Paused'}
        favorite={book.is_favorite}
        cornerLabel={cornerLabel}
        status={showStatus ? book.status : undefined}
      />
      <div className="min-w-0">
        <p className={cn(
          'line-clamp-2 break-words font-medium underline-offset-4',
          textSize === 'compact' ? 'text-sm' : 'text-base',
          // Clamping clips offset underlines unless the line box has enough room.
          'leading-relaxed',
          interactive && 'group-hover:underline group-focus-visible:underline',
        )}>
          {book.title}
        </p>
        {showAuthor && (
          <p className={cn('mt-1 line-clamp-2 break-words text-muted-foreground', textSize === 'compact' ? 'text-xs' : 'text-sm')}>
            {book.authors.join(', ')}
          </p>
        )}
        {showRating && <BookRating rating={book.rating ?? null} />}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </>
  );
}
