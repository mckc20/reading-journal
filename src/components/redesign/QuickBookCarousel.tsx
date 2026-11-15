import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { BookCover } from '@/components/reading-journal/BookCover';
import type { HomeBook } from './HomeCards';

interface QuickBookCarouselProps {
  books: HomeBook[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

/** Covers scroll beneath one stationary selection frame, including at either end. */
export function QuickBookCarousel({ books, selectedId, onSelect }: QuickBookCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedId);
  const scrollingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const gesture = useRef<{ pointerId: number; startX: number; scrollLeft: number } | null>(null);
  const draggedRef = useRef(false);
  const pointerFocusRef = useRef(false);
  const movingFocusRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const bookIds = books.map(book => book.id).join('\0');

  function buttons() {
    return Array.from(scrollerRef.current?.querySelectorAll<HTMLButtonElement>('.rj-quick-book') ?? []);
  }

  function centerBook(id: string | undefined, behavior: ScrollBehavior = 'auto') {
    const scroller = scrollerRef.current;
    const book = buttons().find(button => button.dataset.bookId === id);
    if (!scroller || !book) return;
    scroller.scrollTo({ left: book.offsetLeft + book.offsetWidth / 2 - scroller.clientWidth / 2, behavior });
  }

  function nearestBook() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    return buttons().reduce<HTMLButtonElement | undefined>((nearest, button) => {
      const distance = Math.abs(button.offsetLeft + button.offsetWidth / 2 - center);
      const nearestDistance = nearest ? Math.abs(nearest.offsetLeft + nearest.offsetWidth / 2 - center) : Infinity;
      return distance < nearestDistance ? button : nearest;
    }, undefined);
  }

  function select(id: string, behavior: ScrollBehavior = 'smooth') {
    // Protect the animation before React applies the selectedId update. Otherwise
    // the layout effect can replace this smooth scroll with an instant recenter.
    scrollingRef.current = true;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => { scrollingRef.current = false; }, 150);
    selectedRef.current = id;
    onSelect(id);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    centerBook(id, reducedMotion ? 'auto' : behavior);
  }

  useLayoutEffect(() => {
    selectedRef.current = selectedId;
    // Prop updates caused by scrolling must not pull the strip back mid-gesture.
    if (!scrollingRef.current) centerBook(selectedId);
  }, [selectedId, bookIds]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(() => {
      scrollingRef.current = false;
      centerBook(selectedRef.current);
    });
    observer.observe(scroller);
    return () => { observer.disconnect(); clearTimeout(settleTimer.current); };
  }, []);

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (!gesture.current || gesture.current.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (draggedRef.current) {
      event.preventDefault();
      const id = nearestBook()?.dataset.bookId;
      if (id) select(id);
    }
  }

  return <div className="rj-quick-carousel">
    <div
      ref={scrollerRef}
      className="rj-quick-books"
      data-dragging={dragging}
      data-empty={!books.length}
      role="group"
      aria-label="Choose a book to update"
      tabIndex={books.length ? 0 : -1}
      onScroll={() => {
        scrollingRef.current = true;
        const id = nearestBook()?.dataset.bookId;
        if (id && id !== selectedRef.current) { selectedRef.current = id; onSelect(id); }
        clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => { scrollingRef.current = false; }, 150);
      }}
      onKeyDown={event => {
        pointerFocusRef.current = false;
        const index = books.findIndex(book => book.id === selectedRef.current);
        const indexes: Record<string, number> = { ArrowLeft: Math.max(0, index - 1), ArrowRight: Math.min(books.length - 1, index + 1), Home: 0, End: books.length - 1 };
        if (!(event.key in indexes) || !books.length) return;
        event.preventDefault();
        const book = books[indexes[event.key]];
        movingFocusRef.current = true;
        buttons()[indexes[event.key]]?.focus({ preventScroll: true });
        movingFocusRef.current = false;
        select(book.id);
      }}
      onDragStart={event => event.preventDefault()}
      onPointerDown={event => {
        pointerFocusRef.current = true;
        draggedRef.current = false;
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        gesture.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
      }}
      onPointerMove={event => {
        const start = gesture.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const distance = event.clientX - start.startX;
        if (!draggedRef.current && Math.abs(distance) < 6) return;
        if (!draggedRef.current) {
          draggedRef.current = true;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        event.currentTarget.scrollLeft = start.scrollLeft - distance;
      }}
      onPointerUp={event => { pointerFocusRef.current = false; finishDrag(event); }}
      onPointerCancel={event => { pointerFocusRef.current = false; finishDrag(event); }}
      onClickCapture={event => { if (draggedRef.current) { event.preventDefault(); event.stopPropagation(); draggedRef.current = false; } }}
    >
      {books.length ? books.map(book => <button
        key={book.id}
        data-book-id={book.id}
        className="rj-quick-book"
        aria-label={`Select ${book.title}`}
        aria-pressed={selectedId === book.id}
        onClick={() => select(book.id)}
        onFocus={event => { if (!pointerFocusRef.current && !movingFocusRef.current && event.currentTarget.matches(':focus-visible')) select(book.id, 'auto'); }}
      ><BookCover src={book.cover} title={book.title} showFallbackTitle /></button>) : <p>Start a book to log your next chapter.</p>}
    </div>
    {books.length > 0 && <div className="rj-quick-selection-frame" aria-hidden="true" />}
  </div>;
}
