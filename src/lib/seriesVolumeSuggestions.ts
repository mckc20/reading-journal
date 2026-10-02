import type { Book, Series } from "@/types";
import type { BookTitleSearchResult } from "@/lib/bookLookup";

export interface SeriesVolumeTarget {
  seriesId: string;
  seriesName: string;
  volumeNumber: number;
  referenceBook: Book;
}

export interface SeriesVolumeSuggestion extends SeriesVolumeTarget {
  candidate: BookTitleSearchResult;
}

export function getNextSeriesVolumeTargets(books: Book[], series: Series[]): SeriesVolumeTarget[] {
  const grouped = new Map<string, Book[]>();
  for (const book of books) {
    if (!book.series_id || !Number.isFinite(book.volume_number)) continue;
    grouped.set(book.series_id, [...(grouped.get(book.series_id) ?? []), book]);
  }

  const seriesById = new Map(series.map((item) => [item.id, item]));
  return [...grouped.entries()].flatMap(([seriesId, group]) => {
    const seriesItem = seriesById.get(seriesId);
    if (!seriesItem) return [];
    const referenceBook = group.reduce((latest, book) =>
      (book.volume_number ?? 0) > (latest.volume_number ?? 0) ? book : latest,
    );
    return [{
      seriesId,
      seriesName: seriesItem.name,
      volumeNumber: (referenceBook.volume_number ?? 0) + 1,
      referenceBook,
    }];
  }).sort((a, b) => a.seriesName.localeCompare(b.seriesName));
}

export function seriesCandidateIdentity(candidate: BookTitleSearchResult): string {
  const isbn = normalizeIsbn(candidate.isbn);
  if (isbn) return `isbn:${isbn}`;
  return `book:${normalizeText(candidate.title)}|${candidate.authors.map(normalizeText).sort().join("|")}`;
}

export function getSeriesCandidateSearchQuery(target: SeriesVolumeTarget): string {
  return `${target.seriesName} volume ${target.volumeNumber}`;
}

export function rankSeriesCandidates(
  target: SeriesVolumeTarget,
  candidates: BookTitleSearchResult[],
  books: Book[],
  rejectedIdentities: Set<string>,
): BookTitleSearchResult[] {
  const unique = new Map<string, BookTitleSearchResult>();
  for (const candidate of candidates) {
    const identity = seriesCandidateIdentity(candidate);
    if (rejectedIdentities.has(identity) || isAlreadyOwned(candidate, books)) continue;
    if (!unique.has(identity)) unique.set(identity, candidate);
  }

  const seriesTerms = meaningfulWords(target.seriesName);
  const targetVolume = new RegExp(`\\b(?:book|volume|vol\\.?|#)\\s*${escapeRegExp(String(target.volumeNumber))}\\b`, "i");
  const referenceAuthors = new Set(target.referenceBook.authors
    .filter((author) => author.trim() && !/^unknown$/i.test(author.trim()))
    .map(normalizeText));
  return [...unique.values()]
    .map((candidate) => ({
      candidate,
      score: candidateRelevance(candidate, target, seriesTerms, targetVolume, referenceAuthors),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title, undefined, { sensitivity: "base" }))
    .map((entry) => entry.candidate);
}

function candidateRelevance(
  candidate: BookTitleSearchResult,
  target: SeriesVolumeTarget,
  seriesTerms: string[],
  targetVolume: RegExp,
  referenceAuthors: Set<string>,
): number {
  const title = normalizeText(candidate.title);
  const searchableText = normalizeText(`${candidate.title} ${candidate.description ?? ""}`);
  const matchedTerms = seriesTerms.filter((term) => searchableText.includes(term)).length;
  const exactSeriesInTitle = title.includes(normalizeText(target.seriesName));
  const volumeMentioned = targetVolume.test(`${candidate.title} ${candidate.description ?? ""}`);
  const authorMatch = candidate.authors.some((author) => referenceAuthors.has(normalizeText(author)));
  return (exactSeriesInTitle ? 8 : matchedTerms * 2) + (volumeMentioned ? 5 : 0) + (authorMatch ? 2 : 0);
}

function isAlreadyOwned(candidate: BookTitleSearchResult, books: Book[]): boolean {
  const candidateIsbn = normalizeIsbn(candidate.isbn);
  return books.some((book) => {
    const ownedIsbn = normalizeIsbn(book.isbn);
    if (candidateIsbn && ownedIsbn && candidateIsbn === ownedIsbn) return true;
    return normalizeText(candidate.title) === normalizeText(book.title) &&
      candidate.authors.some((author) => book.authors.some((ownedAuthor) => normalizeText(author) === normalizeText(ownedAuthor)));
  });
}

function normalizeIsbn(value: string | undefined): string {
  return value?.replace(/[^\dXx]/g, "").toUpperCase() ?? "";
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function meaningfulWords(value: string): string[] {
  const stopWords = new Set(["the", "and", "for", "from", "into", "with"]);
  return normalizeText(value).split(" ").filter((word) => word.length > 2 && !stopWords.has(word));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
