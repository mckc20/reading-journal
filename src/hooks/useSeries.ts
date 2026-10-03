import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context";
import { createSeries, deleteSeries, fetchSeries, updateSeries, type SeriesInput } from "@/lib/books";
import type { Series } from "@/types";

export function useSeries() {
  const { user } = useAuth();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setError(null);
    fetchSeries()
      .then(setSeries)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load series");
      })
      .finally(() => setLoading(false));
  }, [user]);

  const addSeries = useCallback(async (input: string | SeriesInput): Promise<Series> => {
    if (!user) throw new Error("Not authenticated");
    const created = await createSeries(user.id, input);
    setSeries((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, [user]);

  const removeSeries = useCallback(async (seriesId: string, deleteLinkedBooks = false): Promise<void> => {
    await deleteSeries(seriesId, deleteLinkedBooks);
    setSeries((prev) => prev.filter((item) => item.id !== seriesId));
  }, []);

  const editSeries = useCallback(async (seriesId: string, input: Partial<SeriesInput>): Promise<Series> => {
    const updated = await updateSeries(seriesId, input);
    setSeries((prev) => prev.map((item) => (item.id === seriesId ? updated : item)));
    return updated;
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    const data = await fetchSeries();
    setSeries(data);
  }, [user]);

  return { series, loading, error, addSeries, editSeries, removeSeries, reload };
}
