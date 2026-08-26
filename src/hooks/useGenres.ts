import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  buildGenreTree,
  fetchGenres,
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

  return {
    genres,
    tree,
    loading,
    error,
    reload: load,
  };
}
