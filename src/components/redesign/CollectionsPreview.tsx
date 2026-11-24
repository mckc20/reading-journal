import { useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import { CollectionDetail, type CollectionActions } from './CollectionDetail';
import { LibraryMosaic } from './LibraryMosaic';
import { CollectionSearch } from './CollectionSearch';
import { useLibraryPresentation } from './LibraryNavigation';
import { compareLibraryItems } from '@/lib/libraryTabs';
import { belongsToCollection, libraryCollections, parseCollectionId, type CollectionId } from '@/lib/libraryCollections';
import type { LibraryContentProps, LibraryPreviewProps } from './LibraryPreview';
import './redesign.css';
import './library-preview.css';
import './collections-preview.css';

interface LibraryCollectionsProps extends Omit<LibraryContentProps, 'initialQuery'> {
  actions: CollectionActions;
}

export interface CollectionsPreviewProps extends Omit<LibraryPreviewProps, 'initialQuery'> {
  initialCollection?: CollectionId;
}

export function CollectionsPreview(props: CollectionsPreviewProps & LibraryCollectionsProps) {
  return <LibraryCollections {...props} />;
}

/** Default collections derive their membership from the existing book records. */
export function LibraryCollections({ books, loading, error, onRetry, onOpenBook, actions }: LibraryCollectionsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = parseCollectionId(searchParams.get('collection'));
  const [query, setQuery] = useState('');
  const { sort } = useLibraryPresentation();
  const grid = useRef<HTMLUListElement>(null);
  const returnFocusId = useRef<CollectionId | null>(selected);

  useLayoutEffect(() => {
    if (selected) returnFocusId.current = selected;
    else if (returnFocusId.current) {
      grid.current?.querySelector<HTMLButtonElement>(`[data-collection="${returnFocusId.current}"] button`)?.focus();
    }
  }, [selected]);

  function selectCollection(id: CollectionId | null) {
    setQuery('');
    const next = new URLSearchParams(searchParams);
    if (id) next.set('collection', id);
    else next.delete('collection');
    setSearchParams(next);
  }

  if (selected) {
    return <CollectionDetail key={selected} collection={selected} books={books} loading={loading} error={error}
      onRetry={onRetry} onOpenBook={onOpenBook} onBack={() => selectCollection(null)} initialSort={sort} actions={actions} />;
  }

  const needle = query.trim().toLocaleLowerCase();
  const collections = libraryCollections.filter(id => id.toLocaleLowerCase().includes(needle)).map(id => {
    const matchingBooks = books.filter(book => belongsToCollection(id, book));
    matchingBooks.sort((a, b) => compareLibraryItems(a, b, sort));
    return { id, books: matchingBooks, title: id, author: matchingBooks[0]?.author, addedAt: matchingBooks[0]?.addedAt };
  }).filter(collection => collection.id === 'Favorites' || collection.books.length > 0)
    .sort((a, b) => compareLibraryItems(a, b, sort));

  return <CollectionSearch collection="Collections" query={query} onQueryChange={setQuery}>
    {({ desktopSearch }) => <div className="rj-library-preview">
      {loading ? <p role="status">Loading your collections…</p>
        : error ? <EmptyState title="Your collections couldn’t load" message={error} action={<Button onClick={onRetry}>Try again</Button>} />
        : <>
          <div className="rj-library-search-toolbar mb-6">{desktopSearch}</div>
          {collections.length ? <ul ref={grid} data-view="grid" className="rj-collection-grid" aria-label="Default collections">
            {collections.map(collection => <li key={collection.id} data-collection={collection.id}>
              <article className="rj-collection-card">
                <LibraryMosaic books={collection.books} />
                <button type="button" className="rj-book-title rj-library-title rj-collection-title"
                  onClick={() => selectCollection(collection.id)}>{collection.id}</button>
              </article>
            </li>)}
          </ul> : <EmptyState title="No collections found" message="Try a collection name, such as Finished or Favorites."
            action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>} />}
        </>}
    </div>}
  </CollectionSearch>;
}
