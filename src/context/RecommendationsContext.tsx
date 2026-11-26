import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useUserSettings } from "@/context/UserSettingsContext";
import { useBooksContext } from "@/context/BooksContext";
import { recommendationCandidateKey } from "@/lib/recommendationIdentity";
import { findWishlistDuplicates } from "@/lib/wishlistLogic";
import type { RecommendationItem, RecommendationSet } from "@/types/recommendations";

interface RecommendationFeedback {
  candidate_key: string;
  item: RecommendationItem;
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
  loading: boolean;
  error: string | null;
  retry: () => void;
  disliked: ReadonlySet<string>;
  dismiss: (item: RecommendationItem) => Promise<void>;
  toggleDislike: (item: RecommendationItem) => Promise<boolean>;
}

const RecommendationsContext = createContext<Recommendations | null>(null);

export function RecommendationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { settings, loading: settingsLoading } = useUserSettings();
  const { books, wishlistBooks, loading: booksLoading } = useBooksContext();
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const enabled = onHome || pathname.startsWith("/books/recommendation/");
  const hideDisliked = settings?.discover.hide_disliked_recommendations ?? false;
  const [set, setRecommendations] = useState<RecommendationSet | null>(null);
  const [feedback, setFeedback] = useState<RecommendationFeedback[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const refreshAfterFeedback = useRef(false);
  const revision = useRef(0);
  const retry = useCallback(() => setRequestVersion(version => version + 1), []);

  useEffect(() => {
    if (!enabled || !token) return;
    const controller = new AbortController();
    const { signal } = controller;
    const initialRevision = revision.current;
    let poll: number | undefined;
    let forceRefresh = refreshAfterFeedback.current;
    setLoading(true);

    function apply(result: RecommendationResponse) {
      if (signal.aborted) return;
      if (result.set !== undefined) setRecommendations(result.set);
      if (result.feedback && revision.current === initialRevision) setFeedback(result.feedback);
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
        if (!current.generating && (current.stale || forceRefresh)) {
          result = await requestRecommendations(token, "", "POST", forceRefresh ? { force: true, feedbackRefresh: true } : {}, signal);
          if (signal.aborted) return;
          forceRefresh = false;
          refreshAfterFeedback.current = false;
          apply(result);
        }
        if (signal.aborted) return;
        if (result.generating) {
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
  }, [enabled, token, requestVersion]);

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
  const items = useMemo(() => {
    const candidates = (set?.items ?? []).filter(item => !disliked.has(recommendationCandidateKey(item)));
    if (!hideDisliked) candidates.push(...feedback.map(row => row.item));
    return [...new Map(candidates.flatMap(item => {
      if (!item) return [];
      const key = recommendationCandidateKey(item);
      return !dismissed.has(key) && findWishlistDuplicates(savedBooks, item).length === 0 ? [[key, item] as const] : [];
    })).values()];
  }, [set, disliked, hideDisliked, feedback, savedBooks, dismissed]);

  const shelfKeys = onHome && !booksLoading && !settingsLoading ? items.map(recommendationCandidateKey).join("\n") : "";
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

  async function toggleDislike(item: RecommendationItem) {
    if (!token) throw new Error("Please sign in again.");
    const key = recommendationCandidateKey(item);
    const existing = disliked.has(key);
    await requestRecommendations(token, "/feedback", existing ? "DELETE" : "POST", existing ? { candidate_key: key } : { item });
    revision.current += 1;
    setFeedback(current => existing ? current.filter(row => row.candidate_key !== key)
      : [{ candidate_key: key, item }, ...current]);
    if (existing) {
      setRecommendations(current => current && !current.items.some(candidate => recommendationCandidateKey(candidate) === key)
        ? { ...current, items: [...current.items, item] } : current);
    } else if (hideDisliked) {
      refreshAfterFeedback.current = true;
      retry();
    }
    return !existing && hideDisliked;
  }

  return <RecommendationsContext.Provider value={{ items, loading: loading || booksLoading || settingsLoading,
    error, retry, disliked, dismiss, toggleDislike }}>{children}</RecommendationsContext.Provider>;
}

export function useRecommendations() {
  const value = useContext(RecommendationsContext);
  if (!value) throw new Error("Recommendations require RecommendationsProvider.");
  return value;
}
