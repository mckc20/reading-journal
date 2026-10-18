import type { ReactNode } from 'react';
import BookCardContent, { bookCardBaseClassName, bookCardInteractiveClassName } from '@/components/BookCardContent';
import { cn } from '@/lib/utils';
import type { Book } from '@/types';

interface BookCardProps {
  book: Book;
  onBook?: (book: Book) => void;
  onClick?: (book: Book) => void;
  variant?: 'grid' | 'shelf';
  textSize?: 'default' | 'compact';
  cornerLabel?: string;
  showAuthor?: boolean;
  showRating?: boolean;
  footer?: ReactNode;
  className?: string;
  selected?: boolean;
  onSelect?: (book: Book) => void;
}

export default function BookCard({
  book, onBook, onClick, variant = 'grid', textSize, cornerLabel, showAuthor = true, showRating = false,
  footer, className, selected = false, onSelect,
}: BookCardProps) {
  const handleClick = onSelect ?? onBook ?? onClick;
  return (
    <div
      role={handleClick ? 'button' : undefined}
      tabIndex={handleClick ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        bookCardBaseClassName,
        handleClick && bookCardInteractiveClassName,
        selected && 'ring-2 ring-primary ring-offset-2',
        className,
      )}
      onClick={handleClick ? () => handleClick(book) : undefined}
      onKeyDown={handleClick ? event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick(book);
        }
      } : undefined}
    >
      <BookCardContent
        book={book}
        textSize={textSize ?? (variant === 'shelf' ? 'compact' : 'default')}
        cornerLabel={cornerLabel}
        showAuthor={showAuthor}
        showRating={showRating}
        showStatus={variant === 'grid'}
        interactive={Boolean(handleClick)}
        footer={footer}
      />
    </div>
  );
}
