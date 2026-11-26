import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Library, Plus } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { LibraryFilterChips } from '@/components/LibraryControls';
import type { Series } from '@/types';
import { LibraryBookFilters } from './LibraryBookFilters';
import { useLibraryBookFilters } from './useLibraryBookFilters';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import { belongsToCollection, type CollectionId } from '@/lib/libraryCollections';
import { compareLibraryItems, type LibrarySort } from '@/lib/libraryTabs';
import { CollectionBookPicker } from './CollectionBookPicker';
import { CollectionSearch } from './CollectionSearch';
import { LibraryBookList } from './LibraryBookList';
import { LibrarySortControl } from './LibrarySortControl';
import type { LibraryContentProps } from './LibraryPreview';

export interface CollectionActions {
  onCreateBook: (collection: CollectionId, trigger: HTMLElement) => void;
  onAddBook: (collection: CollectionId, bookId: string) => Promise<void>;
}

export function CollectionDetail({ collection, books, loading, error, onRetry, onOpenBook, onBack, initialSort, actions, series }: {
  collection: CollectionId;
  onBack: () => void;
  initialSort: LibrarySort;
  actions: CollectionActions;
  series?: Series[];
} & Omit<LibraryContentProps, 'initialQuery'>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [pickerOpen, setPickerOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const menuAction = useRef<(() => void) | null>(null);
  const needle = query.trim().toLocaleLowerCase();
  const members = useMemo(() => books.filter(book => belongsToCollection(collection, book)), [collection, books]);
  const { filters, chips, options, filteredBooks, toggleFilter, clearFilters } = useLibraryBookFilters(members, series);
  const visible = filteredBooks.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle))
    .sort((a, b) => compareLibraryItems(a, b, sort));
  const candidates = pickerOpen
    ? books.filter(book => book.status !== 'Wishlist' && !belongsToCollection(collection, book)).sort((a, b) => compareLibraryItems(a, b, 'title'))
    : [];

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, []);

  return <section className="rj-redesign rj-library-preview rj-collection-detail">
    <header className="rj-collection-detail-header">
      <div className="rj-collection-title-row">
        <div className="rj-collection-title-group">
          <Button type="button" variant="ghost" size="icon-lg" className="rj-collection-back" aria-label="All collections" onClick={onBack}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>
          <h1 ref={heading} tabIndex={-1}>{collection}</h1>
        </div>
        <DropdownMenu.Root modal={false} onOpenChange={open => { if (open) menuAction.current = null; }}>
          <DropdownMenu.Trigger asChild><Button ref={addTrigger}><Plus aria-hidden="true" />Add book</Button></DropdownMenu.Trigger>
          <DropdownMenu.Content className="rj-add-menu" align="end" sideOffset={6}
            onCloseAutoFocus={event => {
              const action = menuAction.current;
              if (!action) return;
              event.preventDefault();
              menuAction.current = null;
              action();
            }}>
            <DropdownMenu.Item onSelect={() => {
              menuAction.current = () => {
                if (addTrigger.current) actions.onCreateBook(collection, addTrigger.current);
              };
            }}><Plus size={16} aria-hidden="true" />Create new</DropdownMenu.Item>
            <DropdownMenu.Item disabled={loading || Boolean(error)} onSelect={() => {
              menuAction.current = () => setPickerOpen(true);
            }}><Library size={16} aria-hidden="true" />Choose from library</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </header>
    <CollectionSearch collection={collection === 'Favorites' ? 'Favorite books' : `${collection} books`}
      query={query} onQueryChange={setQuery}>
      {({ desktopSearch }) => <>
        <div className="rj-library-books-toolbar rj-collection-book-tools">
          <div className="rj-library-search-toolbar">{desktopSearch}</div>
          <LibrarySortControl value={sort} onChange={setSort} />
          <LibraryBookFilters filters={filters} options={options} count={chips.length} onToggle={toggleFilter}
            onClear={() => clearFilters()} />
        </div>
        {chips.length > 0 && <div className="mb-4">
          <LibraryFilterChips chips={chips.map(chip => ({ label: chip.label, onRemove: () => clearFilters(chip.keys) }))}
            onClear={() => clearFilters()} />
        </div>}
        {loading ? <p role="status">Loading books…</p>
          : error ? <EmptyState title="Your collection couldn’t load" message={error} action={<Button onClick={onRetry}>Try again</Button>} />
          : visible.length ? <LibraryBookList books={visible} onOpenBook={onOpenBook} />
          : needle || chips.length > 0 ? <EmptyState title="No books found" message="Try another search or clear the filters."
            action={<Button variant="outline" onClick={() => { setQuery(''); clearFilters(); }}>Clear search and filters</Button>} />
          : <EmptyState title="No books here yet" message="Use Add book to add to this collection." />}
      </>}
    </CollectionSearch>
    {pickerOpen && <CollectionBookPicker collection={collection} books={candidates} onAdd={id => actions.onAddBook(collection, id)}
      onClose={() => setPickerOpen(false)}
      onCloseAutoFocus={event => { event.preventDefault(); addTrigger.current?.focus(); }} />}
  </section>;
}
