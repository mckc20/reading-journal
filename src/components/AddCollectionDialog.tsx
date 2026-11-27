import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { OpenCollectionBookForm } from "@/components/redesign/CollectionBooksField";
import { CollectionFormDialog } from "@/components/redesign/CollectionDialogs";
import { useCustomCollectionActions } from "@/hooks/useCustomCollections";
import { useLibraryBooks } from "@/pages/library/useLibraryBooks";

export default function AddCollectionDialog({ openAddBook, onClose, onCloseAutoFocus }: {
  openAddBook: OpenCollectionBookForm;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const navigate = useNavigate();
  const { books, loading, error, onRetry } = useLibraryBooks();
  const { save, saveBooks } = useCustomCollectionActions();
  const openingCollection = useRef(false);

  return <CollectionFormDialog onClose={onClose} onSave={save} onCreateBook={openAddBook}
    onCloseAutoFocus={event => {
      if (openingCollection.current) event.preventDefault();
      else onCloseAutoFocus(event);
    }}
    initialBooks={{
      books,
      loading,
      error,
      onRetry,
      onSaveOrder: (collectionId, orderedIds) => saveBooks(collectionId, { orderedIds, addedIds: orderedIds, removedIds: [] }),
      onOpen: id => {
        openingCollection.current = true;
        navigate(`/library/collections?collection=${encodeURIComponent(id)}`);
      },
    }} />;
}
