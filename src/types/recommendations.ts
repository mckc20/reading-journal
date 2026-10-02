import type { BookMetadataSource } from "./index";

export interface RecommendationItem {
  id: string;
  source: BookMetadataSource;
  sourceUrl: string;
  title: string;
  authors: string[];
  genres: string[];
  isbn?: string;
  coverUrl?: string;
  description?: string;
  language?: string;
  pageCount?: number;
  publicationDate?: string;
  score: number;
  reasons: string[];
}

export interface RecommendationSet {
  items: RecommendationItem[];
  generated_at: string;
  expires_at: string;
  strategy_version: string;
  taste_fingerprint: string;
}
