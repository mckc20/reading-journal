import { Minus } from 'lucide-react';
import { useRef } from 'react';
import { BookSearchPicker } from '@/components/BookSearchPicker';
import { BookCover } from '@/components/reading-journal/BookCover';
import type { LibraryPreviewBook } from './LibraryPreview';

export function CollectionBookSelection({ books, selected, onSelectedChange, query, onQueryChange, disabled }: {
  books: LibraryPreviewBook[];
  selected: Set<string>;
  onSelectedChange: (ids: Set<string>) => void;
  query: string;
  onQueryChange: (query: string) => void;
  disabled?: boolean;
}) {
  const search = useRef<HTMLInputElement>(null);
  const selectedBooks = books.filter(book => selected.has(book.id));

  function toggleBook(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedChange(next);
  }

  return <div className="min-w-0 space-y-2">
    <CollectionSelectedCovers books={selectedBooks} disabled={disabled} onDeselect={(id, byKeyboard) => {
      toggleBook(id, false);
      if (byKeyboard) search.current?.focus();
    }} />
    <BookSearchPicker books={books} selected={selected} query={query} onQueryChange={onQueryChange}
      onToggle={toggleBook} disabled={disabled} searchRef={search} />
  </div>;
}

export function CollectionSelectedCovers({ books, disabled, onDeselect }: {
  books: readonly Pick<LibraryPreviewBook, 'id' | 'title' | 'cover'>[];
  disabled?: boolean;
  onDeselect: (id: string, byKeyboard: boolean) => void;
}) {
  if (!books.length) return null;
  return <ul className="rj-collection-selected-covers" aria-label="Selected books">
    {books.map(book => <li key={book.id} title={book.title}>
      <BookCover src={book.cover} title={book.title} showFallbackTitle decorative />
      <button type="button" className="rj-collection-selected-remove" disabled={disabled} aria-label={`Deselect ${book.title}`}
        onClick={event => onDeselect(book.id, event.detail === 0)}>
        <span><Minus size={14} aria-hidden="true" /></span>
      </button>
    </li>)}
  </ul>;
}
