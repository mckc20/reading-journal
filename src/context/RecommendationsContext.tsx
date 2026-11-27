import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useUserSettings } from "@/context/UserSettingsContext";
import { useBooksContext } from "@/context/BooksContext";
import { recommendationCandidateKey } from "@/lib/recommendationIdentity";
import { findWishlistDuplicates } from "@/lib/wishlistLogic";
import type { Book } from "@/types";
import type { RecommendationItem, RecommendationSet } from "@/types/recommendations";

interface RecommendationFeedback {
  candidate_key: string;
}

interface RecommendationResponse {
  set?: RecommendationSet | null;
  stale?: boolean;
  generating?: boolean;
  feedback?: RecommendationFeedback[];
  error?: string;
}

async function requestRecommendations(
  token: string,
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: object,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const response = await fetch(`/api/recommendations${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body && JSON.stringify(body),
    signal,
  });
  const result = await response.json().catch(() => null) as RecommendationResponse | null;
  if (!result || (!response.ok && (response.status !== 429 || path !== ""))) {
    throw new Error(result?.error ?? "Recommendations are temporarily unavailable.");
  }
  return result;
}

interface Recommendations {
  items: RecommendationItem[];
  findDetail: (key: string | undefined) => RecommendationItem | undefined;
  loading: boolean;
  error: string | null;
  retry: () => void;
  disliked: ReadonlySet<string>;
  feedbackReady: boolean;
  dismiss: (item: RecommendationItem) => Promise<void>;
  toggleDislike: (item: RecommendationItem | Book) => Promise<void>;
}

const RecommendationsContext = createContext<Recommendations | null>(null);

export function RecommendationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { loading: settingsLoading } = useUserSettings();
  const { books, wishlistBooks, loading: booksLoading } = useBooksContext();
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const enabled = onHome || pathname.startsWith("/books/recommendation/");
  const detailBookId = matchPath("/books/:bookId", pathname)?.params.bookId;
  const onWishlistDetail = wishlistBooks.some(book => book.id === detailBookId);
  const [set, setRecommendations] = useState<RecommendationSet | null>(null);
  const [feedback, setFeedback] = useState<RecommendationFeedback[]>([]);
  const [feedbackReady, setFeedbackReady] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const revision = useRef(0);
  const retry = useCallback(() => setRequestVersion(version => version + 1), []);

  useEffect(() => {
    if ((!enabled && !onWishlistDetail) || !token) return;
    const controller = new AbortController();
    const { signal } = controller;
    const initialRevision = revision.current;
    let poll: number | undefined;
    setLoading(true);

    function apply(result: RecommendationResponse) {
      if (signal.aborted) return;
      if (result.set !== undefined) setRecommendations(result.set);
      if (result.feedback && revision.current === initialRevision) {
        setFeedback(result.feedback);
        setFeedbackReady(true);
      }
      setError(result.error ?? null);
    }

    async function load() {
      if (!token) return;
      try {
        setError(null);
        const current = await requestRecommendations(token, "", "GET", undefined, signal);
        apply(current);
        if (signal.aborted) return;
        let result = current;
        if (enabled && !current.generating && current.stale) {
          result = await requestRecommendations(token, "", "POST", {}, signal);
          if (signal.aborted) return;
          apply(result);
        }
        if (signal.aborted) return;
        if (enabled && result.generating) {
          poll = window.setTimeout(() => void load(), 3000);
          return;
        }
        setLoading(false);
      } catch (cause) {
        if (signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load recommendations.");
        setLoading(false);
      }
    }

    void load();
    return () => {
      controller.abort();
      window.clearTimeout(poll);
    };
  }, [enabled, onHome, onWishlistDetail, token, requestVersion]);

  useEffect(() => {
    if (!onHome || !set?.expires_at) return;
    const remaining = Date.parse(set.expires_at) - Date.now();
    if (Number.isFinite(remaining) && remaining > 0) {
      const timer = window.setTimeout(retry, Math.min(remaining, 2_147_483_647));
      return () => window.clearTimeout(timer);
    }
  }, [onHome, retry, requestVersion, set?.expires_at]);

  const savedBooks = useMemo(() => [...books, ...wishlistBooks], [books, wishlistBooks]);
  const disliked = useMemo(() => new Set(feedback.map(row => row.candidate_key)), [feedback]);
  const detailItems = useMemo(() => {
    return [...new Map((set?.items ?? []).flatMap(item => {
      if (!item) return [];
      const key = recommendationCandidateKey(item);
      return !dismissed.has(key) && findWishlistDuplicates(savedBooks, item).length === 0 ? [[key, item] as const] : [];
    })).values()];
  }, [set, savedBooks, dismissed]);
  const items = useMemo(() => [...detailItems].sort((a, b) =>
    Number(disliked.has(recommendationCandidateKey(a))) - Number(disliked.has(recommendationCandidateKey(b)))
  ), [detailItems, disliked]);

  const shelfKeys = onHome && !booksLoading && !settingsLoading ? detailItems.map(recommendationCandidateKey).join("\n") : "";
  useEffect(() => {
    if (token && shelfKeys) {
      void requestRecommendations(token, "/history", "POST", { candidate_keys: shelfKeys.split("\n") }).catch(() => {});
    }
  }, [token, shelfKeys]);

  async function dismiss(item: RecommendationItem) {
    if (!token) throw new Error("Please sign in again.");
    const key = recommendationCandidateKey(item);
    await requestRecommendations(token, "/dismissals", "POST", { item });
    setDismissed(current => new Set([...current, key]));
  }

  async function toggleDislike(item: RecommendationItem | Book) {
    if (!token) throw new Error("Please sign in again.");
    const key = recommendationCandidateKey(item);
    const existing = disliked.has(key);
    const catalogItem = "sourceUrl" in item ? item : null;
    const feedbackBody = catalogItem ? { item: catalogItem } : {
      wishlistBook: { id: item.id, title: item.title, authors: item.authors, genres: item.genres ?? [], isbn: item.isbn ?? undefined },
    };
    await requestRecommendations(token, "/feedback", existing ? "DELETE" : "POST", existing ? { candidate_key: key } : feedbackBody);
    revision.current += 1;
    setFeedback(current => existing ? current.filter(row => row.candidate_key !== key)
      : [{ candidate_key: key }, ...current]);
  }

  return <RecommendationsContext.Provider value={{ items,
    findDetail: key => detailItems.find(item => recommendationCandidateKey(item) === key),
    loading: loading || booksLoading || settingsLoading,
    error, retry, disliked, feedbackReady, dismiss, toggleDislike }}>{children}</RecommendationsContext.Provider>;
}

export function useRecommendations() {
  const value = useContext(RecommendationsContext);
  if (!value) throw new Error("Recommendations require RecommendationsProvider.");
  return value;
}
