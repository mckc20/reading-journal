import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context";
import {
  fetchBooks,
  createBook,
  updateBook as updateBookDb,
  updateBookSeriesPlacement as updateBookSeriesPlacementDb,
  updateBookVolumeNumber as updateBookVolumeNumberDb,
  pauseBook as pauseBookDb,
  resumeBook as resumeBookDb,
  deleteBook as deleteBookDb,
  uploadCover,
  type BookInsert,
} from "@/lib/books";
import type { Book, BookUpdate } from "@/types";
import { splitBookScopes } from "@/lib/bookScopes";

export interface AddBookPayload
  extends Omit<BookInsert, "id" | "user_id"> {}

export interface AddBookResult {
  book: Book;
  warning?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

export function useBooks() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const scopes = useMemo(() => splitBookScopes(books), [books]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBooks();
      setBooks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load books");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const addBook = useCallback(
    async (payload: AddBookPayload, coverFile?: File): Promise<AddBookResult> => {
      if (!user) throw new Error("Not authenticated");
      const bookId = crypto.randomUUID();

      const book = await createBook({ ...payload, id: bookId, user_id: user.id });
      setBooks((prev) => [book, ...prev]);

      if (!coverFile) return { book };

      try {
        const cover_url = await uploadCover(user.id, bookId, coverFile);
        const updated = await updateBookDb(bookId, { cover_url });
        setBooks((prev) => prev.map((b) => (b.id === bookId ? updated : b)));
        return { book: updated };
      } catch (error) {
        const detail = getErrorMessage(error, "Upload request failed.");
        return {
          book,
          warning: `Book saved, but cover upload failed: ${detail} You can add the cover later from book details.`,
        };
      }
    },
    [user]
  );

  const updateBook = useCallback(
    async (id: string, payload: BookUpdate): Promise<void> => {
      const updated = await updateBookDb(id, payload);
      setBooks((prev) => prev.map((b) => (b.id === id ? updated : b)));
    },
    []
  );

  const updateBookSeriesPlacement = useCallback(
    async (
      id: string,
      payload: { series_id?: string | null; volume_number?: number | null },
    ): Promise<void> => {
      const updated = await updateBookSeriesPlacementDb(id, payload);
      setBooks((prev) => prev.map((book) => (book.id === id ? updated : book)));
    },
    [],
  );

  const updateBookVolumeNumber = useCallback(
    async (id: string, volumeNumber: number): Promise<void> => {
      await updateBookVolumeNumberDb(id, volumeNumber);
      setBooks((prev) =>
        prev.map((book) => (book.id === id ? { ...book, volume_number: volumeNumber } : book)),
      );
    },
    [],
  );

  const updateCover = useCallback(
    async (id: string, file: File): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      // Never overwrite a cover referenced by another book (including copies).
      const coverId = crypto.randomUUID();
      const cover_url = await uploadCover(user.id, coverId, file);
      // Update book record in DB
      const updated = await updateBookDb(id, { cover_url });
      setBooks((prev) => prev.map((b) => (b.id === id ? updated : b)));
    },
    [user]
  );

  const pauseBook = useCallback(async (id: string): Promise<void> => {
    const updated = await pauseBookDb(id);
    setBooks((prev) => prev.map((book) => (book.id === id ? updated : book)));
  }, []);

  const resumeBook = useCallback(async (id: string): Promise<void> => {
    const updated = await resumeBookDb(id);
    setBooks((prev) => prev.map((book) => (book.id === id ? updated : book)));
  }, []);

  const deleteBook = useCallback(
    async (id: string): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      await deleteBookDb(id);
      setBooks((prev) => prev.filter((b) => b.id !== id));
    },
    [user]
  );

  return {
    ...scopes,
    loading,
    error,
    addBook,
    updateBook,
    updateBookSeriesPlacement,
    updateBookVolumeNumber,
    updateCover,
    pauseBook,
    resumeBook,
    deleteBook,
    reload: load,
  };
}
