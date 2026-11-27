import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import type { useCustomCollections } from '@/hooks/useCustomCollections';
import type { CollectionMembership } from '@/lib/customCollections';
import { compareLibraryItems } from '@/lib/libraryTabs';
import { belongsToCollection, compareCollectionNames, formatCollectionBookCount, isCustomCollectionId, libraryCollections, parseCollectionId, type CollectionId } from '@/lib/libraryCollections';
import { CollectionDetail, type CollectionActions } from './CollectionDetail';
import { LibraryMosaic } from './LibraryMosaic';
import { CollectionSearch } from './CollectionSearch';
import { useLibraryPresentation } from './LibraryNavigation';
import type { LibraryContentProps, LibraryPreviewBook, LibraryPreviewProps } from './LibraryPreview';
import './redesign.css';
import './library-preview.css';
import './collections-preview.css';

import type { Series } from '@/types';
import { filterKeys } from '@/lib/libraryBookFilters';

interface LibraryCollectionsProps extends Omit<LibraryContentProps, 'initialQuery'> {
  actions: CollectionActions;
  custom?: ReturnType<typeof useCustomCollections>;
  series?: Series[];
}

export interface CollectionsPreviewProps extends Omit<LibraryPreviewProps, 'initialQuery'> {
  initialCollection?: CollectionId;
}

export function CollectionsPreview(props: CollectionsPreviewProps & LibraryCollectionsProps) {
  return <LibraryCollections {...props} />;
}

function CollectionCards({ collections, label, onSelect, showBookCount = true }: {
  collections: { id: string; title: string; books: LibraryPreviewBook[] }[];
  label: string;
  showBookCount?: boolean;
  onSelect: (id: string) => void;
}) {
  return <ul data-view="grid" className="rj-collection-grid" aria-label={label}>
    {collections.map(collection => <li key={collection.id}>
      <article className="rj-collection-card">
        <LibraryMosaic books={collection.books} />
        <button type="button" data-collection={collection.id} className="rj-book-title rj-library-title rj-collection-title"
          onClick={() => onSelect(collection.id)}>{collection.title}</button>
        {showBookCount && <p className="rj-muted rj-collection-count">{formatCollectionBookCount(collection.books.length)}</p>}
      </article>
    </li>)}
  </ul>;
}

export function LibraryCollections({ books, loading, error, onRetry, onOpenBook, actions, series, custom }: LibraryCollectionsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hash } = useLocation();
  const requested = searchParams.get('collection');
  const builtIn = parseCollectionId(requested);
  const customId = requested && isCustomCollectionId(requested) ? requested.toLowerCase() : null;
  const selectedCustom = custom?.collections.find(collection => collection.id === customId);
  const [query, setQuery] = useState('');
  const { sort } = useLibraryPresentation();
  const overview = useRef<HTMLDivElement>(null);
  const myCollections = useRef<HTMLHeadingElement>(null);
  const unavailable = useRef<HTMLHeadingElement>(null);
  const returnFocusId = useRef<string | null>(null);
  const membersByCollection = useMemo(() => {
    const byCollection = new Map<string, Map<string, CollectionMembership>>();
    for (const membership of custom?.memberships ?? []) {
      const members = byCollection.get(membership.collection_id) ?? new Map<string, CollectionMembership>();
      members.set(membership.book_id, membership);
      byCollection.set(membership.collection_id, members);
    }
    return byCollection;
  }, [custom?.memberships]);
  const openingUnavailable = Boolean(requested !== null && !builtIn && !selectedCustom && (!customId || !custom?.loading && !custom?.error));

  useLayoutEffect(() => {
    if (requested !== null) {
      returnFocusId.current = builtIn ?? customId;
      if (openingUnavailable) unavailable.current?.focus();
      return;
    }
    if (hash === '#my-collections') {
      myCollections.current?.focus();
      returnFocusId.current = null;
      return;
    }
    if (!returnFocusId.current) return;
    const card = overview.current?.querySelector<HTMLButtonElement>(`[data-collection="${returnFocusId.current}"]`);
    (card ?? myCollections.current ?? overview.current)?.focus();
    returnFocusId.current = null;
  }, [requested, builtIn, customId, hash, openingUnavailable]);

  function selectCollection(id: string | null, replace = false) {
    setQuery('');
    returnFocusId.current = requested !== null ? builtIn ?? customId ?? '' : null;
    const next = new URLSearchParams(searchParams);
    filterKeys.forEach(key => next.delete(key));
    next.delete('filters');
    if (id) next.set('collection', id);
    else next.delete('collection');
    if (requested !== null && !id && !returnFocusId.current) returnFocusId.current = 'overview';
    setSearchParams(next, { replace });
  }

  function collectionBooks(id: string) {
    const memberships = membersByCollection.get(id);
    if (!memberships) return [];
    return books.filter(book => memberships.has(book.id)).sort((a, b) => {
      const left = memberships.get(a.id);
      const right = memberships.get(b.id);
      const byPosition = (left?.position ?? Number.MAX_SAFE_INTEGER) - (right?.position ?? Number.MAX_SAFE_INTEGER);
      return byPosition || (left?.added_at ?? '').localeCompare(right?.added_at ?? '') || compareLibraryItems(a, b, 'title');
    });
  }

  if (builtIn) {
    return <CollectionDetail key={builtIn} collection={builtIn}
      books={books} loading={loading} error={error} onRetry={onRetry} onOpenBook={onOpenBook}
      onBack={() => selectCollection(null)} initialSort={sort} actions={actions} series={series} />;
  }

  if (selectedCustom && custom) {
    return <CollectionDetail key={selectedCustom.id} collection={selectedCustom}
      customBooks={collectionBooks(selectedCustom.id)} books={books} loading={loading} error={error}
      onRetry={onRetry} onOpenBook={onOpenBook} onBack={() => selectCollection(null)} initialSort={sort} actions={actions} series={series}
      onEdit={(name, description) => custom.save(name, description, selectedCustom.id)}
      onDelete={async () => { await custom.remove(selectedCustom.id); selectCollection(null, true); }}
      onSaveBooks={changes => custom.saveBooks(selectedCustom.id, changes)}
      onSetMembership={(id, included) => custom.setMembership(selectedCustom.id, id, included)} />;
  }

  if (requested !== null) {
    return <section className="rj-redesign rj-library-preview rj-collection-unavailable">
      {customId && custom?.loading ? <p role="status">Loading collection…</p>
        : customId && custom?.error ? <>
          <p role="alert">This collection couldn’t load.</p>
          <Button onClick={custom.retry}>Try again</Button>
        </> : <h1 ref={unavailable} tabIndex={-1}>Collection unavailable</h1>}
      <Button variant="outline" onClick={() => selectCollection(null, true)}>All collections</Button>
    </section>;
  }

  const needle = query.trim().toLocaleLowerCase();
  const collections = libraryCollections.filter(id => id.toLocaleLowerCase().includes(needle)).map(id => {
    const matchingBooks = books.filter(book => belongsToCollection(id, book));
    matchingBooks.sort((a, b) => compareLibraryItems(a, b, sort));
    return { id, books: matchingBooks, title: id, author: matchingBooks[0]?.author, addedAt: matchingBooks[0]?.addedAt };
  }).filter(collection => collection.id === 'Favorites' || collection.books.length > 0)
    .sort((a, b) => compareLibraryItems(a, b, sort));
  const customCards = (custom?.collections ?? []).filter(collection => collection.name.toLocaleLowerCase().includes(needle))
    .sort(compareCollectionNames).map(collection => ({
      id: collection.id,
      title: collection.name,
      books: collectionBooks(collection.id),
    }));
  const noMatches = Boolean(needle && !collections.length && !customCards.length && !loading && !error && !custom?.error && !custom?.loading);

  return <CollectionSearch collection="Collections" query={query} onQueryChange={setQuery}>
    {({ desktopSearch }) => <div ref={overview} tabIndex={-1} className="rj-library-preview">
      <div className="rj-library-search-toolbar mb-6">{desktopSearch}</div>
      {loading ? <p role="status">Loading default collections…</p>
        : error ? <EmptyState title="Default collections couldn’t load" message={error} action={<Button onClick={onRetry}>Try again</Button>} />
        : collections.length > 0 && <CollectionCards collections={collections} label="Default collections" onSelect={selectCollection} />}
      {custom && <section aria-labelledby="my-collections" className="rj-your-collections">
        <header>
          <h2 id="my-collections" tabIndex={-1} ref={myCollections} className="text-base font-semibold">Your collections</h2>
        </header>
        {custom.loading ? <p role="status">Loading your collections…</p>
          : custom.error ? <div>
            <p role="alert">Your custom collections couldn’t load.</p>
            <Button onClick={custom.retry}>Try again</Button>
          </div>
          : customCards.length ? <CollectionCards collections={customCards} label="Your collections" onSelect={selectCollection} showBookCount={!loading && !error} />
            : !needle && <p className="rj-muted">Use New collection in the Add menu to make your first collection.</p>}
      </section>}
      {noMatches && <EmptyState title="No collections found" message="Try another collection name."
        action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>} />}
    </div>}
  </CollectionSearch>;
}
