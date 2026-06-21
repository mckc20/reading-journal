import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context";
import { createSeries, deleteSeries, fetchSeries } from "@/lib/books";
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

  const addSeries = useCallback(async (name: string): Promise<Series> => {
    if (!user) throw new Error("Not authenticated");
    const created = await createSeries(user.id, name);
    setSeries((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, [user]);

  const removeSeries = useCallback(async (seriesId: string): Promise<void> => {
    await deleteSeries(seriesId);
    setSeries((prev) => prev.filter((item) => item.id !== seriesId));
  }, []);

  return { series, loading, error, addSeries, removeSeries };
}
