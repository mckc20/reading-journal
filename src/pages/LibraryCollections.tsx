import { useSearchParams } from "react-router-dom";
import { LibraryCollections as CollectionView, parseCollectionId } from "@/components/redesign/CollectionsPreview";
import { useLibraryBooks } from "./library/useLibraryBooks";

export default function LibraryCollections() {
  const books = useLibraryBooks();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <CollectionView
      {...books}
      selection={{
        collection: parseCollectionId(searchParams.get("collection")),
        onChange: collection => {
          const next = new URLSearchParams(searchParams);
          if (collection) next.set("collection", collection);
          else next.delete("collection");
          if (next.toString() !== searchParams.toString()) setSearchParams(next);
        },
      }}
    />
  );
}
