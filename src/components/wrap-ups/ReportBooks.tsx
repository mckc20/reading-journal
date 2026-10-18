import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import BookCardContent, { bookCardBaseClassName, bookCardInteractiveClassName } from '@/components/BookCardContent';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { validCalendarDate } from '@/lib/wrapUpArchive';
import type { ReportBook, ReportBookActivity } from '@/lib/wrapUpReports';
import ReportBookFeature from './ReportBookFeature';

const formatDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

function SingleBook({ book, activity }: { book: ReportBook; activity?: ReportBookActivity }) {
  return (
    <ReportBookFeature book={book}>
      <div className="min-w-0 space-y-4">
        <div className="space-y-1 text-sm">
          {validCalendarDate(book.date_started) && <p>Started {formatDate(book.date_started)}</p>}
          {validCalendarDate(book.date_finished) && <p>Finished {formatDate(book.date_finished)}</p>}
          {activity && activity.logCount > 0 && (
            <p>
              {activity.pagesLogged?.toLocaleString('en')} pages logged
              {activity.minutesLogged !== null && ` · ${activity.minutesLogged.toLocaleString('en')} minutes logged`}
            </p>
          )}
        </div>
      </div>
    </ReportBookFeature>
  );
}

export default function ReportBooks({ books, activity }: { books: ReportBook[]; activity?: ReportBookActivity[] }) {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const carousel = books.length > (desktop ? 4 : 2);
  const rowRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  function updateEdges() {
    const row = rowRef.current;
    if (!row) return;
    const bounds = row.getBoundingClientRect();
    const first = row.firstElementChild?.getBoundingClientRect();
    const last = row.lastElementChild?.getBoundingClientRect();
    // Ignore the small focus-ring padding when all book cards are already visible.
    setEdges({ left: Boolean(first && first.left < bounds.left - 1), right: Boolean(last && last.right > bounds.right + 1) });
  }

  useEffect(() => {
    if (!carousel || !rowRef.current) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, [carousel, books]);

  function scroll(direction: -1 | 1) {
    const row = rowRef.current;
    const item = row?.firstElementChild as HTMLElement | null;
    if (!row || !item) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    row.scrollBy({
      left: direction * (item.offsetWidth + gap),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  if (books.length === 1) {
    return <SingleBook book={books[0]} activity={activity?.find(item => item.book.id === books[0].id)} />;
  }
  if (books.length === 0) return null;

  const bookList = (
    <ul
      ref={rowRef}
      aria-label="Books you read"
      tabIndex={carousel ? 0 : undefined}
      className={cn(carousel
        ? '-mx-1 flex min-w-0 gap-3 overflow-x-auto overflow-y-hidden px-1 py-1 overscroll-x-contain scroll-smooth motion-reduce:scroll-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        : 'grid grid-cols-[repeat(2,minmax(0,7rem))] gap-5 md:grid-cols-[repeat(4,minmax(0,9rem))]')}
      onScroll={carousel ? updateEdges : undefined}
      onKeyDown={carousel ? event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          scroll(event.key === 'ArrowLeft' ? -1 : 1);
        }
      } : undefined}
    >
      {books.map(book => (
        <li key={book.id} className={carousel ? 'shrink-0 basis-28 md:basis-36' : 'min-w-0'}>
          <Link to={`/books/${book.id}`} className={`${bookCardBaseClassName} ${bookCardInteractiveClassName}`}>
            <BookCardContent book={book} textSize={carousel ? 'default' : 'compact'} showRating />
          </Link>
        </li>
      ))}
    </ul>
  );
  if (!carousel) return bookList;

  // Cover centers: 4px row padding + half the 3:2 height of the 112px / 144px covers.
  return (
    <div className="relative min-w-0">
      {edges.left && <Button
        type="button" variant="outline" size="icon-sm"
        className="absolute left-0 top-[88px] z-10 -translate-y-1/2 rounded-full bg-background shadow-sm md:top-[112px]"
        aria-label="Scroll books left" onClick={() => scroll(-1)}
      ><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>}
      {bookList}
      {edges.right && <Button
        type="button" variant="outline" size="icon-sm"
        className="absolute right-0 top-[88px] z-10 -translate-y-1/2 rounded-full bg-background shadow-sm md:top-[112px]"
        aria-label="Scroll books right" onClick={() => scroll(1)}
      ><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>}
    </div>
  );
}
