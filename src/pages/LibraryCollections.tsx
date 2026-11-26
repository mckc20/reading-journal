import { useOutletContext } from "react-router-dom";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { LibraryCollections as CollectionView } from "@/components/redesign/CollectionsPreview";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { collectionMembershipUpdate } from "@/lib/libraryCollections";
import { useLibraryBooks } from "./library/useLibraryBooks";

export default function LibraryCollections() {
  const books = useLibraryBooks();
  const { series } = useSeries();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const { updateBook } = useBooksContext();

  return <CollectionView {...books} series={series} actions={{
    onCreateBook: (collection, trigger) => openAddBook({
      collectionStatus: collection === "Favorites" ? undefined : collection,
      initiallyFavorite: collection === "Favorites",
      onSaved: () => {},
    }, trigger),
    onAddBook: (collection, id) => updateBook(id, collectionMembershipUpdate(collection)),
  }} />;
}
