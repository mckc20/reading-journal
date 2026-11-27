import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Library, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { LibraryFilterChips } from '@/components/LibraryControls';
import type { Series } from '@/types';
import { LibraryBookFilters } from './LibraryBookFilters';
import { useLibraryBookFilters } from './useLibraryBookFilters';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import type { CollectionBookChanges, CustomCollection } from '@/lib/customCollections';
import { belongsToCollection, formatCollectionBookCount, type CollectionId } from '@/lib/libraryCollections';
import { compareLibraryItems, librarySorts, type LibrarySort } from '@/lib/libraryTabs';
import { collectionDialogFocus, ConfirmCollectionChange } from './CollectionDialogs';
import { CollectionBookPicker } from './CollectionBookPicker';
import { CollectionSearch } from './CollectionSearch';
import { LibraryBookList } from './LibraryBookList';
import type { OpenCollectionBookForm } from './CollectionBooksField';
import { EditCollectionDialog } from './EditCollectionDialog';
import { LibrarySortControl } from './LibrarySortControl';
import type { LibraryContentProps, LibraryPreviewBook } from './LibraryPreview';

export interface CollectionActions {
  onCreateBook: (collection: CollectionId, trigger: HTMLElement) => void;
  onCreateCustomBook?: OpenCollectionBookForm;
  onAddBook: (collection: CollectionId, bookId: string) => Promise<void>;
}

const noBooks: LibraryPreviewBook[] = [];
const customSorts = [{ value: 'custom', label: 'Custom order' }, ...librarySorts] as const;
type CollectionSort = (typeof customSorts)[number]['value'];

export function CollectionDetail({
  collection, customBooks = noBooks, books, loading, error, onRetry, onOpenBook, onBack,
  initialSort, actions, series, onEdit, onDelete, onSetMembership, onSaveBooks,
}: {
  collection: CollectionId | CustomCollection;
  customBooks?: LibraryPreviewBook[];
  onEdit?: (name: string, description: string) => Promise<CustomCollection>;
  onDelete?: () => Promise<void>;
  onSetMembership?: (bookId: string, included: boolean) => Promise<void>;
  onSaveBooks?: (changes: CollectionBookChanges) => Promise<void>;
  onBack: () => void;
  initialSort: LibrarySort;
  actions: CollectionActions;
  series?: Series[];
} & Omit<LibraryContentProps, 'initialQuery'>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CollectionSort>(typeof collection === 'string' ? initialSort : 'custom');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const collectionActionsTrigger = useRef<HTMLButtonElement>(null);
  const menuAction = useRef<(() => void) | null>(null);
  const needle = query.trim().toLocaleLowerCase();
  const builtIn = typeof collection === 'string' ? collection : undefined;
  const title = typeof collection === 'string' ? collection : collection.name;
  const members = useMemo(() => builtIn ? books.filter(book => belongsToCollection(builtIn, book)) : customBooks,
    [builtIn, books, customBooks]);
  const { filters, chips, options, filteredBooks, toggleFilter, clearFilters } = useLibraryBookFilters(members, series);
  const visible = filteredBooks.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle));
  if (sort !== 'custom') visible.sort((a, b) => compareLibraryItems(a, b, sort));
  const candidates = pickerOpen && builtIn
    ? books.filter(book => book.status !== 'Wishlist' && !belongsToCollection(builtIn, book))
      .sort((a, b) => compareLibraryItems(a, b, 'title'))
    : [];

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, []);

  function handleMenuCloseAutoFocus(event: Event) {
    const action = menuAction.current;
    if (!action) return;
    event.preventDefault();
    menuAction.current = null;
    action();
  }

  return <section className="rj-redesign rj-library-preview rj-collection-detail" aria-labelledby={headingId}>
    <header className="rj-collection-detail-header">
      <div className={builtIn ? "rj-collection-title-row" : "rj-collection-title-row rj-custom-collection-title-row"}>
        <div className="rj-collection-title-group">
          <Button type="button" variant="ghost" size="icon-lg" className="rj-collection-back" aria-label="All collections" onClick={onBack}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="rj-collection-heading">
            <h1 id={headingId} ref={heading} tabIndex={-1}>{title}</h1>
            {!loading && !error && <p className="rj-muted rj-collection-count">{formatCollectionBookCount(members.length)}</p>}
            {typeof collection !== 'string' && collection.description && <p className="rj-collection-description">{collection.description}</p>}
          </div>
        </div>
        <div className="rj-collection-title-actions">
          {builtIn && <DropdownMenu.Root modal={false} onOpenChange={open => { if (open) menuAction.current = null; }}>
            <DropdownMenu.Trigger asChild><Button ref={addTrigger}><Plus aria-hidden="true" />Add book</Button></DropdownMenu.Trigger>
            <DropdownMenu.Content className="rj-add-menu" align="end" sideOffset={6} onCloseAutoFocus={handleMenuCloseAutoFocus}>
              <DropdownMenu.Item onSelect={() => {
                menuAction.current = () => {
                  if (addTrigger.current) actions.onCreateBook(builtIn, addTrigger.current);
                };
              }}><Plus size={16} aria-hidden="true" />Create new</DropdownMenu.Item>
              <DropdownMenu.Item disabled={loading || Boolean(error)} onSelect={() => {
                menuAction.current = () => setPickerOpen(true);
              }}><Library size={16} aria-hidden="true" />Choose from library</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>}
          {((onEdit && onSaveBooks) || onDelete) && <DropdownMenu.Root modal={false} onOpenChange={open => { if (open) menuAction.current = null; }}>
            <DropdownMenu.Trigger asChild>
              <Button ref={collectionActionsTrigger} type="button" variant="ghost" size="icon-lg" className="size-11"
                aria-label="More collection actions">
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="rj-add-menu" align="end" sideOffset={6} onCloseAutoFocus={handleMenuCloseAutoFocus}>
                {onEdit && onSaveBooks && <DropdownMenu.Item onSelect={() => { menuAction.current = () => setDialog('edit'); }}>
                  <Pencil size={16} aria-hidden="true" />Edit collection
                </DropdownMenu.Item>}
                {onDelete && <DropdownMenu.Item className="text-destructive" onSelect={() => { menuAction.current = () => setDialog('delete'); }}>
                  <Trash2 size={16} aria-hidden="true" />Delete collection
                </DropdownMenu.Item>}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>}
        </div>
      </div>
    </header>
    <CollectionSearch collection={collection === 'Favorites' ? 'Favorite books' : `${title} books`}
      query={query} onQueryChange={setQuery}>
      {({ desktopSearch }) => <>
        <div className="rj-library-books-toolbar rj-collection-book-tools">
          <div className="rj-library-search-toolbar">{desktopSearch}</div>
          <LibrarySortControl value={sort} onChange={setSort} options={builtIn ? librarySorts : customSorts} />
          <LibraryBookFilters filters={filters} options={options} count={chips.length} onToggle={toggleFilter}
            onClear={() => clearFilters()} />
        </div>
        {chips.length > 0 && <div className="mb-4">
          <LibraryFilterChips chips={chips.map(chip => ({ label: chip.label, onRemove: () => clearFilters(chip.keys) }))}
            onClear={() => clearFilters()} />
        </div>}
        {loading ? <p role="status">Loading books…</p>
          : error ? <EmptyState title="Your collection couldn’t load" message={<span role="alert">{error}</span>}
            action={<Button onClick={onRetry}>Try again</Button>} />
          : visible.length ? <div className="rj-library-books-panel">
            <LibraryBookList books={visible} onOpenBook={onOpenBook} />
          </div>
          : needle || chips.length > 0 ? <EmptyState title="No books found" message="Try another search or clear the filters."
            action={<Button variant="outline" onClick={() => { setQuery(''); clearFilters(); }}>Clear search and filters</Button>} />
          : <EmptyState title="No books here yet" message={builtIn
            ? "Use Add book to add to this collection."
            : "Use Edit collection in the collection actions menu to add books."} />}
      </>}
    </CollectionSearch>
    {pickerOpen && builtIn && <CollectionBookPicker collection={builtIn}
      books={candidates} onAdd={id => actions.onAddBook(builtIn, id)}
      onClose={() => setPickerOpen(false)}
      onCloseAutoFocus={collectionDialogFocus(addTrigger.current, heading.current)} />}
    {typeof collection !== 'string' && onEdit && onSetMembership && onSaveBooks &&
      <EditCollectionDialog open={dialog === 'edit'} collection={collection} books={books}
        memberBooks={customBooks} loading={loading} error={error} onRetry={onRetry}
        onSaveDetails={onEdit} onSetMembership={onSetMembership} onSaveBooks={onSaveBooks} onCreateBook={actions.onCreateCustomBook}
        onClose={() => setDialog(null)} onCloseAutoFocus={collectionDialogFocus(collectionActionsTrigger.current, heading.current)} />}
    {dialog === 'delete' && onDelete && <ConfirmCollectionChange title="Delete collection?"
      description={`“${title}” will be deleted. Its books will stay in your library or wishlist.`}
      action="Delete collection" failure="Couldn’t delete this collection. Try again." onConfirm={onDelete}
      onClose={() => setDialog(null)} onCloseAutoFocus={collectionDialogFocus(collectionActionsTrigger.current, heading.current)} />}
  </section>;
}
