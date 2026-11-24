import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookCover } from '@/components/reading-journal/BookCover';
import { runBulkOperation } from '@/lib/bulkManagement';
import type { CollectionId } from '@/lib/libraryCollections';
import type { LibraryPreviewBook } from './LibraryPreview';

export function CollectionBookPicker({ collection, books, onAdd, onClose, onCloseAutoFocus }: {
  collection: CollectionId;
  books: LibraryPreviewBook[];
  onAdd: (id: string) => Promise<void>;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const visible = books.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(needle));
  const toAdd = books.filter(book => selected.has(book.id));

  async function addSelected() {
    if (pending || !toAdd.length) return;
    setPending(true);
    setError('');
    const result = await runBulkOperation(toAdd, book => ({ id: book.id, label: book.title }), book => onAdd(book.id));
    if (!result.failures.length) {
      onClose();
      return;
    }
    setSelected(new Set(result.failures.map(failure => failure.id)));
    const names = result.failures.map(failure => failure.label).join(', ');
    setError(`Couldn’t add ${names}. You can try again.`);
    setPending(false);
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent className="rj-redesign rj-collection-picker sm:max-w-lg" showCloseButton={!pending}
      onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader>
        <DialogTitle asChild><h2>Choose from library</h2></DialogTitle>
        <DialogDescription>{collection === 'Favorites'
          ? 'Selected books will be marked as favorites.'
          : collection === 'Wishlist'
            ? 'Selected books will move to your Wishlist and leave the Books list. Their journal and reading data will be kept.'
            : `Selected books will have their reading status set to ${collection}.`}</DialogDescription>
      </DialogHeader>
      <Input aria-label="Search library books" type="search" placeholder="Search by title or author" value={query}
        onChange={event => setQuery(event.target.value)} />
      {visible.length ? <ul className="rj-collection-picker-list" aria-label="Available library books">
        {visible.map(book => <li key={book.id}>
          <label>
            <input type="checkbox" checked={selected.has(book.id)} disabled={pending} onChange={event => {
              const checked = event.target.checked;
              setSelected(current => {
                const next = new Set(current);
                if (checked) next.add(book.id);
                else next.delete(book.id);
                return next;
              });
            }} />
            <BookCover src={book.cover} title={book.title} className="rj-collection-picker-cover" decorative />
            <span><span className="rj-book-title">{book.title}</span><span className="rj-muted">{book.author}</span></span>
          </label>
        </li>)}
      </ul> : <p className="rj-muted">{books.length ? 'No matching books.' : 'All eligible library books are already in this collection.'}</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button disabled={pending || !toAdd.length} onClick={() => void addSelected()}>
          {pending ? 'Adding…' : toAdd.length ? `Add ${toAdd.length} ${toAdd.length === 1 ? 'book' : 'books'}` : 'Add books'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
