import { useId, useMemo, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { LibraryBig } from "lucide-react";
import SaveCancelBar from "@/components/SaveCancelBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDialogVisualViewport } from "@/hooks/useDialogVisualViewport";
import { toLibraryBook } from "@/pages/library/useLibraryBooks";
import { CollectionBooksField, useCollectionBookCreation, type OpenCollectionBookForm } from "./CollectionBooksField";
import { CreationDialogContent } from "./CreationDialogContent";
import type { LibraryPreviewBook } from "./LibraryPreview";
import type { CustomCollection } from "@/lib/customCollections";
import "./collections-preview.css";

export function CollectionDialogContent({ className, ...props }: ComponentProps<typeof DialogContent>) {
  const dialog = useDialogVisualViewport();

  return <DialogContent {...props} ref={dialog} className={`rj-custom-collection-dialog ${className ?? ""}`} />;
}

export function collectionDialogFocus(trigger: HTMLElement | null, fallback?: HTMLElement | null) {
  return (event: Event) => {
    event.preventDefault();
    if (trigger?.isConnected) trigger.focus();
    else fallback?.focus();
  };
}

export interface CollectionDetailsFields {
  name: string;
  description: string;
}

export function CollectionFields({ details, onChange, readOnly }: {
  details: CollectionDetailsFields;
  onChange: (details: CollectionDetailsFields) => void;
  readOnly: boolean;
}) {
  const nameId = useId();
  const descriptionId = useId();
  return <>
    <div className="grid gap-2">
      <label htmlFor={nameId}>Name</label>
      <Input id={nameId} required value={details.name} readOnly={readOnly}
        onChange={event => onChange({ ...details, name: event.target.value })} />
    </div>
    <div className="grid gap-2">
      <label htmlFor={descriptionId}>Description (optional)</label>
      <Textarea id={descriptionId} value={details.description} readOnly={readOnly}
        onChange={event => onChange({ ...details, description: event.target.value })} />
    </div>
  </>;
}

interface InitialCollectionBooks {
  books: LibraryPreviewBook[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onSaveOrder: (collectionId: string, bookIds: string[]) => Promise<void>;
  onOpen: (collectionId: string) => void;
}

export function CollectionFormDialog({ initialBooks, onCreateBook, onSave, onClose, onCloseAutoFocus }: {
  initialBooks: InitialCollectionBooks;
  onCreateBook?: OpenCollectionBookForm;
  onSave: (name: string, description: string) => Promise<CustomCollection>;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [details, setDetails] = useState<CollectionDetailsFields>({ name: "", description: "" });
  const [query, setQuery] = useState("");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [newBooks, setNewBooks] = useState<LibraryPreviewBook[]>([]);
  const [coverWarnings, setCoverWarnings] = useState<{ id: string; message: string }[]>([]);
  const [created, setCreated] = useState<CustomCollection>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const selected = new Set(orderedIds);
  const booksById = useMemo(() => new Map([...newBooks, ...initialBooks.books].map(book => [book.id, book])),
    [newBooks, initialBooks.books]);
  const books = useMemo(() => [...booksById.values()], [booksById]);
  const selectedBooks = orderedIds.flatMap(id => booksById.get(id) ?? []);

  function toggleBook(id: string, included: boolean) {
    setOrderedIds(ids => {
      if (!included) return ids.filter(bookId => bookId !== id);
      return ids.includes(id) ? ids : [...ids, id];
    });
  }

  function close() {
    if (created) initialBooks.onOpen(created.id);
    onClose();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const saved = created ?? await onSave(details.name, details.description);
      if (selectedBooks.length) {
        try {
          await initialBooks.onSaveOrder(saved.id, selectedBooks.map(book => book.id));
        } catch {
          setCreated(saved);
          setError("Collection created, but the books couldn’t be saved. Try again.");
          return;
        }
      }
      initialBooks.onOpen(saved.id);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t save this collection. Try again.");
    } finally {
      setPending(false);
    }
  }

  const bookCreation = useCollectionBookCreation({
    openBook: onCreateBook,
    onCreated: (book, warning) => {
      setNewBooks(current => [...current, toLibraryBook(book)]);
      toggleBook(book.id, true);
      if (warning) setCoverWarnings(current => [...current, { id: book.id, message: warning }]);
    },
    onCloseAutoFocus,
    disabled: pending,
  });

  const descriptionInfo = created ? `“${created.name}” is ready. You can retry adding books or open the collection.`
    : "Give your collection a name and an optional description.";
  const fields = <>
    {!created && <CollectionFields details={details} onChange={setDetails} readOnly={pending} />}
    <CollectionBooksField books={books} selected={selected} selectedBooks={selectedBooks} query={query}
      onQueryChange={setQuery} onToggle={toggleBook} onReorder={setOrderedIds}
      onCreateBook={bookCreation.createBook} createTrigger={bookCreation.createTrigger}
      loading={initialBooks.loading} error={initialBooks.error} onRetry={initialBooks.onRetry} disabled={pending}>
      {coverWarnings.map(warning => <p key={warning.id} role="status" className="break-words">{warning.message}</p>)}
    </CollectionBooksField>
  </>;

  return <Dialog open={!bookCreation.creating} onOpenChange={open => { if (!open && !pending) close(); }}>
    <CreationDialogContent
      title={created ? "Add books" : "Add collection"}
      description={descriptionInfo}
      icon={LibraryBig}
      fitVisualViewport
      closeDisabled={pending}
      onOpenAutoFocus={bookCreation.onOpenAutoFocus}
      onCloseAutoFocus={bookCreation.onCloseAutoFocus}
    >
      <form className="rj-book-form" onSubmit={event => void save(event)} noValidate>
        <div className="rj-book-form-scroll grid min-w-0 content-start gap-5">{fields}</div>
        <SaveCancelBar
          mode="creation-dialog"
          onCancel={close}
          cancelLabel={created ? "Open collection" : "Cancel"}
          saving={pending}
          saveDisabled={Boolean(created && !selectedBooks.length)}
          saveLabel={created ? "Retry adding" : "Create collection"}
        >
          {error && <p role="alert" className="max-h-16 overflow-y-auto text-destructive [overflow-wrap:anywhere]">{error}</p>}
        </SaveCancelBar>
      </form>
    </CreationDialogContent>
  </Dialog>;
}

export function ConfirmCollectionChange({ title, description, action, failure, onConfirm, onClose, onCloseAutoFocus }: {
  title: string;
  description: ReactNode;
  action: string;
  failure: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      await onConfirm();
      onClose();
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <CollectionDialogContent showCloseButton={!pending}
      onCloseAutoFocus={onCloseAutoFocus} onOpenAutoFocus={event => {
        event.preventDefault();
        cancel.current?.focus();
      }}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {error && <p role="alert" className="text-destructive">{failure}</p>}
      <DialogFooter>
        <Button ref={cancel} variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button variant="destructive" disabled={pending} onClick={() => void confirm()}>{pending ? "Saving…" : action}</Button>
      </DialogFooter>
    </CollectionDialogContent>
  </Dialog>;
}
