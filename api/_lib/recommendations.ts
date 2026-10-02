import { createHash } from "node:crypto";
import type { RecommendationItem } from "../../src/types/recommendations.js";
import type { BookMetadataSource } from "../../src/types/index.js";

export const RECOMMENDATION_STRATEGY_VERSION = "deterministic-v3";
const DAY_MS = 24 * 60 * 60 * 1000;
const WISHLIST_ITEM_STRENGTH = 0.25;
const MAX_WISHLIST_STRENGTH = 1;
const STOP_WORDS = /\b(workbook|study guide|exam|examination|revision|answer key|test prep|practice questions|teacher edition|student edition)\b/i;

export interface LibraryBook {
  title: string;
  authors: string[] | null;
  genres: string[] | null;
  isbn: string | null;
  status: string;
  rating: number | null;
  is_favorite: boolean;
  book_genres?: Array<{ genres?: { name?: string } | null }> | null;
}

export interface Taste {
  authors: TasteSignal[];
  genres: TasteSignal[];
}

export interface TasteSignal {
  name: string;
  strength: number;
  finishedStrength: number;
  wishlistStrength: number;
}

export interface RecommendationFeedback {
  candidate_key: string;
  title: string;
  authors: string[];
  genres: string[];
}

export interface RecommendationHistoryEntry {
  candidate_key: string;
  item: RecommendationItem;
  last_seen_at?: string;
}

export function tasteForBooks(books: LibraryBook[]): Taste {
  const authors = new Map<string, TasteSignal>();
  const genres = new Map<string, TasteSignal>();
  for (const book of books) {
    const isWishlistItem = book.status === "Wishlist";
    if (!isWishlistItem && (book.status !== "Finished" || (book.rating ?? 3) < 3)) continue;
    const strength = isWishlistItem
      ? WISHLIST_ITEM_STRENGTH
      : (book.rating === 5 ? 3 : book.rating === 4 ? 2 : 1) + (book.is_favorite ? 1 : 0);
    const addStrength = (signals: Map<string, TasteSignal>, name: string, seenOnWishlistItem?: Set<string>) => {
      const clean = name.trim();
      if (!clean || /^unknown$/i.test(clean)) return;
      const key = clean.toLocaleLowerCase();
      if (seenOnWishlistItem?.has(key)) return;
      seenOnWishlistItem?.add(key);
      const signal = signals.get(key) ?? { name: clean, strength: 0, finishedStrength: 0, wishlistStrength: 0 };
      if (isWishlistItem) signal.wishlistStrength = Math.min(MAX_WISHLIST_STRENGTH, signal.wishlistStrength + strength);
      else signal.finishedStrength += strength;
      signal.strength = signal.finishedStrength + signal.wishlistStrength;
      signals.set(key, signal);
    };
    const seenAuthors = isWishlistItem ? new Set<string>() : undefined;
    for (const name of book.authors ?? []) addStrength(authors, name, seenAuthors);
    const bookGenres = [
      ...(book.genres ?? []),
      ...(book.book_genres ?? []).map((item) => item.genres?.name ?? ""),
    ];
    const seenGenres = isWishlistItem ? new Set<string>() : undefined;
    for (const name of bookGenres) addStrength(genres, name, seenGenres);
  }
  const sort = (a: TasteSignal, b: TasteSignal) =>
    b.strength - a.strength || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  return { authors: [...authors.values()].sort(sort), genres: [...genres.values()].sort(sort) };
}

export function recommendationFingerprint(books: LibraryBook[], feedback: RecommendationFeedback[] = []): string {
  const relevant = books.map((book) => ({
    title: normalizeTitle(book.title), authors: [...(book.authors ?? [])].map(norm).sort(),
    genres: [...(book.genres ?? []), ...(book.book_genres ?? []).map((item) => item.genres?.name ?? "")].map(norm).sort(),
    isbn: normalizeIsbn(book.isbn ?? ""), status: book.status, rating: book.rating, favorite: book.is_favorite,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const negativeSignals = feedback.map((item) => ({
    candidate_key: item.candidate_key,
    authors: item.authors.map(norm).sort(),
    genres: item.genres.map(norm).sort(),
  })).sort((a, b) => a.candidate_key.localeCompare(b.candidate_key));
  return createHash("sha256").update(JSON.stringify({ books: relevant, feedback: negativeSignals })).digest("hex");
}

export function isRecommendationSetStale(row: any, fingerprint: string, now = Date.now()): boolean {
  return !row?.generated_at || !row?.expires_at || new Date(row.expires_at).getTime() <= now ||
    row.strategy_version !== RECOMMENDATION_STRATEGY_VERSION || row.taste_fingerprint !== fingerprint;
}

export async function generateRecommendations(
  books: LibraryBook[],
  feedback: RecommendationFeedback[] = [],
  history: RecommendationHistoryEntry[] = [],
  previousItems: RecommendationItem[] = [],
): Promise<RecommendationItem[]> {
  const taste = tasteForBooks(books);
  if (!taste.authors.length && !taste.genres.length) {
    return selectRecommendationMix([], previousItems, history, feedback, books);
  }
  const terms = [
    ...taste.authors.slice(0, 4).map((item) => ({ kind: "author" as const, name: item.name })),
    ...taste.genres.slice(0, 6).map((item) => ({ kind: "genre" as const, name: item.name })),
  ];
  const googleLists = await Promise.all(terms.map(async (term) => {
    try { return await searchGoogle(term); } catch (error) {
      console.warn("Recommendation Google Books search failed", error instanceof Error ? error.message : "unknown error");
      return [];
    }
  }));
  const candidates = googleLists.flat();
  const viable = rankCandidates(candidates, books, taste, feedback);
  const seenKeys = new Set(history.map((entry) => entry.candidate_key));
  const novelCount = viable.filter((item) => !seenKeys.has(recommendationCandidateKey(item)) &&
    !feedback.some((entry) => entry.candidate_key === recommendationCandidateKey(item))).length;
  if (viable.length < 12 || novelCount < 6) {
    const openLists = await Promise.all(terms.map(async (term) => {
      try { return await searchOpenLibrary(term); } catch (error) {
        console.warn("Recommendation Open Library search failed", error instanceof Error ? error.message : "unknown error");
        return [];
      }
    }));
    candidates.push(...openLists.flat());
  }
  return selectRecommendationMix(rankCandidates(candidates, books, taste, feedback), previousItems, history, feedback, books);
}

export function selectRecommendationMix(
  rankedCandidates: RecommendationItem[],
  previousItems: RecommendationItem[] = [],
  history: RecommendationHistoryEntry[] = [],
  feedback: RecommendationFeedback[] = [],
  books: LibraryBook[] = [],
  limit = 12,
): RecommendationItem[] {
  const dislikedKeys = new Set(feedback.map((entry) => entry.candidate_key));
  const seenKeys = new Set(history.map((entry) => entry.candidate_key));
  const unseen: RecommendationItem[] = [];
  const reusable: RecommendationItem[] = [];
  const seenInPool = new Set<string>();
  const addUnique = (target: RecommendationItem[], item: RecommendationItem) => {
    const key = recommendationCandidateKey(item);
    if (seenInPool.has(key) || dislikedKeys.has(key) || isOwnedCandidate(item, books)) return;
    seenInPool.add(key);
    target.push(item);
  };

  for (const item of rankedCandidates) {
    const key = recommendationCandidateKey(item);
    if (seenKeys.has(key)) addUnique(reusable, item);
    else addUnique(unseen, item);
  }
  for (const item of previousItems) {
    addUnique(seenKeys.has(recommendationCandidateKey(item)) ? reusable : unseen, item);
  }
  for (const item of history.map((entry) => entry.item)) {
    addUnique(reusable, item);
  }
  const lastSeenByKey = new Map(history.map((entry) => [entry.candidate_key, Date.parse(entry.last_seen_at ?? "") || 0]));
  reusable.sort((a, b) => (lastSeenByKey.get(recommendationCandidateKey(a)) ?? 0) -
    (lastSeenByKey.get(recommendationCandidateKey(b)) ?? 0) ||
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  const targetNew = Math.ceil(limit / 2);
  const newCount = Math.min(unseen.length, Math.max(targetNew, limit - Math.min(targetNew, reusable.length)));
  const oldCount = Math.min(reusable.length, limit - newCount);
  const fresh = unseen.slice(0, newCount);
  const reused = reusable.slice(0, oldCount);
  const selected: RecommendationItem[] = [];
  for (let index = 0; selected.length < limit && (index < fresh.length || index < reused.length); index += 1) {
    if (index < fresh.length) selected.push(fresh[index]);
    if (selected.length < limit && index < reused.length) selected.push(reused[index]);
  }
  for (const item of [...unseen.slice(newCount), ...reusable.slice(oldCount)]) {
    if (selected.length >= limit) break;
    selected.push(item);
  }
  return selected;
}

function isOwnedCandidate(item: RecommendationItem, books: LibraryBook[]): boolean {
  const isbn = normalizeIsbn(item.isbn ?? "");
  if (isbn && books.some((book) => normalizeIsbn(book.isbn ?? "") === isbn)) return true;
  const title = normalizeTitle(item.title);
  const authors = item.authors.map(norm);
  return books.some((book) => normalizeTitle(book.title) === title &&
    authors.some((author) => (book.authors ?? []).some((existing) => norm(existing) === author)));
}

export function expiresAt(
  generatedAt = new Date(),
  interval: { number: number; unit: "day" | "week" | "month" } = { number: 2, unit: "day" },
): string {
  const days = interval.unit === "week" ? interval.number * 7 : interval.unit === "month" ? interval.number * 30 : interval.number;
  return new Date(generatedAt.getTime() + days * DAY_MS).toISOString();
}

function norm(value: string): string { return value.trim().toLocaleLowerCase().replace(/\s+/g, " "); }
function normalizeIsbn(value: string): string { return value.replace(/[^\dXx]/g, "").toUpperCase(); }
export function normalizeTitle(value: string): string {
  return norm(value).replace(/\([^)]*(?:edition|revised|anniversary|volume|vol\.)[^)]*\)/gi, " ")
  .replace(/\b(?:the )?(?:[-])?\b(?:illustrated|revised|updated|anniversary|deluxe) edition\b/gi, " ")
    .replace(/\b(?:illustrated|revised|updated|anniversary|deluxe|expanded|special|collector'?s) edition\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export interface RecommendationCandidate extends Omit<RecommendationItem, "score" | "reasons"> { }
export function recommendationCandidateKey(item: Pick<RecommendationItem, "title" | "authors" | "isbn">): string {
  const isbn = normalizeIsbn(item.isbn ?? "");
  const title = norm(item.title).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return isbn ? `isbn:${isbn}` : `title:${title}|${item.authors.map(norm).sort().join("|")}`;
}

export function rankCandidates(
  candidates: RecommendationCandidate[],
  books: LibraryBook[],
  taste: Taste,
  feedback: RecommendationFeedback[] = [],
): RecommendationItem[] {
  const ownedIsbns = new Set(books.map((book) => normalizeIsbn(book.isbn ?? "")).filter(Boolean));
  const unique = new Map<string, RecommendationItem>();
  for (const item of candidates) {
    if (!item.title || !item.authors.length || item.authors.every((author) => /^unknown$/i.test(author)) || STOP_WORDS.test(item.title)) continue;
    const isbn = normalizeIsbn(item.isbn ?? "");
    if (isbn && ownedIsbns.has(isbn)) continue;
    const titleKey = normalizeTitle(item.title);
    const authorKeys = item.authors.map(norm);
    const owned = books.some((book) => normalizeTitle(book.title) === titleKey &&
      authorKeys.some((author) => (book.authors ?? []).some((existing) => norm(existing) === author)));
    if (owned) continue;

    const authorMatches = taste.authors.filter((signal) => authorKeys.includes(norm(signal.name)));
    const itemGenres = item.genres.map(norm);
    const genreMatches = taste.genres.filter((signal) => itemGenres.some((genre) => {
      const signalName = norm(signal.name);
      return genre === signalName || genre.split(/\s*\/\s*/).includes(signalName) ||
        genre.startsWith(`${signalName} `) || signalName.startsWith(`${genre} `);
    }));
    const baseScore = authorMatches.reduce((total, match) => total + 10 * match.strength, 0) +
      genreMatches.reduce((total, match) => total + 3 * match.strength, 0);
    const candidateKey = recommendationCandidateKey(item);
    const exactDislike = feedback.some((entry) => entry.candidate_key === candidateKey);
    const dislikedAuthors = new Set(feedback.flatMap((entry) => entry.authors.map(norm)));
    const dislikedGenres = new Set(feedback.flatMap((entry) => entry.genres.map(norm)));
    const traitPenalty = authorKeys.filter((author) => dislikedAuthors.has(author)).length * 5 +
      itemGenres.filter((genre) => dislikedGenres.has(genre)).length * 2;
    const score = baseScore - traitPenalty - (exactDislike ? 1000 : 0);
    if (baseScore <= 0) continue;
    const reasons = [
      ...(authorMatches.length ? [authorMatches[0].finishedStrength > 0
        ? `Because you enjoyed books by ${authorMatches[0].name}`
        : `Because you saved books by ${authorMatches[0].name} to your Wishlist`] : []),
      ...(genreMatches.length ? [genreMatches[0].finishedStrength > 0
        ? `Because you enjoy ${genreMatches[0].name}`
        : `Because you saved books in ${genreMatches[0].name} to your Wishlist`] : []),
    ];
    const result = { ...item, score, reasons };
    const key = isbn ? `isbn:${isbn}` : `title:${titleKey}|${[...authorKeys].sort().join("|")}`;
    const prior = unique.get(key);
    if (!prior || result.score > prior.score || (result.score === prior.score && result.source < prior.source)) unique.set(key, result);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score ||
    a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }) || a.id.localeCompare(b.id));
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.toString().replace(/^http:/, "https:") : undefined; }
  catch { return undefined; }
}
function strings(values: unknown): string[] {
  return Array.isArray(values) ? [...new Set(values.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean))] : [];
}
// Keep Google + Open Library fallback comfortably inside the serverless request window.
function timeoutSignal(): AbortSignal { return AbortSignal.timeout(2500); }
function normalizedLanguage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.toLowerCase();
  if (["en", "eng", "english"].includes(key)) return "English";
  if (["de", "ger", "deu", "german"].includes(key)) return "German";
  if (["es", "spa", "spanish"].includes(key)) return "Spanish";
  return undefined;
}

async function searchGoogle(term: { kind: "author" | "genre"; name: string }): Promise<RecommendationCandidate[]> {
  const query = `${term.kind === "author" ? "inauthor" : "subject"}:${term.name}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=40&printType=books`;
  const response = await fetch(url, { signal: timeoutSignal() });
  if (!response.ok) throw new Error(`status ${response.status}`);
  const data = await response.json() as { items?: Array<{ id?: string; selfLink?: string; volumeInfo?: any }> };
  return (data.items ?? []).flatMap(({ id, selfLink, volumeInfo: info }) => {
    if (!id || !info?.title) return [];
    const authors = strings(info.authors);
    const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
    const isbn = identifiers.find((item: any) => item.type === "ISBN_13")?.identifier ?? identifiers.find((item: any) => item.type === "ISBN_10")?.identifier;
    return [{ id: `google:${id}`, source: "google_books" as BookMetadataSource,
      sourceUrl: safeUrl(selfLink) ?? `https://books.google.com/books?id=${encodeURIComponent(id)}`,
      title: String(info.title), authors, genres: strings(info.categories), isbn: typeof isbn === "string" ? isbn : undefined,
      coverUrl: safeUrl(info.imageLinks?.thumbnail), description: typeof info.description === "string" ? info.description : undefined,
      language: normalizedLanguage(info.language), pageCount: Number.isFinite(info.pageCount) ? info.pageCount : undefined,
      publicationDate: typeof info.publishedDate === "string" ? info.publishedDate : undefined }];
  });
}

async function searchOpenLibrary(term: { kind: "author" | "genre"; name: string }): Promise<RecommendationCandidate[]> {
  const query = `${term.kind === "author" ? "author" : "subject"}:${term.name}`;
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=40&fields=key,title,author_name,isbn,subject,cover_i,first_publish_year,number_of_pages_median,language,first_sentence`;
  const response = await fetch(url, { signal: timeoutSignal() });
  if (!response.ok) throw new Error(`status ${response.status}`);
  const data = await response.json() as { docs?: Array<any> };
  return (data.docs ?? []).flatMap((doc) => {
    if (!doc.key || !doc.title) return [];
    const key = String(doc.key);
    const isbn = strings(doc.isbn).find((value) => /^\d{13}$/.test(value) || /^\d{9}[\dXx]$/.test(value));
    return [{ id: `openlibrary:${key}`, source: "open_library" as BookMetadataSource,
      sourceUrl: `https://openlibrary.org${key}`, title: String(doc.title), authors: strings(doc.author_name),
      genres: strings(doc.subject).slice(0, 12), isbn, coverUrl: Number.isFinite(doc.cover_i) ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
      language: normalizedLanguage(strings(doc.language)[0]), pageCount: Number.isFinite(doc.number_of_pages_median) ? doc.number_of_pages_median : undefined,
      description: strings(doc.first_sentence)[0],
      publicationDate: Number.isFinite(doc.first_publish_year) ? String(doc.first_publish_year) : undefined }];
  });
}
