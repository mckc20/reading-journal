import { useRef, useState, type ReactNode, type Ref } from "react";
import { Plus } from "lucide-react";
import type { AddBookDialogLaunchOptions } from "@/components/AppLayout";
import { BookSearchPicker } from "@/components/BookSearchPicker";
import { ReorderableBookList } from "@/components/ReorderableBookList";
import { Button } from "@/components/ui/button";
import type { Book } from "@/types";
import type { LibraryPreviewBook } from "./LibraryPreview";

export type OpenCollectionBookForm = (
  options: Pick<AddBookDialogLaunchOptions, "onCreated" | "onCancel">,
  trigger: HTMLElement,
) => void;

export function useCollectionBookCreation({
  openBook, onCreated, onCloseAutoFocus, disabled,
}: {
  openBook?: OpenCollectionBookForm;
  onCreated: (book: Book, warning?: string) => void;
  onCloseAutoFocus: (event: Event) => void;
  disabled: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const returningFromCreate = useRef(false);

  return {
    creating,
    createTrigger,
    createBook: openBook && ((trigger: HTMLButtonElement) => {
      if (disabled) return;
      returningFromCreate.current = true;
      setCreating(true);
      openBook({
        onCreated: (book, warning) => {
          setCreating(false);
          onCreated(book, warning);
        },
        onCancel: () => setCreating(false),
      }, trigger);
    }),
    onOpenAutoFocus(event: Event) {
      if (!returningFromCreate.current) return;
      returningFromCreate.current = false;
      if (createTrigger.current) {
        event.preventDefault();
        createTrigger.current.focus();
      }
    },
    onCloseAutoFocus(event: Event) {
      if (creating) event.preventDefault();
      else onCloseAutoFocus(event);
    },
  };
}

export function CollectionBooksField({
  books, selectedBooks, selected, query, onQueryChange, onToggle, onReorder, onCreateBook, createTrigger,
  loading, error, onRetry, disabled, children,
}: {
  books: LibraryPreviewBook[];
  selectedBooks: LibraryPreviewBook[];
  selected: ReadonlySet<string>;
  query: string;
  onQueryChange: (query: string) => void;
  onToggle: (id: string, included: boolean) => void;
  onReorder: (ids: string[]) => void;
  onCreateBook?: (trigger: HTMLButtonElement) => void;
  createTrigger: Ref<HTMLButtonElement>;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  disabled: boolean;
  children?: ReactNode;
}) {
  const searchInput = useRef<HTMLInputElement>(null);

  return <fieldset className="rj-collection-book-field">
    <legend>Books</legend>
    {children}
    {loading ? <p role="status">Loading your books…</p>
      : error ? <div className="grid justify-items-start gap-2">
        <p role="alert">Your books couldn’t load.</p>
        <Button type="button" variant="outline" disabled={disabled} onClick={onRetry}>Try again</Button>
      </div>
      : <BookSearchPicker books={books} selected={selected} query={query} onQueryChange={onQueryChange}
        onToggle={onToggle} disabled={disabled} searchRef={searchInput} />}
    {onCreateBook && <Button ref={createTrigger} type="button" variant="outline" className="justify-self-start"
      aria-disabled={disabled} onClick={event => onCreateBook(event.currentTarget)}>
      <Plus aria-hidden="true" />Create new book
    </Button>}
    {!loading && !error && (selectedBooks.length > 0
      ? <ReorderableBookList books={selectedBooks} disabled={disabled} onReorder={onReorder}
        onRemove={(id, byKeyboard) => {
          onToggle(id, false);
          if (byKeyboard) searchInput.current?.focus();
        }} />
      : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No books selected yet.</p>)}
  </fieldset>;
}
