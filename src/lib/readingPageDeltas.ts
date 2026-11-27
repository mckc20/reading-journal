interface PageLog {
  id: string;
  book_id: string;
  current_page: number;
  logged_at: string;
  starting_page?: number | null;
}

/** Use the saved page range when available, even when an entry was backdated. */
export function readingPageDeltas<T extends PageLog>(logs: readonly T[], legacyBaseline: "highest" | "previous" = "highest") {
  const legacyPages = new Map<string, number>();
  return [...logs]
    .filter(log => Number.isFinite(Date.parse(log.logged_at)) && Number.isFinite(log.current_page) && log.current_page >= 0)
    .sort((a, b) => Date.parse(a.logged_at) - Date.parse(b.logged_at) || a.id.localeCompare(b.id))
    .map(log => {
      if (log.starting_page != null) {
        return { log, pages: Math.max(0, log.current_page - log.starting_page) };
      }
      const baseline = legacyPages.get(log.book_id) ?? 0;
      legacyPages.set(log.book_id, legacyBaseline === "highest" ? Math.max(baseline, log.current_page) : log.current_page);
      return { log, pages: Math.max(0, log.current_page - baseline) };
    });
}
