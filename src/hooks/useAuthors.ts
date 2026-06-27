import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  createAuthor,
  deleteAuthor,
  fetchAuthors,
  updateAuthor,
  type AuthorInput,
} from "@/lib/authors";
import { deletePublicImageVariants } from "@/lib/storage";
import type { Author } from "@/types";

export function useAuthors() {
  const { user } = useAuth();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuthors();
      setAuthors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load authors");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const addAuthor = useCallback(
    async (input: AuthorInput) => {
      if (!user) throw new Error("Not authenticated");
      const created = await createAuthor(user.id, input);
      setAuthors((current) => {
        const next = [...current.filter((author) => author.id !== created.id), created];
        return next.sort((a, b) => {
          if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
        });
      });
      return created;
    },
    [user],
  );

  const editAuthor = useCallback(async (id: string, input: AuthorInput) => {
    const updated = await updateAuthor(id, input);
    setAuthors((current) => current.map((author) => (author.id === id ? updated : author)));
    return updated;
  }, []);

  const removeAuthor = useCallback(async (id: string) => {
    if (!user) throw new Error("Not authenticated");
    await deletePublicImageVariants("author-photos", user.id, id).catch(() => {});
    await deleteAuthor(id);
    setAuthors((current) => current.filter((author) => author.id !== id));
  }, [user]);

  return {
    authors,
    loading,
    error,
    reload: load,
    addAuthor,
    editAuthor,
    removeAuthor,
  };
}
