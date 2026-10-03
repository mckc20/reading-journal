import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateUserSession } from "./_lib/auth.js";
import { json, methodNotAllowed } from "./_lib/http.js";
import {
  expiresAt,
  generateRecommendations,
  isRecommendationSetStale,
  recommendationFingerprint,
  recommendationCandidateKey,
  RECOMMENDATION_STRATEGY_VERSION,
  type LibraryBook,
  type RecommendationFeedback,
  type RecommendationHistoryEntry,
} from "./_lib/recommendations.js";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";
import type { RecommendationItem } from "../src/types/recommendations.js";

type RecommendationRow = {
  items: unknown;
  generated_at: string | null;
  expires_at: string | null;
  strategy_version: string | null;
  taste_fingerprint: string | null;
  refresh_started_at: string | null;
};

type FeedbackRow = RecommendationFeedback & { item: unknown };

type DiscoverPreference = {
  reload_interval_number?: number;
  reload_interval_unit?: "day" | "week" | "month";
};

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET" && request.method !== "POST") {
    methodNotAllowed(response, "GET, POST");
    return;
  }
  try {
    const userId = await authenticateUserSession(request);
    if (!userId) {
      json(response, 401, { error: "A valid signed-in session is required." });
      return;
    }
    const admin = getSupabaseAdmin();
    const [booksResult, setResult, settingsResult, feedbackResult, historyResult, dismissalsResult] = await Promise.all([
      admin.from("books").select("title,genres,isbn,status,rating,is_favorite,book_genres(genres(name)),book_authors(position,authors(name))").eq("user_id", userId),
      admin.from("recommendation_sets").select("items,generated_at,expires_at,strategy_version,taste_fingerprint,refresh_started_at").eq("user_id", userId).maybeSingle<RecommendationRow>(),
      admin.from("user_settings").select("discover").eq("user_id", userId).maybeSingle<{ discover: DiscoverPreference | null }>(),
      admin.from("recommendation_feedback").select("candidate_key,title,authors,genres,item").eq("user_id", userId).order("created_at", { ascending: false }),
      admin.from("recommendation_history").select("candidate_key,item,last_seen_at").eq("user_id", userId).order("last_seen_at", { ascending: true }),
      admin.from("recommendation_dismissals").select("candidate_key").eq("user_id", userId),
    ]);
    if (booksResult.error) throw booksResult.error;
    if (setResult.error) throw setResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (feedbackResult.error) throw feedbackResult.error;
    if (historyResult.error) throw historyResult.error;
    if (dismissalsResult.error) throw dismissalsResult.error;
    const dismissedKeys = new Set((dismissalsResult.data ?? []).map((row) => row.candidate_key));
    const preferences = normalizeDiscoverPreference(settingsResult.data?.discover);
    const feedback = (feedbackResult.data ?? []) as FeedbackRow[];
    const history = (historyResult.data ?? []) as RecommendationHistoryEntry[];
    const feedbackSignals = feedback.map(({ candidate_key, title, authors, genres }) => ({ candidate_key, title, authors, genres }));
    const books = (booksResult.data ?? []).map((book) => ({
      title: book.title,
      authors: (book.book_authors ?? [])
        .sort((a, b) => a.position - b.position)
        .map((entry) => {
          const relation = entry.authors as unknown as { name?: string } | { name?: string }[] | null;
          return (Array.isArray(relation) ? relation[0] : relation)?.name ?? "";
        })
        .filter(Boolean),
      genres: book.genres ?? [],
      isbn: book.isbn,
      status: book.status,
      rating: book.rating,
      is_favorite: book.is_favorite,
      book_genres: book.book_genres,
    })) as LibraryBook[];

    const fingerprint = recommendationFingerprint(books, feedbackSignals);
    let row = setResult.data;
    const storedExpiresAt = row?.expires_at;
    if (row?.generated_at) {
      row = { ...row, expires_at: expiresAt(new Date(row.generated_at), preferences) };
    }
    let stale = isRecommendationSetStale(row, fingerprint);
    if (request.method === "GET") {
      json(response, 200, { set: publicSet(row, dismissedKeys), stale, generating: hasActiveLease(row), feedback });
      return;
    }

    if (row?.generated_at && row.expires_at !== storedExpiresAt) {
      const { error } = await admin.from("recommendation_sets")
        .update({ expires_at: row.expires_at })
        .eq("user_id", userId);
      if (error) throw error;
    }

    const body = request.body && typeof request.body === "object" ? request.body as { force?: unknown; feedbackRefresh?: unknown } : {};
    const force = body.force === true;
    const feedbackRefresh = body.feedbackRefresh === true;
    if (!force && !stale) {
      json(response, 200, { set: publicSet(row, dismissedKeys), stale: false, generating: false });
      return;
    }

    const { data: claimed, error: claimError } = await admin.rpc("claim_recommendation_refresh", {
      p_user_id: userId,
      p_force: force,
      p_taste_fingerprint: fingerprint,
      p_strategy_version: RECOMMENDATION_STRATEGY_VERSION,
      p_now: new Date().toISOString(),
      p_lease_seconds: 90,
      p_cooldown_seconds: feedbackRefresh ? 0 : 900,
    });
    if (claimError) throw claimError;
    if (claimed !== true) {
      const { data: current, error } = await admin.from("recommendation_sets")
        .select("items,generated_at,expires_at,strategy_version,taste_fingerprint,refresh_started_at")
        .eq("user_id", userId).maybeSingle<RecommendationRow>();
      if (error) throw error;
      row = current;
      const coolingDown = force && !feedbackRefresh && row?.generated_at && Date.now() - new Date(row.generated_at).getTime() < 15 * 60 * 1000 && !hasActiveLease(row);
      json(response, coolingDown ? 429 : 200, {
        set: publicSet(row, dismissedKeys), stale: isRecommendationSetStale(row, fingerprint),
        generating: hasActiveLease(row), ...(coolingDown ? { error: "Please wait before refreshing again." } : {}),
      });
      return;
    }

    try {
      const previousItems = Array.isArray(row?.items) ? row.items as RecommendationItem[] : [];
      const items = await generateRecommendations(books, feedbackSignals, history, previousItems);
      const generatedAt = new Date();
      const next = {
        user_id: userId,
        items,
        generated_at: generatedAt.toISOString(),
        expires_at: expiresAt(generatedAt, preferences),
        strategy_version: RECOMMENDATION_STRATEGY_VERSION,
        taste_fingerprint: fingerprint,
        refresh_started_at: null,
        updated_at: generatedAt.toISOString(),
      };
      const { error } = await admin.from("recommendation_sets").upsert(next, { onConflict: "user_id" });
      if (error) throw error;
      json(response, 200, { set: { ...next, items: items.filter((item) => !dismissedKeys.has(recommendationCandidateKey(item))), user_id: undefined }, stale: false, generating: false, feedback });
    } catch (error) {
      console.error("Recommendation generation failed", describeError(error));
      await admin.from("recommendation_sets").update({ refresh_started_at: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
      const { data: previous } = await admin.from("recommendation_sets")
        .select("items,generated_at,expires_at,strategy_version,taste_fingerprint,refresh_started_at")
        .eq("user_id", userId).maybeSingle<RecommendationRow>();
      json(response, previous?.generated_at ? 200 : 502, {
        set: publicSet(previous, dismissedKeys), stale: true, generating: false,
        error: "Recommendations could not be refreshed. Your previous recommendations are still available.",
      });
    }
  } catch (error) {
    console.error("Recommendations API failed", describeError(error));
    json(response, 500, { error: "Recommendations are temporarily unavailable." });
  }
}

function normalizeDiscoverPreference(value?: DiscoverPreference | null) {
  const unit = value?.reload_interval_unit && ["day", "week", "month"].includes(value.reload_interval_unit)
    ? value.reload_interval_unit
    : "day";
  const max = unit === "day" ? 30 : unit === "week" ? 4 : 1;
  const number = Number(value?.reload_interval_number ?? 2);
  return { number: Number.isFinite(number) ? Math.max(1, Math.min(max, Math.round(number))) : Math.min(max, 2), unit } as const;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const fields = ["message", "code", "details", "hint"]
      .flatMap((key) => typeof value[key] === "string" && value[key] ? [`${key}: ${value[key]}`] : []);
    if (fields.length) return fields.join(" | ");
  }
  return typeof error === "string" ? error : "unknown error";
}

function hasActiveLease(row: RecommendationRow | null): boolean {
  return Boolean(row?.refresh_started_at && Date.now() - new Date(row.refresh_started_at).getTime() < 90_000);
}

function isRecommendationItem(value: unknown): value is RecommendationItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecommendationItem>;
  return typeof item.id === "string" && typeof item.title === "string" && Array.isArray(item.authors) && Array.isArray(item.genres) && typeof item.source === "string" && typeof item.sourceUrl === "string";
}

function publicSet(row: RecommendationRow | null, dismissedKeys: Set<string> = new Set()): Omit<RecommendationRow, "refresh_started_at"> | null {
  if (!row?.generated_at) return null;
  return {
    items: Array.isArray(row.items) ? row.items.filter((item): item is RecommendationItem => isRecommendationItem(item) && !dismissedKeys.has(recommendationCandidateKey(item))) : [],
    generated_at: row.generated_at,
    expires_at: row.expires_at ?? "",
    strategy_version: row.strategy_version ?? "",
    taste_fingerprint: row.taste_fingerprint ?? "",
  };
}
