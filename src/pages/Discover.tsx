import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, Ban, Bookmark, BookOpen, Compass, ExternalLink, Loader2, ThumbsDown } from "lucide-react";
import { AppHeading } from "@/components/design";
import BackButton from "@/components/BackButton";
import { PageHeader } from "@/components/reading-journal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth, useUserSettings } from "@/context";
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
import type { RecommendationItem, RecommendationSet } from "@/types/recommendations";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { DEFAULT_DISCOVER_SETTINGS } from "@/lib/userSettings";
import { fetchWishlist } from "@/lib/wishlist";

interface RecommendationFeedbackRecord {
  candidate_key: string;
  title: string;
  authors: string[];
  genres: string[];
  item: RecommendationItem;
}

interface RecommendationResponse {
  set: RecommendationSet | null;
  stale: boolean;
  generating: boolean;
  feedback?: RecommendationFeedbackRecord[];
  error?: string;
}

export default function Discover() {
  const location = useLocation();
  const navigate = useNavigate();
  const recommendationsPage = location.pathname === "/discover/recommendations";
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const { books, loading: booksLoading } = useBooksContext();
  const { series, loading: seriesLoading } = useSeries();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const [recommendationSet, setRecommendationSet] = useState<RecommendationSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RecommendationItem | null>(null);
  const [seriesCandidates, setSeriesCandidates] = useState<Record<string, BookTitleSearchResult[]>>({});
  const [seriesRejections, setSeriesRejections] = useState<SeriesVolumeRejection[]>([]);
  const [seriesSearchLoading, setSeriesSearchLoading] = useState(false);
  const [seriesSearchError, setSeriesSearchError] = useState<string | null>(null);
  const [pendingRejection, setPendingRejection] = useState<SeriesVolumeSuggestion | null>(null);
  const [savingRejection, setSavingRejection] = useState(false);
  const [feedback, setFeedback] = useState<RecommendationFeedbackRecord[]>([]);
  const [savingFeedbackKey, setSavingFeedbackKey] = useState<string | null>(null);
  const [removingRecommendationKey, setRemovingRecommendationKey] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [moreCount, setMoreCount] = useState(0);
  const [wishlistKeys, setWishlistKeys] = useState<Set<string>>(new Set());
  const userId = session?.user.id;

  const request = useCallback(async (method: "GET" | "POST", force = false, feedbackRefresh = false): Promise<RecommendationResponse> => {
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch("/api/recommendations", {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
      ...(method === "POST" ? { body: JSON.stringify({ ...(force ? { force: true } : {}), ...(feedbackRefresh ? { feedbackRefresh: true } : {}) }) } : {}),
    });
    const responseText = await response.text();
    if (!responseText) {
      const localHint = import.meta.env.DEV
        ? " Start the app with `vercel dev` so the Vercel Function is available locally."
        : " Check the Vercel Function logs for this request.";
      throw new Error(`The recommendations API returned an empty response (HTTP ${response.status}).${localHint}`);
    }
    let data: RecommendationResponse;
    try {
      data = JSON.parse(responseText) as RecommendationResponse;
    } catch {
      const preview = responseText.trim().slice(0, 160);
      const detail = response.status === 404 || response.headers.get("content-type")?.includes("text/html")
        ? "The recommendations API is unavailable here. When running locally, start the app with Vercel's development server so its API functions are available."
        : `The recommendations API returned an invalid response (HTTP ${response.status})${preview ? `: ${preview}` : "."}`;
      throw new Error(detail);
    }
    if (!response.ok && response.status !== 429) throw Object.assign(new Error(data.error ?? "Could not load recommendations."), { data });
    if (!response.ok) throw Object.assign(new Error(data.error ?? "Please wait before refreshing again."), { data });
    return data;
  }, [session?.access_token]);

  const refresh = useCallback(async (force = false, feedbackRefresh = false) => {
    setRefreshing(true);
    setError(null);
    try {
      const result = await request("POST", force, feedbackRefresh);
      if (result.set) setRecommendationSet(result.set);
      if (result.feedback) setFeedback(result.feedback);
      setError(result.error ?? null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Recommendations are temporarily unavailable.";
      const previous = (err as { data?: RecommendationResponse } | null)?.data?.set;
      if (previous) setRecommendationSet(previous);
      setError(detail);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [request]);

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

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const result = await request("GET");
        if (!active) return;
        setRecommendationSet(result.set);
        if (result.feedback) setFeedback(result.feedback);
        if (result.stale) void refresh(false);
        else setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load recommendations.");
        setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [request, refresh]);

  useEffect(() => {
    if (!recommendationSet?.expires_at) return;
    const expiresIn = new Date(recommendationSet.expires_at).getTime() - Date.now();
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) return;
    const timer = window.setTimeout(() => void refresh(false), expiresIn);
    return () => window.clearTimeout(timer);
  }, [recommendationSet?.expires_at, refresh]);

  const discoverSettings = settings?.discover ?? DEFAULT_DISCOVER_SETTINGS;
  const owned = useMemo(() => new Set(books.map(bookKey)), [books]);
  const dislikedKeys = useMemo(() => new Set(feedback.map((item) => item.candidate_key)), [feedback]);
  const feedbackItems = useMemo(() => feedback.map((item) => item.item).filter((item) => item && !isOwned(item, owned) && !wishlistKeys.has(recommendationKey(item))), [feedback, owned, wishlistKeys]);
  const recommendationPool = (recommendationSet?.items ?? []).filter((item) => !isOwned(item, owned) && !wishlistKeys.has(recommendationKey(item)));
  const mergedRecommendations = discoverSettings.hide_disliked_recommendations
    ? recommendationPool.filter((item) => !dislikedKeys.has(recommendationKey(item)))
    : [...recommendationPool.filter((item) => !dislikedKeys.has(recommendationKey(item))), ...feedbackItems];
  const recommendations = [...new Map(mergedRecommendations.map((item) => [recommendationKey(item), item])).values()];
  const recommendationLimit = Math.min(12, discoverSettings.recommendation_count + moreCount);
  const visibleRecommendations = recommendations.slice(0, recommendationsPage ? recommendationLimit : 3);
  const visibleCandidateKeySignature = visibleRecommendations.map(recommendationKey).join("\n");
  const continuations = useMemo(() => getContinuations(books, series), [books, series]);
  const missingVolumeSuggestions = useMemo(() => nextVolumeTargets.flatMap((target) => {
    const rejected = new Set(seriesRejections
      .filter((item) => item.series_id === target.seriesId)
      .map((item) => item.candidate_key));
    const candidate = rankSeriesCandidates(target, seriesCandidates[target.seriesId] ?? [], books, rejected)[0];
    return candidate ? [{ ...target, candidate }] : [];
  }), [books, nextVolumeTargets, seriesCandidates, seriesRejections]);
  const hasTasteHistory = books.some((book) => book.status === "Finished" && (book.rating == null || book.rating >= 3));

  useEffect(() => {
    const candidateKeys = visibleCandidateKeySignature ? visibleCandidateKeySignature.split("\n") : [];
    if (!userId || !session?.access_token || candidateKeys.length === 0) return;
    void fetch("/api/recommendations/history", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ candidate_keys: candidateKeys }),
    }).catch(() => undefined);
  }, [session?.access_token, userId, visibleCandidateKeySignature]);

  useEffect(() => {
    if (!userId) return;
    void fetchWishlist().then((items) => setWishlistKeys(new Set(items.map(wishlistItemKey)))).catch(() => undefined);
  }, [userId]);

  function addSelected(item: RecommendationItem) {
    setSelected(null);
    openAddBook({
      initialRecommendation: item,
      onSaved: () => navigate("/library/books"),
      onWishlistSaved: () => { void refresh(false); },
    });
  }

  function wishlistSelected(item: RecommendationItem) {
    const key = recommendationKey(item);
    setSelected(null);
    openAddBook({
      initialRecommendation: item,
      initiallyAddToWishlist: true,
      onWishlistSaved: () => {
        setWishlistKeys((current) => new Set(current).add(key));
        navigate("/library/wishlist");
      },
    });
  }

  async function removeRecommendation(item: RecommendationItem) {
    const key = recommendationKey(item);
    if (removingRecommendationKey) return;
    setRemovingRecommendationKey(key);
    setFeedbackError(null);
    try {
      const response = await fetch("/api/recommendations/dismissals", {
        method: "POST", headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ item }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not remove this recommendation.");
      setRecommendationSet((current) => current ? { ...current, items: current.items.filter((candidate) => recommendationKey(candidate) !== key) } : current);
      setSelected(null);
    } catch (err) { setFeedbackError(err instanceof Error ? err.message : "Could not remove this recommendation."); }
    finally { setRemovingRecommendationKey(null); }
  }

  async function toggleRecommendationFeedback(item: RecommendationItem) {
    const candidateKey = recommendationKey(item);
    if (!userId || savingFeedbackKey) return;
    const existing = feedback.find((entry) => entry.candidate_key === candidateKey);
    const previousFeedback = feedback;
    setSavingFeedbackKey(candidateKey);
    setFeedbackError(null);
    if (existing) setFeedback((previous) => previous.filter((entry) => entry.candidate_key !== candidateKey));
    else setFeedback((previous) => [{ candidate_key: candidateKey, title: item.title, authors: item.authors, genres: item.genres, item }, ...previous]);
    try {
      const response = await fetch("/api/recommendations/feedback", {
        method: existing ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(existing ? { candidate_key: candidateKey } : { item }),
      });
      const payload = await response.json() as { feedback?: RecommendationFeedbackRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save recommendation feedback.");
      setFeedback(payload.feedback ?? []);
      if (!existing && discoverSettings.hide_disliked_recommendations) {
        void refresh(true, true);
      }
    } catch (err) {
      setFeedback(previousFeedback);
      setFeedbackError(err instanceof Error ? err.message : "Could not save recommendation feedback.");
    } finally {
      setSavingFeedbackKey(null);
    }
  }

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
      {recommendationsPage ? <header className="flex items-start gap-2">
        <BackButton fallbackTo="/discover" className="mt-1" />
        <div className="space-y-1">
          <AppHeading level={1}>Recommendations</AppHeading>
        </div>
      </header> : <PageHeader title="Discover" />}

      <section className="space-y-5" aria-labelledby="recommended-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <AppHeading level={3} as="h3" id="recommended-heading">Recommended for you</AppHeading>
            {recommendationsPage && recommendationSet?.generated_at && <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>Updated {formatDate(recommendationSet.generated_at)} · Next reload {formatDate(recommendationSet.expires_at)}</span>
              <Button asChild size="sm" variant="link" className="h-auto p-0 text-xs text-muted-foreground">
                <Link to="/settings/discover">Change interval</Link>
              </Button>
            </div>}
          </div>
          {!recommendationsPage && recommendations.length > 3 && <div className="hidden sm:block">
            <Button asChild variant="link" className="px-0">
              <Link to="/discover/recommendations">
                View more
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>}
        </div>

        {feedbackError && <p role="status" className="text-sm text-destructive">{feedbackError}</p>}

        {error && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <span>{recommendationSet ? `Showing your saved recommendations. ${error}` : error}</span>
          <Button variant="ghost" size="sm" onClick={() => void refresh(false)} disabled={refreshing}>Try again</Button>
        </div>}

        {loading && !recommendationSet && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: recommendationsPage ? discoverSettings.recommendation_count : 3 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl border bg-muted/40" />)}</div>}

        {!loading && !recommendationSet && !error && <div className="rounded-2xl border border-dashed p-10 text-center">
          <Compass className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h3 className="font-semibold">Add a few finished books to get started</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Recommendations use your finished books, ratings, favorite authors, and genres.</p>
        </div>}

        {recommendationSet && recommendations.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center">
          <Compass className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h3 className="font-semibold">{hasTasteHistory ? "We couldn't find recommendations right now" : "Add a few finished books to get started"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{hasTasteHistory ? "Try again later, or add more ratings and genres to your finished books." : "Recommendations use your finished books, ratings, favorite authors, and genres."}</p>
        </div>}

        {visibleRecommendations.length > 0 && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleRecommendations.map((item) => {
            const candidateKey = recommendationKey(item);
            const disliked = dislikedKeys.has(candidateKey);
            return <div key={candidateKey} className="group relative flex min-h-[15rem] overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md">
            <button type="button" onClick={() => setSelected(item)} className="flex min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="relative min-h-[15rem] w-28 shrink-0 self-stretch bg-muted sm:w-32">
              {item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-center" /> : <div className="absolute inset-0 flex items-center justify-center"><BookOpen className="h-8 w-8 text-muted-foreground/60" /></div>}
            </div>
            <div className="flex min-w-0 flex-col p-4 pr-12 pb-12">
              <span className="line-clamp-3 font-semibold leading-snug">{item.title}</span>
              <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.authors.join(", ")}</span>
              {item.genres.length > 0 && <div className="mt-auto flex flex-wrap gap-1 pt-4">
                {item.genres.slice(0, 3).map((genre) => <span key={genre} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{genre}</span>)}
                {item.genres.length > 3 && <span className="px-1 py-0.5 text-[10px] text-muted-foreground">+{item.genres.length - 3}</span>}
              </div>}
            </div>
            </button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-2 top-2 h-8 w-8"
              aria-label="Save to wishlist"
              title="Save to wishlist"
              onClick={() => wishlistSelected(item)}
            >
              <Bookmark className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={disliked ? "destructive" : "ghost"}
              className="absolute bottom-2 right-2 h-8 w-8"
              aria-label={disliked ? "Undo not interested" : "Not interested"}
              title={disliked ? "Undo not interested" : "Not interested"}
              disabled={savingFeedbackKey !== null}
              onClick={() => void toggleRecommendationFeedback(item)}
            >
              {savingFeedbackKey === candidateKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
            </Button>
          </div>;
          })}
        </div>}
        {!recommendationsPage && recommendations.length > 3 && <div className="flex justify-center sm:hidden">
          <Button asChild variant="link" className="px-0">
            <Link to="/discover/recommendations">
              View more
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>}
        {recommendationsPage && recommendations.length > recommendationLimit && recommendationLimit < 12 && <div className="flex justify-center">
          <Button variant="ghost" onClick={() => setMoreCount((count) => Math.min(12 - discoverSettings.recommendation_count, count + 3))}>More recommendations</Button>
        </div>}
      </section>

      {recommendationsPage && <section className="space-y-4" aria-labelledby="continue-heading">
        <div>
          <AppHeading level={3} as="h3" id="continue-heading">Continue your reading</AppHeading>
          <p className="mt-1 text-sm text-muted-foreground">Next books from series represented in your library.</p>
        </div>
        {(booksLoading || seriesLoading || seriesSearchLoading) && continuationCards.length === 0 ? <div className="h-24 animate-pulse rounded-xl bg-muted/40" /> : continuationCards.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      </section>}

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

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
            {selected.coverUrl ? <img src={selected.coverUrl} alt={`Cover of ${selected.title}`} className="mx-auto max-h-64 rounded-lg object-contain sm:mx-0" /> : <div className="flex h-56 items-center justify-center rounded-lg bg-muted"><BookOpen className="h-10 w-10 text-muted-foreground" /></div>}
            <div className="space-y-3"><DialogHeader><DialogTitle>{selected.title}</DialogTitle></DialogHeader><p className="text-muted-foreground">{selected.authors.join(", ")}</p>
              {selected.description && <p className="max-h-40 overflow-y-auto whitespace-pre-line text-sm">{selected.description}</p>}
              {selected.genres.length > 0 && <div className="flex flex-wrap gap-1.5" aria-label="Genres">
                {selected.genres.map((genre) => <span key={genre} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{genre}</span>)}
              </div>}
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">View catalogue source <ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button variant="ghost" className="text-muted-foreground" title="Remove from recommendations" disabled={removingRecommendationKey !== null} onClick={() => void removeRecommendation(selected)}>{removingRecommendationKey === recommendationKey(selected) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}Remove</Button>
              <Button type="button" size="icon" variant={dislikedKeys.has(recommendationKey(selected)) ? "destructive" : "ghost"} className="h-8 w-8" aria-label={dislikedKeys.has(recommendationKey(selected)) ? "Undo not interested" : "Not interested"} title={dislikedKeys.has(recommendationKey(selected)) ? "Undo not interested" : "Not interested"} disabled={savingFeedbackKey !== null} onClick={() => void toggleRecommendationFeedback(selected)}>
                {savingFeedbackKey === recommendationKey(selected) ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => addSelected(selected)}>Add to Library</Button><Button onClick={() => wishlistSelected(selected)}><Bookmark className="mr-2 h-4 w-4" />Add to Wishlist</Button></div>
          </div>
        </DialogContent>}
      </Dialog>
    </div>
  );
}

function bookKey(book: Book): string {
  const isbn = (book.isbn ?? "").replace(/[^\dXx]/g, "").toUpperCase();
  return isbn ? `isbn:${isbn}` : `title:${normalizeTitle(book.title)}|${book.authors.map(normalizeText).sort().join("|")}`;
}

function isOwned(item: RecommendationItem, owned: Set<string>): boolean {
  const isbn = (item.isbn ?? "").replace(/[^\dXx]/g, "").toUpperCase();
  if (isbn && owned.has(`isbn:${isbn}`)) return true;
  const title = normalizeTitle(item.title);
  return [...owned].some((key) => key.startsWith(`title:${title}|`) && item.authors.some((author) => key.split("|").slice(1).includes(normalizeText(author))));
}

function recommendationKey(item: RecommendationItem): string {
  const isbn = (item.isbn ?? "").replace(/[^\dXx]/g, "").toUpperCase();
  if (isbn) return `isbn:${isbn}`;
  const authors = item.authors.map(normalizeText).sort().join("|");
  const title = normalizeText(item.title).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return `title:${title}|${authors}`;
}

function wishlistItemKey(item: { isbn?: string | null; title: string; authors: string[] }): string {
  const isbn = (item.isbn ?? "").replace(/[^\dXx]/g, "").toUpperCase();
  if (isbn) return `isbn:${isbn}`;
  return `title:${normalizeText(item.title).replace(/[^\p{L}\p{N}]+/gu, " ").trim()}|${item.authors.map(normalizeText).sort().join("|")}`;
}

function normalizeText(value: string): string { return value.trim().toLocaleLowerCase().replace(/\s+/g, " "); }
function normalizeTitle(value: string): string {
  return normalizeText(value)
    .replace(/\([^)]*(?:edition|revised|anniversary|volume|vol\.)[^)]*\)/gi, " ")
    .replace(/\b(?:illustrated|revised|updated|anniversary|deluxe|expanded|special|collector'?s) edition\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }

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
