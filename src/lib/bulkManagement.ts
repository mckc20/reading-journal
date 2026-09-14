export type BulkFailure = { id: string; label: string; message: string };

export type BulkOperationSummary = {
  completed: number;
  failures: BulkFailure[];
};

export function pruneSelectedIds(selectedIds: Set<string>, visibleIds: Iterable<string>): Set<string> {
  const visible = new Set(visibleIds);
  return new Set([...selectedIds].filter((id) => visible.has(id)));
}

export function toggleAllVisibleIds(selectedIds: Set<string>, visibleIds: string[]): Set<string> {
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const next = new Set(selectedIds);
  visibleIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
  return next;
}

export function mergeStringValues(existing: string[] | null | undefined, values: string[], mode: "add" | "remove"): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (mode === "remove") {
    const remove = new Set(normalized.map((value) => value.toLocaleLowerCase()));
    return (existing ?? []).filter((value) => !remove.has(value.toLocaleLowerCase()));
  }

  const seen = new Set<string>();
  return [...(existing ?? []), ...normalized].filter((value) => {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runBulkOperation<T>(
  items: T[],
  getIdentity: (item: T) => { id: string; label: string },
  operation: (item: T) => Promise<void>,
): Promise<BulkOperationSummary> {
  const results = await Promise.all(items.map(async (item) => {
    try {
      await operation(item);
      return { ok: true as const };
    } catch (error) {
      const identity = getIdentity(item);
      return {
        ok: false as const,
        failure: {
          ...identity,
          message: error instanceof Error ? error.message : "The item could not be updated.",
        },
      };
    }
  }));
  const failures = results.flatMap((result) => result.ok ? [] : [result.failure]);
  return { completed: results.length - failures.length, failures };
}
