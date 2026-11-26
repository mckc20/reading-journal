import type { RecommendationItem } from "../types/recommendations.js";

export function recommendationCandidateKey(item: Pick<RecommendationItem, "title" | "authors" | "isbn">): string {
  const isbn = (item.isbn ?? "").replace(/[^\dXx]/g, "").toUpperCase();
  if (isbn) return `isbn:${isbn}`;
  const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const title = normalize(item.title).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return `title:${title}|${item.authors.map(normalize).sort().join("|")}`;
}

export const recommendationShelfPath = "/#recommendations";

export function recommendationDetailPath(key: string) {
  return `/books/recommendation/${encodeURIComponent(key)}`;
}
