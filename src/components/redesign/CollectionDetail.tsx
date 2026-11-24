import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Library, Plus, SlidersHorizontal } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import { belongsToCollection, type CollectionId } from '@/lib/libraryCollections';
import { compareLibraryItems, type LibrarySort } from '@/lib/libraryTabs';
import { CollectionBookPicker } from './CollectionBookPicker';
import { CollectionSearch } from './CollectionSearch';
import { LibraryBookList } from './LibraryBookList';
import { LibrarySortControl } from './LibrarySortControl';
import type { LibraryContentProps } from './LibraryPreview';

const filterFields = [{ key: 'format', label: 'Format' }, { key: 'language', label: 'Language' }, { key: 'status', label: 'Reading status' }] as const;
type Filters = Partial<Record<(typeof filterFields)[number]['key'], string>>;

export interface CollectionActions {
  onCreateBook: (collection: CollectionId, trigger: HTMLElement) => void;
  onAddBook: (collection: CollectionId, bookId: string) => Promise<void>;
}

export function CollectionDetail({ collection, books, loading, error, onRetry, onOpenBook, onBack, initialSort, actions }: {
  collection: CollectionId;
  onBack: () => void;
  initialSort: LibrarySort;
  actions: CollectionActions;
} & Omit<LibraryContentProps, 'initialQuery'>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [filters, setFilters] = useState<Filters>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const menuAction = useRef<(() => void) | null>(null);
  const needle = query.trim().toLocaleLowerCase();
  const members = books.filter(book => belongsToCollection(collection, book));
  const fields = filterFields.filter(field => field.key !== 'status' || collection === 'Favorites').map(field => ({
    ...field, options: Array.from(new Set(members.flatMap(book => book[field.key] ?? []))).sort(),
  }));
  const filterCount = filterFields.filter(field => filters[field.key]).length;
  const visible = members.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle) &&
    filterFields.every(field => !filters[field.key] || filters[field.key] === book[field.key]))
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
      <Button type="button" variant="ghost" className="rj-collection-back" onClick={onBack}><ArrowLeft aria-hidden="true" />All collections</Button>
      <div className="rj-collection-title-row">
        <h1 ref={heading} tabIndex={-1}>{collection}</h1>
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
          <Dialog>
            <DialogTrigger asChild><Button type="button" variant="outline">
              <SlidersHorizontal aria-hidden="true" />Filter{filterCount ? ` (${filterCount})` : ''}
            </Button></DialogTrigger>
            <DialogContent className="rj-redesign rj-collection-filter-dialog">
              <DialogHeader>
                <DialogTitle>Filter books</DialogTitle>
                <DialogDescription>Filter the books in {collection}.</DialogDescription>
              </DialogHeader>
              {fields.map(field => <label className="rj-library-sort" key={field.key}>
                <span>{field.label}</span>
                <select value={filters[field.key] ?? ''} onChange={event => setFilters({ ...filters, [field.key]: event.target.value })}>
                  <option value="">Any</option>
                  {Array.from(new Set([...field.options, ...(filters[field.key] ? [filters[field.key]] : [])]))
                    .map(option => <option key={option}>{option}</option>)}
                </select>
              </label>)}
              <DialogFooter>
                <Button variant="outline" onClick={() => setFilters({})}>Clear filters</Button>
                <DialogClose asChild><Button>Done</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {loading ? <p role="status">Loading books…</p>
          : error ? <EmptyState title="Your collection couldn’t load" message={error} action={<Button onClick={onRetry}>Try again</Button>} />
          : visible.length ? <LibraryBookList books={visible} onOpenBook={onOpenBook} />
          : needle || filterCount ? <EmptyState title="No books found" message="Try another search or clear the filters."
            action={<Button variant="outline" onClick={() => { setQuery(''); setFilters({}); }}>Clear search and filters</Button>} />
          : <EmptyState title="No books here yet" message="Use Add book to add to this collection." />}
      </>}
    </CollectionSearch>
    {pickerOpen && <CollectionBookPicker collection={collection} books={candidates} onAdd={id => actions.onAddBook(collection, id)}
      onClose={() => setPickerOpen(false)}
      onCloseAutoFocus={event => { event.preventDefault(); addTrigger.current?.focus(); }} />}
  </section>;
}
