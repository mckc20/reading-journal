import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context";
import {
  fetchBooks,
  createBook,
  updateBook as updateBookDb,
  deleteBook as deleteBookDb,
  uploadCover,
  deleteCover,
  type BookInsert,
} from "@/lib/books";
import type { Book } from "@/types";

export interface AddBookPayload
  extends Omit<BookInsert, "id" | "cover_url" | "user_id"> {}

export interface AddBookResult {
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

      if (!coverFile) return {};

      try {
        const cover_url = await uploadCover(user.id, bookId, coverFile);
        const updated = await updateBookDb(bookId, { cover_url });
        setBooks((prev) => prev.map((b) => (b.id === bookId ? updated : b)));
        return {};
      } catch (error) {
        const detail = getErrorMessage(error, "Upload request failed.");
        return {
          warning: `Book saved, but cover upload failed: ${detail} You can add the cover later from book details.`,
        };
      }
    },
    [user]
  );

  const updateBook = useCallback(
    async (id: string, payload: Partial<Book>): Promise<void> => {
      const updated = await updateBookDb(id, payload);
      setBooks((prev) => prev.map((b) => (b.id === id ? updated : b)));
    },
    []
  );

  const updateCover = useCallback(
    async (id: string, file: File): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      // Delete old cover files (best-effort)
      await deleteCover(user.id, id).catch(() => {});
      // Upload new cover
      const cover_url = await uploadCover(user.id, id, file);
      // Update book record in DB
      const updated = await updateBookDb(id, { cover_url });
      setBooks((prev) => prev.map((b) => (b.id === id ? updated : b)));
    },
    [user]
  );

  const deleteBook = useCallback(
    async (id: string): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      // Best-effort cover deletion
      await deleteCover(user.id, id).catch(() => {});
      await deleteBookDb(id);
      setBooks((prev) => prev.filter((b) => b.id !== id));
    },
    [user]
  );

  return { books, loading, error, addBook, updateBook, updateCover, deleteBook, reload: load };
}
