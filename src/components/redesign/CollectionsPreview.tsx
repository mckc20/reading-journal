import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookCover } from '@/components/reading-journal/BookCover';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import { LibraryBookGrid } from './LibraryBookGrid';
import { CollectionSearch } from './CollectionSearch';
import type { LibraryContentProps, LibraryPreviewProps, LibraryPreviewBook } from './LibraryPreview';
import type { BookStatus } from '@/types';
import './redesign.css';
import './library-preview.css';
import './collections-preview.css';

type CollectionId = BookStatus | 'Favorites';
const definitions: { id: CollectionId; tone: string }[] = [
  { id: 'Reading', tone: 'gold' }, { id: 'Up Next', tone: 'blue' },
  { id: 'To Read', tone: 'warm' }, { id: 'Paused', tone: 'blue' },
  { id: 'Finished', tone: 'gold' }, { id: 'DNF', tone: 'warm' },
  { id: 'Wishlist', tone: 'rose' }, { id: 'Favorites', tone: 'rose' },
];

export function parseCollectionId(value: string | null): CollectionId | null {
  return definitions.find(definition => definition.id === value)?.id ?? null;
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
  const heading = useRef<HTMLHeadingElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const returnFocusId = useRef<CollectionId | null>(null);
  const collections = definitions.map(definition => ({ ...definition, books: books.filter(book => definition.id === 'Favorites' ? book.favorite && book.status !== 'Wishlist' : book.status === definition.id) }));
  const current = collections.find(collection => collection.id === selected);
  const needle = query.trim().toLocaleLowerCase();
  const visibleCollections = collections.filter(collection => collection.id.toLocaleLowerCase().includes(needle));
  const visibleBooks = (current?.books ?? []).filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle));
  const searchItems = current ? current.books.map(book => ({ id: book.id, name: book.title, detail: book.author, searchText: `${book.title} ${book.author}` })) : collections.map(collection => ({ id: collection.id, name: collection.id, detail: `${collection.books.length} ${collection.books.length === 1 ? 'book' : 'books'}` }));

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
              <p role="status">{visibleBooks.length} {visibleBooks.length === 1 ? 'book' : 'books'}</p>
            </div>
            {desktopSearch}
          </div>
        ) : (
          <div className="rj-library-search-toolbar mb-6">{desktopSearch}</div>
        )}
        {current ? (visibleBooks.length ? <LibraryBookGrid books={visibleBooks} onOpenBook={actions.onOpenBook} /> : <EmptyState title={query ? 'No books found' : 'No books here yet'} message={query ? 'Try another title or author.' : emptyMessage(current.id)} action={query ? <Button variant="outline" onClick={() => setQuery('')}>Clear search</Button> : undefined} />)
          : visibleCollections.length ? <ul ref={grid} className="rj-collection-grid" aria-label="Default collections">{visibleCollections.map(collection => <CollectionCard key={collection.id} collection={collection} onOpen={() => openCollection(collection.id)} />)}</ul>
          : <EmptyState title="No collections found" message="Try a collection name, such as Reading or Favorites." action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>} />}
      </>}
    </div>}
  </CollectionSearch>;
}

function emptyMessage(id: CollectionId) {
  if (id === 'Favorites') return 'Mark a book as a favorite to find it here.';
  if (id === 'Wishlist') return 'Books on your wishlist will appear here.';
  return `Books with the ${id} status will appear here.`;
}

function CollectionCard({ collection, onOpen }: { collection: { id: CollectionId; tone: string; books: LibraryPreviewBook[] }; onOpen: () => void }) {
  const Icon = collection.id === 'Favorites' ? Heart : BookOpen;
  return <li><article className="rj-collection-card" data-tone={collection.tone}>
    <div className="rj-collection-art" aria-hidden="true">
      {collection.books.length ? <div className="rj-collection-covers">{collection.books.slice(0, 3).map(book => <BookCover key={book.id} src={book.cover} title={book.title} />)}</div> : <Icon size={38} strokeWidth={1.2} />}
      <span className="rj-collection-symbol"><Icon size={18} /></span>
    </div>
    <div className="rj-collection-caption"><div><button data-collection={collection.id} onClick={onOpen}>{collection.id}</button><p>{collection.books.length} {collection.books.length === 1 ? 'book' : 'books'}</p></div><ArrowUpRight size={20} aria-hidden="true" /></div>
  </article></li>;
}
