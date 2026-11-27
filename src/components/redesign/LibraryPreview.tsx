import { useMemo, useState } from 'react';
import { LibraryFilterChips } from '@/components/LibraryControls';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import type { CreateDestination, HomeDestination } from './HomeShell';
import type { HomeBook } from './HomeCards';
import type { BookFormat, BookLanguage, BookSource, BookStatus, Series } from '@/types';
import { CollectionSearch } from './CollectionSearch';
import { LibraryBookList } from './LibraryBookList';
import { useLibraryPresentation } from './LibraryNavigation';
import { compareLibraryItems, librarySorts } from '@/lib/libraryTabs';
import type { LibraryFilterBook } from '@/lib/libraryBookFilters';
import { useLibraryBookFilters } from './useLibraryBookFilters';
import { LibraryBookFilters } from './LibraryBookFilters';
import { LibrarySortControl } from './LibrarySortControl';
import './redesign.css';
import './library-preview.css';

export interface LibraryPreviewBook extends HomeBook {
  status: BookStatus;
  source?: BookSource;
  format?: BookFormat;
  language?: BookLanguage;
  favorite?: boolean;
  addedAt: string;
  filterRecord?: LibraryFilterBook;
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
  books, loading, error, initialQuery = '', onAddBook, series, ...actions
}: LibraryContentProps & { series?: Series[]; onAddBook: (trigger: HTMLButtonElement) => void }) {
  const [query, setQuery] = useState(initialQuery);
  const { sort, setSort } = useLibraryPresentation();
  const library = useMemo(() => books.filter(book => book.status !== 'Wishlist'), [books]);
  const { filters, chips, options, filteredBooks, focusedFilter, toggleFilter, clearFilters, closeLinkedFilters } =
    useLibraryBookFilters(library, series);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return filteredBooks
      .filter(book => !needle || `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => compareLibraryItems(a, b, sort));
  }, [filteredBooks, query, sort]);

  return <CollectionSearch collection="Books" query={query} onQueryChange={setQuery}>
    {({ desktopSearch }) => <div className="rj-library-preview rj-library-books-panel">
    {loading ? <div className="rj-library-loading" role="status">Loading your library…<div aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div></div>
      : error ? <EmptyState title="Your library couldn’t load" message={error} action={<Button onClick={actions.onRetry}>Try again</Button>} />
      : library.length === 0 && chips.length === 0 && !focusedFilter ? <EmptyState title="Your shelves are waiting" message="Add your first book to begin your collection. Find your wishes under Collections." action={<Button onClick={event => onAddBook(event.currentTarget)}>Add your first book</Button>} /> : <>
        <div className="rj-library-books-toolbar">
          <div className="rj-library-search-toolbar">{desktopSearch}</div>
          <LibrarySortControl value={sort} onChange={setSort} options={librarySorts} />
          <LibraryBookFilters filters={filters} options={options} count={chips.length} onToggle={toggleFilter}
            onClear={() => clearFilters()} focusedFilter={focusedFilter} onCloseLink={closeLinkedFilters} />
        </div>
        {chips.length > 0 && <div className="mb-4">
          <LibraryFilterChips chips={chips.map(chip => ({ label: chip.label, onRemove: () => clearFilters(chip.keys) }))}
            onClear={() => clearFilters()} />
        </div>}
        <p className="sr-only" role="status">{(query.trim() || chips.length > 0) && `${visible.length} ${visible.length === 1 ? 'result' : 'results'}`}</p>
        {visible.length === 0 ? <EmptyState title="No books found"
          message={chips.length ? 'Try changing or clearing your filters.' : 'Try another title or author.'}
          action={query && <Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>} />
          : <LibraryBookList books={visible} onOpenBook={actions.onOpenBook} />}
      </>}
  </div>}
  </CollectionSearch>;
}
