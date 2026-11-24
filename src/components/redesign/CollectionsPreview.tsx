import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookCover } from '@/components/reading-journal/BookCover';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import { LibraryBookGrid } from './LibraryBookGrid';
import { CollectionSearch } from './CollectionSearch';
import { useLibraryPresentation } from './LibraryNavigation';
import { compareLibraryItems } from '@/lib/libraryTabs';
import { cn } from '@/lib/utils';
import { useBookHeroColor } from '@/hooks/useDominantImageColor';
import type { LibraryContentProps, LibraryPreviewProps, LibraryPreviewBook } from './LibraryPreview';
import type { BookStatus } from '@/types';
import './redesign.css';
import './library-preview.css';
import './collections-preview.css';

type CollectionId = Exclude<BookStatus, 'Up Next' | 'Reading' | 'Paused'> | 'Favorites';
const definitions = ['To Read', 'Finished', 'DNF', 'Wishlist', 'Favorites'] as const satisfies readonly CollectionId[];

export function parseCollectionId(value: string | null): CollectionId | null {
  return definitions.find(id => id === value) ?? null;
}

interface LibraryCollectionsProps extends Omit<LibraryContentProps, 'initialQuery'> {
  initialCollection?: CollectionId;
  selection?: { collection: CollectionId | null; onChange: (collection: CollectionId | null) => void };
}

export interface CollectionsPreviewProps extends Omit<LibraryPreviewProps, 'initialQuery'> {
  initialCollection?: CollectionId;
}

export function CollectionsPreview(props: CollectionsPreviewProps) {
  return <LibraryCollections {...props} />;
}

/** Derived default collections; no separate records or persistence are needed. */
export function LibraryCollections({
  books, initialCollection, selection, loading, error, ...actions
}: LibraryCollectionsProps) {
  const [localSelection, setLocalSelection] = useState<CollectionId | null>(initialCollection ?? null);
  const selected = selection ? selection.collection : localSelection;
  const setSelected = selection?.onChange ?? setLocalSelection;
  const [query, setQuery] = useState('');
  const { sort, view, animateLayout } = useLibraryPresentation();
  const heading = useRef<HTMLHeadingElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const returnFocusId = useRef<CollectionId | null>(null);
  const collections = definitions.map(id => {
    const matchingBooks = books.filter(book => id === 'Favorites'
      ? book.favorite && book.status !== 'Wishlist'
      : book.status === id);
    matchingBooks.sort((a, b) => compareLibraryItems(a, b, sort));
    return { id, books: matchingBooks, title: id, author: matchingBooks[0]?.author, addedAt: matchingBooks[0]?.addedAt };
  }).sort((a, b) => compareLibraryItems(a, b, sort));
  const current = collections.find(collection => collection.id === selected);
  const indexedCollections = collections.filter(collection => collection.id === 'Favorites' || collection.books.length > 0);
  const needle = query.trim().toLocaleLowerCase();
  const visibleCollections = indexedCollections.filter(collection => collection.id.toLocaleLowerCase().includes(needle));
  const visibleBooks = (current?.books ?? []).filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle));
  const searchItems = current ? current.books.map(book => ({ id: book.id, name: book.title, detail: book.author, searchText: `${book.title} ${book.author}` })) : indexedCollections.map(collection => ({ id: collection.id, name: collection.id }));

  useEffect(() => {
    if (selected) heading.current?.focus();
    else if (returnFocusId.current) grid.current?.querySelector<HTMLButtonElement>(`[data-collection="${returnFocusId.current}"]`)?.focus();
  }, [selected]);

  function openCollection(id: CollectionId) {
    returnFocusId.current = id;
    setQuery(''); setSelected(id);
  }
  function openBook(id: string) {
    const book = current?.books.find(item => item.id === id);
    if (book) actions.onOpenBook(book);
  }

  return <CollectionSearch key={selected ?? 'collections'} collection={current ? `${current.id === 'Favorites' ? 'Favorite' : current.id} books` : 'Collections'}
    items={searchItems} query={query} onQueryChange={setQuery} onSelect={id => { if (current) openBook(id); else openCollection(id as CollectionId); }}>
    {({ desktopSearch }) => <div className="rj-library-preview rj-collections-preview">
      {loading ? <p role="status">Loading your collections…</p> : error ? <EmptyState title="Your collections couldn’t load" message={error} action={<Button onClick={actions.onRetry}>Try again</Button>} /> : <>
        {current ? (
          <div className="rj-collections-toolbar">
            <div>
              <Button variant="ghost" onClick={() => { setSelected(null); setQuery(''); }}><ArrowLeft aria-hidden="true" />All collections</Button>
              <h2 ref={heading} tabIndex={-1}>{current.id}</h2>
            </div>
            {desktopSearch}
          </div>
        ) : (
          <div className="rj-library-search-toolbar mb-6">{desktopSearch}</div>
        )}
        {current ? (visibleBooks.length ? <LibraryBookGrid key={view} books={visibleBooks} view={view} animateLayout={animateLayout} onOpenBook={actions.onOpenBook} /> : <EmptyState title={query ? 'No books found' : 'No books here yet'} message={query ? 'Try another title or author.' : emptyMessage(current.id)} action={query ? <Button variant="outline" onClick={() => setQuery('')}>Clear search</Button> : undefined} />)
          : visibleCollections.length ? <ul key={view} ref={grid} data-view={view} className={cn("rj-collection-grid", animateLayout && "rj-layout-enter")} aria-label="Default collections">{visibleCollections.map(collection => <CollectionCard key={collection.id} collection={collection} onOpen={() => openCollection(collection.id)} />)}</ul>
          : <EmptyState title="No collections found" message="Try a collection name, such as Finished or Favorites." action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>} />}
      </>}
    </div>}
  </CollectionSearch>;
}

function emptyMessage(id: CollectionId) {
  if (id === 'Favorites') return 'Mark a book as a favorite to find it here.';
  if (id === 'Wishlist') return 'Books on your wishlist will appear here.';
  return `Books with the ${id} status will appear here.`;
}

function CollectionCard({ collection, onOpen }: { collection: { id: CollectionId; books: LibraryPreviewBook[] }; onOpen: () => void }) {
  const covers = collection.books.filter(book => book.cover).slice(0, 3);
  const color = useBookHeroColor(covers[0]?.cover);

  return <li><article className="rj-collection-card">
    <div className="rj-collection-art" aria-hidden="true"
      style={covers.length ? { '--book-detail-hero-color': color } as CSSProperties : undefined}>
      {covers.length ? (
        <div className="rj-collection-covers" data-count={covers.length}>
          {covers.map(book => <BookCover key={book.id} src={book.cover} title={book.title} decorative />)}
        </div>
      ) : <BookOpen size={38} strokeWidth={1.2} />}
    </div>
    <button type="button" className="rj-book-title rj-library-title rj-collection-title" data-collection={collection.id} onClick={onOpen}>{collection.id}</button>
  </article></li>;
}
