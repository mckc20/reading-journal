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
    async (payload: AddBookPayload, coverFile?: File): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      const bookId = crypto.randomUUID();
      let cover_url: string | undefined;
      if (coverFile) {
        cover_url = await uploadCover(user.id, bookId, coverFile);
      }
      const book = await createBook({ ...payload, id: bookId, cover_url, user_id: user.id });
      setBooks((prev) => [book, ...prev]);
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

  return { books, loading, error, addBook, updateBook, deleteBook, reload: load };
}
