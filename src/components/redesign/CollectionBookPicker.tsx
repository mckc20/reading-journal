import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { runBulkOperation } from '@/lib/bulkManagement';
import type { CollectionId } from '@/lib/libraryCollections';
import { CollectionBookSelection } from './CollectionBookSelection';
import { CollectionDialogContent } from './CollectionDialogs';
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
    <CollectionDialogContent className="rj-redesign sm:max-w-lg" showCloseButton={!pending}
      onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader>
        <DialogTitle asChild info={collection === 'Favorites'
          ? 'Selected books will be marked as favorites.'
          : collection === 'Wishlist'
            ? 'Selected books will move to your Wishlist and leave the Books list. Their journal and reading data will be kept.'
            : `Selected books will have their reading status set to ${collection}.`}><h2>Choose from library</h2></DialogTitle>
      </DialogHeader>
      <CollectionBookSelection books={books} selected={selected} onSelectedChange={setSelected} query={query} onQueryChange={setQuery}
        disabled={pending} />
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <DialogFooter className="rj-collection-picker-footer">
        <Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button disabled={pending || !toAdd.length} onClick={() => void addSelected()}>
          {pending ? 'Adding…' : toAdd.length ? `Add ${toAdd.length} ${toAdd.length === 1 ? 'book' : 'books'}` : 'Add books'}
        </Button>
      </DialogFooter>
    </CollectionDialogContent>
  </Dialog>;
}
