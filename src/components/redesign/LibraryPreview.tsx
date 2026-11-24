import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import type { CreateDestination, HomeDestination } from './HomeShell';
import type { HomeBook } from './HomeCards';
import type { BookSource, BookStatus } from '@/types';
import { CollectionSearch } from './CollectionSearch';
import { LibraryBookList } from './LibraryBookList';
import { useLibraryPresentation } from './LibraryNavigation';
import { compareLibraryItems, librarySorts } from '@/lib/libraryTabs';
import './redesign.css';
import './library-preview.css';

export interface LibraryPreviewBook extends HomeBook {
  status: BookStatus;
  source?: BookSource;
  favorite?: boolean;
  addedAt: string;
}

export interface LibraryContentProps {
  books: LibraryPreviewBook[];
  loading?: boolean;
  error?: string;
  initialQuery?: string;
  onRetry: () => void;
  onOpenBook: (book: LibraryPreviewBook) => void;
}

type LibraryShellProps = {
  onNavigate: (destination: HomeDestination) => void;
  onCreate: (destination: CreateDestination) => void;
  onNotifications: () => void;
};

export type LibraryPreviewProps = LibraryContentProps & LibraryShellProps;

export function LibraryPreview(props: LibraryPreviewProps) {
  return <LibraryBooks {...props} onAddBook={() => props.onCreate('book')} />;
}

/** The Books view shared by the signed-in Library and Storybook. */
export function LibraryBooks({
  books, loading, error, initialQuery = '', onAddBook, ...actions
}: LibraryContentProps & { onAddBook: (trigger: HTMLButtonElement) => void }) {
  const [query, setQuery] = useState(initialQuery);
  const { sort, setSort } = useLibraryPresentation();
  // Wishes belong to their own destination, even if a caller supplies a mixed list.
  const library = books.filter(book => book.status !== 'Wishlist');
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return books.filter(book => book.status !== 'Wishlist'
      && (!needle || `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => compareLibraryItems(a, b, sort));
  }, [books, query, sort]);

  return <CollectionSearch collection="Books" query={query} onQueryChange={setQuery}>
    {({ desktopSearch }) => <div className="rj-library-preview">
    {loading ? <div className="rj-library-loading" role="status">Loading your library…<div aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div></div>
      : error ? <EmptyState title="Your library couldn’t load" message={error} action={<Button onClick={actions.onRetry}>Try again</Button>} />
      : library.length === 0 ? <EmptyState title="Your shelves are waiting" message="Add your first book to begin your collection. Find your wishes under Collections." action={<Button onClick={event => onAddBook(event.currentTarget)}>Add your first book</Button>} /> : <>
        <div className="rj-library-books-toolbar">
          <div className="rj-library-search-toolbar">{desktopSearch}</div>
          <label className="rj-library-sort">
            <span>Sort by</span>
            <select value={sort} onChange={event => {
              const option = librarySorts.find(item => item.value === event.target.value);
              if (option) setSort(option.value);
            }}>
              {librarySorts.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <p className="sr-only" role="status">{query.trim() && `${visible.length} ${visible.length === 1 ? 'result' : 'results'}`}</p>
        {visible.length === 0 ? <EmptyState title="No books found" message="Try another title or author." action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>} />
          : <LibraryBookList books={visible} onOpenBook={actions.onOpenBook} />}
      </>}
  </div>}
  </CollectionSearch>;
}
