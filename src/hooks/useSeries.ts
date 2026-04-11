import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context";
import { fetchSeries, createSeries } from "@/lib/books";
import type { Series } from "@/types";

export function useSeries() {
  const { user } = useAuth();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchSeries()
      .then(setSeries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const addSeries = useCallback(async (name: string): Promise<Series> => {
    if (!user) throw new Error("Not authenticated");
    const created = await createSeries(user.id, name);
    setSeries((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, [user]);

  return { series, loading, addSeries };
}
