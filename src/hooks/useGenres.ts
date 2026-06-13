import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  buildGenreTree,
  createGenre,
  deleteGenre,
  fetchGenres,
  updateGenre,
  type GenreInput,
} from "@/lib/genres";
import type { Genre, GenreTreeNode } from "@/types";

export function useGenres() {
  const { user } = useAuth();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await fetchGenres();
      setGenres(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load genres");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = useMemo<GenreTreeNode[]>(() => buildGenreTree(genres), [genres]);

  const addGenre = useCallback(
    async (input: GenreInput) => {
      if (!user) throw new Error("Not authenticated");
      const created = await createGenre(user.id, input);
      setGenres((current) => [...current, created]);
      return created;
    },
    [user],
  );

  const editGenre = useCallback(async (id: string, input: GenreInput) => {
    const updated = await updateGenre(id, input);
    setGenres((current) => current.map((genre) => (genre.id === id ? updated : genre)));
    return updated;
  }, []);

  const removeGenre = useCallback(async (id: string) => {
    await deleteGenre(id);
    setGenres((current) => {
      const removedIds = new Set<string>([id]);
      let changed = true;

      while (changed) {
        changed = false;
        for (const genre of current) {
          if (genre.parent_id && removedIds.has(genre.parent_id) && !removedIds.has(genre.id)) {
            removedIds.add(genre.id);
            changed = true;
          }
        }
      }

      return current.filter((genre) => !removedIds.has(genre.id));
    });
  }, []);

  return {
    genres,
    tree,
    loading,
    error,
    reload: load,
    addGenre,
    editGenre,
    removeGenre,
  };
}
