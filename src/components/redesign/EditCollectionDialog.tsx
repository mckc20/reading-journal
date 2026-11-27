import { useState, type FormEvent } from 'react';
import { LibraryBig } from 'lucide-react';
import SaveCancelBar from '@/components/SaveCancelBar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { Book } from '@/types';
import type { CollectionBookChanges, CustomCollection } from '@/lib/customCollections';
import { CollectionFields, type CollectionDetailsFields } from './CollectionDialogs';
import { CollectionBooksField, useCollectionBookCreation, type OpenCollectionBookForm } from './CollectionBooksField';
import { CreationDialogContent } from './CreationDialogContent';
import type { LibraryPreviewBook } from './LibraryPreview';

type BookReference = Pick<Book, 'id' | 'title'>;

export function EditCollectionDialog({
  open, collection, books, memberBooks, loading, error, onRetry, onSaveDetails, onSetMembership, onSaveBooks, onCreateBook, onClose, onCloseAutoFocus,
}: {
  open: boolean;
  collection: CustomCollection;
  books: LibraryPreviewBook[];
  memberBooks: LibraryPreviewBook[];
  loading?: boolean;
  error?: string;
  onRetry: () => void;
  onSaveDetails: (name: string, description: string) => Promise<CustomCollection>;
  onSetMembership: (id: string, included: boolean) => Promise<void>;
  onSaveBooks: (changes: CollectionBookChanges) => Promise<void>;
  onCreateBook?: OpenCollectionBookForm;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [draft, setDraft] = useState<CollectionDetailsFields>();
  const [detailsError, setDetailsError] = useState('');
  const [query, setQuery] = useState('');
  const [changes, setChanges] = useState(new Map<string, boolean>());
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>();
  const [booksError, setBooksError] = useState('');
  const [failedLinks, setFailedLinks] = useState<BookReference[]>([]);
  const [coverWarnings, setCoverWarnings] = useState<{ id: string; message: string }[]>([]);
  const pending = saving || linking;
  const details = draft ?? { name: collection.name, description: collection.description ?? '' };
  const detailsChanged = details.name.trim() !== collection.name || details.description.trim() !== (collection.description ?? '');
  const memberIds = new Set(memberBooks.map(book => book.id));
  const selected = new Set(memberIds);
  for (const [id, included] of changes) {
    if (included) selected.add(id);
    else selected.delete(id);
  }
  const orderedIds = [...new Set([...(draftOrder ?? []), ...selected])].filter(id => selected.has(id));
  const booksById = new Map(books.map(book => [book.id, book]));
  const selectedBooks = orderedIds.flatMap(id => booksById.get(id) ?? []);
  const addedIds = orderedIds.filter(id => !memberIds.has(id));
  const removedIds = [...memberIds].filter(id => !selected.has(id));
  const booksChanged = orderedIds.length !== memberBooks.length || orderedIds.some((id, index) => id !== memberBooks[index]?.id);
  const canSave = (detailsChanged || booksChanged) && !(booksChanged && (loading || error));

  function toggleBook(id: string, included: boolean) {
    setChanges(current => {
      const next = new Map(current);
      if (included === memberIds.has(id)) next.delete(id);
      else next.set(id, included);
      return next;
    });
    setBooksError('');
  }

  function close() {
    setDraft(undefined);
    setDetailsError('');
    setQuery('');
    setChanges(new Map());
    setDraftOrder(undefined);
    setBooksError('');
    onClose();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canSave) return;
    setSaving(true);
    setBooksError('');
    setDetailsError('');
    if (detailsChanged) {
      try {
        await onSaveDetails(details.name, details.description);
        setDraft(undefined);
      } catch (cause) {
        setDetailsError(cause instanceof Error ? cause.message : 'Couldn’t save this collection. Try again.');
        setSaving(false);
        return;
      }
    }
    try {
      if (booksChanged) await onSaveBooks({ orderedIds, addedIds, removedIds });
      close();
    } catch {
      setBooksError('Couldn’t save the collection’s books. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function linkCreatedBook(book: BookReference) {
    setLinking(true);
    try {
      await onSetMembership(book.id, true);
      setFailedLinks(current => current.filter(item => item.id !== book.id));
    } catch {
      setFailedLinks(current => [...current.filter(item => item.id !== book.id), book]);
    } finally {
      setLinking(false);
    }
  }

  const bookCreation = useCollectionBookCreation({
    openBook: onCreateBook,
    onCreated: (book, warning) => {
      if (warning) setCoverWarnings(current => [...current, { id: book.id, message: warning }]);
      void linkCreatedBook(book);
    },
    onCloseAutoFocus,
    disabled: pending,
  });

  return <Dialog open={open && !bookCreation.creating} onOpenChange={next => { if (!next && !pending) close(); }}>
    <CreationDialogContent className="rj-edit-collection-dialog" title="Edit collection" icon={LibraryBig}
      description="Update collection details, choose books, or drag selected books to put them in order."
      fitVisualViewport closeDisabled={pending} onOpenAutoFocus={bookCreation.onOpenAutoFocus}
      onCloseAutoFocus={bookCreation.onCloseAutoFocus}>
      <form className="rj-book-form" onSubmit={event => void save(event)} noValidate>
        <div className="rj-book-form-scroll grid min-w-0 content-start gap-5">
          <CollectionFields details={details} onChange={setDraft} readOnly={pending} />
          <CollectionBooksField books={books} selectedBooks={selectedBooks} selected={selected}
            query={query} onQueryChange={setQuery} onToggle={toggleBook}
            onReorder={ids => {
              setDraftOrder(ids);
              setBooksError('');
            }}
            onCreateBook={bookCreation.createBook} createTrigger={bookCreation.createTrigger}
            loading={loading} error={error} onRetry={onRetry} disabled={pending}>
            {linking && <p role="status">Adding book to collection…</p>}
            {coverWarnings.map(warning => <p key={warning.id} role="status" className="break-words">{warning.message}</p>)}
            {failedLinks.map(book => <div key={book.id} className="flex flex-wrap items-center gap-2">
              <p role="alert" className="break-words text-destructive">“{book.title}” was saved, but couldn’t be linked to this collection.</p>
              <Button type="button" variant="outline" disabled={pending} onClick={() => void linkCreatedBook(book)}>Retry linking</Button>
            </div>)}
          </CollectionBooksField>
        </div>
        <SaveCancelBar mode="creation-dialog" onCancel={close}
          saving={saving} cancelDisabled={linking} saveDisabled={pending || !canSave}
          saveLabel={booksError ? 'Retry changes' : 'Save changes'}>
          {detailsError && <p role="alert" className="text-destructive [overflow-wrap:anywhere]">{detailsError}</p>}
          {booksError && <p role="alert" className="text-destructive">{booksError}</p>}
        </SaveCancelBar>
      </form>
    </CreationDialogContent>
  </Dialog>;
}
