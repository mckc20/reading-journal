import LoadingIndicator from "@/components/LoadingIndicator";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { BookOpen, Loader2, ThumbsDown } from "lucide-react";
import { AppHeading } from "@/components/design";
import { PageHeader } from "@/components/reading-journal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { searchBooksAcrossCatalogs, type BookTitleSearchResult } from "@/lib/bookLookup";
import { fetchSeriesVolumeRejections, rejectSeriesVolumeCandidate, type SeriesVolumeRejection } from "@/lib/seriesVolumeFeedback";
import {
  getNextSeriesVolumeTargets,
  getSeriesCandidateSearchQuery,
  rankSeriesCandidates,
  seriesCandidateIdentity,
  type SeriesVolumeSuggestion,
} from "@/lib/seriesVolumeSuggestions";
import type { Book } from "@/types";
import type { AppLayoutOutletContext } from "@/components/AppLayout";

export default function Discover() {
  const { user } = useAuth();
  const { books, loading: booksLoading } = useBooksContext();
  const { series, loading: seriesLoading } = useSeries();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const [seriesCandidates, setSeriesCandidates] = useState<Record<string, BookTitleSearchResult[]>>({});
  const [seriesRejections, setSeriesRejections] = useState<SeriesVolumeRejection[]>([]);
  const [seriesSearchLoading, setSeriesSearchLoading] = useState(false);
  const [seriesSearchError, setSeriesSearchError] = useState<string | null>(null);
  const [pendingRejection, setPendingRejection] = useState<SeriesVolumeSuggestion | null>(null);
  const [savingRejection, setSavingRejection] = useState(false);
  const userId = user?.id;

  const nextVolumeTargets = useMemo(() => getNextSeriesVolumeTargets(books, series), [books, series]);

  useEffect(() => {
    if (booksLoading || seriesLoading || !userId) return;
    let active = true;
    const targets = nextVolumeTargets.slice(0, 6);
    setSeriesCandidates({});
    setSeriesSearchError(null);
    setSeriesSearchLoading(targets.length > 0);

    void (async () => {
      let rejections: SeriesVolumeRejection[] = [];
      try {
        rejections = await fetchSeriesVolumeRejections(userId);
      } catch {
        if (active) setSeriesSearchError("Could not load your saved series feedback.");
      }
      if (!active) return;
      setSeriesRejections(rejections);

      const results = await Promise.all(targets.map(async (target) => {
        try {
          const candidates = await searchBooksAcrossCatalogs(getSeriesCandidateSearchQuery(target));
          const rejected = new Set(rejections
            .filter((item) => item.series_id === target.seriesId)
            .map((item) => item.candidate_key));
          return [target.seriesId, rankSeriesCandidates(target, candidates, books, rejected)] as const;
        } catch {
          return [target.seriesId, []] as const;
        }
      }));
      if (!active) return;
      const candidateMap: Record<string, BookTitleSearchResult[]> = Object.fromEntries(results);
      setSeriesCandidates(candidateMap);
      if (targets.length > 0 && Object.values(candidateMap).every((items) => items.length === 0)) {
        setSeriesSearchError("No matching next volumes were found in the book catalogs.");
      }
      setSeriesSearchLoading(false);
    })();

    return () => { active = false; };
  }, [books, booksLoading, nextVolumeTargets, seriesLoading, userId]);

  const continuations = useMemo(() => getContinuations(books, series), [books, series]);
  const missingVolumeSuggestions = useMemo(() => nextVolumeTargets.flatMap((target) => {
    const rejected = new Set(seriesRejections
      .filter((item) => item.series_id === target.seriesId)
      .map((item) => item.candidate_key));
    const candidate = rankSeriesCandidates(target, seriesCandidates[target.seriesId] ?? [], books, rejected)[0];
    return candidate ? [{ ...target, candidate }] : [];
  }), [books, nextVolumeTargets, seriesCandidates, seriesRejections]);
  function addSeriesVolume(suggestion: SeriesVolumeSuggestion) {
    openAddBook({
      initialSeriesId: suggestion.seriesId,
      initialVolumeNumber: suggestion.volumeNumber,
      initialCatalogBook: suggestion.candidate,
    });
  }

  async function confirmRejectSeriesVolume() {
    if (!pendingRejection || !userId) return;
    const suggestion = pendingRejection;
    const candidateKey = seriesCandidateIdentity(suggestion.candidate);
    setSavingRejection(true);
    setSeriesSearchError(null);
    try {
      await rejectSeriesVolumeCandidate({
        userId,
        seriesId: suggestion.seriesId,
        candidateKey,
        title: suggestion.candidate.title,
        source: suggestion.candidate.metadataSource,
      });
      setSeriesRejections((previous) => [...previous, { series_id: suggestion.seriesId, candidate_key: candidateKey }]);
      setPendingRejection(null);
    } catch {
      setSeriesSearchError("Could not save that feedback. Please try again.");
      setPendingRejection(null);
      setSavingRejection(false);
      return;
    }

    try {
      const existing = seriesCandidates[suggestion.seriesId] ?? [];
      const rejected = new Set([
        ...seriesRejections.filter((item) => item.series_id === suggestion.seriesId).map((item) => item.candidate_key),
        candidateKey,
      ]);
      if (rankSeriesCandidates(suggestion, existing, books, rejected).length === 0) {
        try {
          const moreCandidates = await searchBooksAcrossCatalogs(suggestion.seriesName);
          setSeriesCandidates((previous) => ({
            ...previous,
            [suggestion.seriesId]: [...(previous[suggestion.seriesId] ?? []), ...moreCandidates],
          }));
        } catch {
          setSeriesSearchError("No additional catalog matches were found for this series.");
        }
      }
    } finally {
      setSavingRejection(false);
    }
  }

  const continuationCards = [
    ...continuations.map((item) => ({ kind: "owned" as const, ...item })),
    ...missingVolumeSuggestions.map((item) => ({ kind: "catalog" as const, ...item })),
  ].sort((a, b) => a.seriesName.localeCompare(b.seriesName) ||
    (a.kind === "owned" ? a.book.volume_number ?? 0 : a.volumeNumber) -
    (b.kind === "owned" ? b.book.volume_number ?? 0 : b.volumeNumber)).slice(0, 6);

  return (
    <div className="space-y-8">
      <PageHeader title="Discover" />

      <section className="space-y-4" aria-labelledby="continue-heading">
        <div>
          <AppHeading level={3} as="h3" id="continue-heading">Continue your reading</AppHeading>
          <p className="mt-1 text-sm text-muted-foreground">Next books from series represented in your library.</p>
        </div>
        {(booksLoading || seriesLoading || seriesSearchLoading) && continuationCards.length === 0 ? <LoadingIndicator /> : continuationCards.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {continuationCards.map((item) => item.kind === "owned" ? <div key={`owned:${item.book.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            {item.book.cover_url ? <img src={item.book.cover_url} alt="" className="h-16 w-11 rounded object-cover" /> : <div className="flex h-16 w-11 items-center justify-center rounded bg-muted"><BookOpen className="h-5 w-5 text-muted-foreground" /></div>}
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.book.title}</p><p className="truncate text-sm text-muted-foreground">{item.seriesName}{item.book.volume_number ? ` · Book ${item.book.volume_number}` : ""}</p></div>
            <Button asChild size="sm" variant="outline"><Link to={`/books/${item.book.id}`}>Open</Link></Button>
          </div> : <div key={`catalog:${item.seriesId}`} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3">
            {item.candidate.coverUrl ? <img src={item.candidate.coverUrl} alt="" className="h-16 w-11 rounded object-cover" /> : <div className="flex h-16 w-11 items-center justify-center rounded bg-muted"><BookOpen className="h-5 w-5 text-muted-foreground" /></div>}
            <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Possible next volume</p><p className="truncate font-medium">{item.candidate.title}</p><p className="truncate text-sm text-muted-foreground">{item.seriesName} · Book {item.volumeNumber}{item.candidate.authors.length ? ` · ${item.candidate.authors.join(", ")}` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => addSeriesVolume(item)}>Add to library</Button>
                <Button size="icon" variant="ghost" aria-label="this is not the next volume" title="this is not the next volume" disabled={savingRejection} onClick={() => setPendingRejection(item)}>
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>)}
        </div> : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No next-volume suggestions were found for the series in your library.</p>}
        {seriesSearchError && <p role="status" className="text-sm text-muted-foreground">{seriesSearchError}</p>}
      </section>

      <Dialog open={Boolean(pendingRejection)} onOpenChange={(open) => !open && !savingRejection && setPendingRejection(null)}>
        {pendingRejection && <DialogContent>
          <DialogHeader>
            <DialogTitle>This is not the next volume?</DialogTitle>
            <p className="text-sm text-muted-foreground">Remove “{pendingRejection.candidate.title}” from {pendingRejection.seriesName} suggestions and search for another match?</p>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingRejection(null)} disabled={savingRejection}>Cancel</Button>
            <Button onClick={() => void confirmRejectSeriesVolume()} disabled={savingRejection}>
              {savingRejection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </div>
        </DialogContent>}
      </Dialog>
    </div>
  );
}

function getContinuations(books: Book[], series: Array<{ id: string; name: string }>): Array<{ book: Book; seriesName: string }> {
  const seriesNames = new Map(series.map((item) => [item.id, item.name]));
  const grouped = new Map<string, Book[]>();
  for (const book of books) {
    if (!book.series_id) continue;
    grouped.set(book.series_id, [...(grouped.get(book.series_id) ?? []), book]);
  }
  const candidates: Array<{ book: Book; seriesName: string }> = [];
  for (const [seriesId, group] of grouped) {
    const finishedVolumes = group.filter((book) => book.status === "Finished" && book.volume_number != null).map((book) => book.volume_number as number);
    if (!finishedVolumes.length) continue;
    const highestFinished = Math.max(...finishedVolumes);
    group.filter((book) => ["To Read", "Up Next"].includes(book.status) && book.volume_number != null && book.volume_number > highestFinished)
      .forEach((book) => candidates.push({ book, seriesName: seriesNames.get(seriesId) ?? "Series" }));
  }
  return candidates.sort((a, b) => (a.book.volume_number ?? Infinity) - (b.book.volume_number ?? Infinity) || a.book.title.localeCompare(b.book.title)).slice(0, 6);
}
