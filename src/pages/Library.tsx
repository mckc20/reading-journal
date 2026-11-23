import { useMemo } from "react";
import { Navigate, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { LibraryCollections, parseCollectionId } from "@/components/redesign/CollectionsPreview";
import { LibraryBooks, type LibraryPreviewBook } from "@/components/redesign/LibraryPreview";
import type { LibraryDestination } from "@/components/redesign/LibraryNavigation";
import { useBooksContext } from "@/context/BooksContext";
import type { Book } from "@/types";

const libraryRedirectParamKeys = [
  "q",
  "sort",
  "display",
  "mode",
  "value",
  "genre",
  "rating",
  "year",
  "format",
  "language",
  "source",
  "status",
  "progress",
  "publicationYear",
  "series",
  "author",
  "favorite",
];

function toLibraryBook(book: Book): LibraryPreviewBook {
  return {
    id: book.id,
    title: book.title,
    author: book.authors.join(", "),
    cover: book.cover_url,
    currentPage: Math.max(0, book.current_page ?? 0),
    totalPages: book.total_pages,
    status: book.status,
    favorite: book.is_favorite,
    addedAt: book.created_at,
  };
}

export default function Library() {
  const { books, wishlistBooks, loading, error, reload } = useBooksContext();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view");
  const showCollections = searchParams.get("tab") === "collections";
  const selectedCollection = parseCollectionId(searchParams.get("collection"));
  const collectionBooks = useMemo(
    () => [...books, ...wishlistBooks].map(toLibraryBook),
    [books, wishlistBooks],
  );

  if ((view && view !== "all") || libraryRedirectParamKeys.some(key => searchParams.has(key))) {
    return <Navigate to={`/library/books?${searchParams.toString()}`} replace />;
  }

  function updateTab(destination: LibraryDestination) {
    if (destination === "Series") {
      navigate("/library/series");
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (destination === "Collections") next.set("tab", "collections");
    else next.delete("tab");
    next.delete("collection");
    setSearchParams(next);
  }

  const contentProps = {
    books: collectionBooks,
    loading,
    error: error ?? undefined,
    onRetry: () => void reload(),
    onOpenBook: (book: LibraryPreviewBook) => navigate(
      book.status === "Wishlist" ? "/library/wishlist" : `/books/${encodeURIComponent(book.id)}`,
    ),
  };

  if (showCollections) {
    return (
      <LibraryCollections
        {...contentProps}
        onLibraryNavigate={updateTab}
        selection={{
          collection: selectedCollection,
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

  return (
    <LibraryBooks
      {...contentProps}
      onCollection={updateTab}
      onAddBook={trigger => openAddBook(undefined, trigger)}
    />
  );
}
