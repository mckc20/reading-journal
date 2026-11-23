import { useId, useMemo, useState, type ReactNode } from 'react';
import { Grid2X2, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import { HomeShell, type CreateDestination, type HomeDestination } from './HomeShell';
import type { HomeBook } from './HomeCards';
import type { BookSource, BookStatus } from '@/types';
import { CollectionSearch } from './CollectionSearch';
import { LibraryNavigation } from './LibraryNavigation';
import { LibraryBookGrid } from './LibraryBookGrid';
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

type LibraryBooksProps = LibraryContentProps & {
  onCollection: (collection: 'Collections' | 'Series') => void;
};

export type LibraryPreviewProps = LibraryBooksProps & LibraryShellProps;

export function LibraryPreview(props: LibraryPreviewProps) {
  return <LibraryBooks {...props} wrapContent={content => (
    <HomeShell {...props} activeDestination="Library">{content}</HomeShell>
  )} onAddBook={() => props.onCreate('book')} />;
}

/** The Books view shared by the signed-in Library and Storybook. */
export function LibraryBooks({
  books, loading, error, initialQuery = '', wrapContent = content => content, onAddBook, ...actions
}: LibraryBooksProps & { wrapContent?: (content: ReactNode) => ReactNode; onAddBook: (trigger: HTMLButtonElement) => void }) {
  const fieldId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  // Wishes belong to their own destination, even if a caller supplies a mixed list.
  const library = books.filter(book => book.status !== 'Wishlist');
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return books.filter(book => book.status !== 'Wishlist'
      && (!needle || `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
        if (sort === 'author') return a.author.localeCompare(b.author) || a.title.localeCompare(b.title);
        return Date.parse(b.addedAt) - Date.parse(a.addedAt) || a.title.localeCompare(b.title);
      });
  }, [books, query, sort]);

  return <CollectionSearch collection="Books" items={library.map(book => ({ id: book.id, name: book.title, detail: book.author, searchText: `${book.title} ${book.author}` }))}
    query={query} onQueryChange={setQuery} onSelect={id => { const book = library.find(item => item.id === id); if (book) actions.onOpenBook(book); }}>
    {({ desktopSearch, mobileSearchButton }) => <div className="rj-library-preview">{wrapContent(<>
    <header className="rj-library-heading">
      <div><p className="rj-library-eyebrow">Your reading collection</p><h1>Library</h1></div>
      {mobileSearchButton}
    </header>
    <LibraryNavigation current="Books" onNavigate={destination => { if (destination !== 'Books') actions.onCollection(destination); }} />
    {loading ? <div className="rj-library-loading" role="status">Loading your library…<div aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div></div>
      : error ? <EmptyState title="Your library couldn’t load" message={error} action={<Button onClick={actions.onRetry}>Try again</Button>} />
      : library.length === 0 ? <EmptyState title="Your shelves are waiting" message="Add your first book to begin your collection. Find your wishes under Collections." action={<Button onClick={event => onAddBook(event.currentTarget)}>Add your first book</Button>} /> : <>
        <div className="rj-library-search-toolbar">{desktopSearch}</div>
        <div className="rj-library-results-bar">
          <p role="status" aria-live="polite">{visible.length} {visible.length === 1 ? 'book' : 'books'}{query ? ` of ${library.length}` : ''}</p>
          <div><label htmlFor={`${fieldId}-sort`}>Sort by<select id={`${fieldId}-sort`} value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently added</option><option value="title">Title A–Z</option><option value="author">Author A–Z</option></select></label>
            <div className="rj-library-view" role="group" aria-label="Book layout"><Button variant="ghost" size="icon" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={18} /></Button><Button variant="ghost" size="icon" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={18} /></Button></div>
          </div>
        </div>
        {visible.length === 0 ? <EmptyState title="No books found" message="Try another title or author." action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>} />
          : <LibraryBookGrid books={visible} view={view} onOpenBook={actions.onOpenBook} />}
      </>}
  </>)}</div>}
  </CollectionSearch>;
}
