/** Shared with wrap-ups: corrections never count as negative reading or count pages twice. */
export function readingPageDeltas<T extends { id: string; book_id: string; current_page: number; logged_at: string }>(logs: readonly T[]) {
  const highest = new Map<string, number>();
  return [...logs]
    .filter(log => Number.isFinite(Date.parse(log.logged_at)) && Number.isFinite(log.current_page) && log.current_page >= 0)
    .sort((a, b) => Date.parse(a.logged_at) - Date.parse(b.logged_at) || a.id.localeCompare(b.id))
    .map(log => {
      const baseline = highest.get(log.book_id) ?? 0;
      highest.set(log.book_id, Math.max(baseline, log.current_page));
      return { log, pages: Math.max(0, log.current_page - baseline) };
    });
}
