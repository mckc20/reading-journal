import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { LibraryPreviewBook } from "@/components/redesign/LibraryPreview";
import { useBooksContext } from "@/context/BooksContext";
import type { Book } from "@/types";

export function toLibraryBook(book: Book): LibraryPreviewBook {
  return {
    id: book.id,
    title: book.title,
    author: book.authors.join(", "),
    cover: book.cover_url,
    currentPage: Math.max(0, book.current_page ?? 0),
    totalPages: book.total_pages,
    status: book.status,
    favorite: book.is_favorite,
    format: book.format,
    language: book.language,
    source: book.source,
    filterRecord: book,
    addedAt: book.created_at,
  };
}

export function useLibraryBooks() {
  const { books, wishlistBooks, loading, error, reload } = useBooksContext();
  const navigate = useNavigate();
  const collectionBooks = useMemo(
    () => [...books, ...wishlistBooks].map(toLibraryBook),
    [books, wishlistBooks],
  );

  return {
    books: collectionBooks,
    loading,
    error: error ?? undefined,
    onRetry: () => void reload(),
    onOpenBook: (book: LibraryPreviewBook) => navigate(
      `/books/${encodeURIComponent(book.id)}`,
    ),
  };
}
