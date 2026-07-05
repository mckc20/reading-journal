import type { Book } from "@/types";

function normalizeGenreName(value: string): string {
  return value.trim().toLowerCase();
}

export function getBookGenreNames(book: Book): string[] {
  return Array.from(
    new Set(
      [
        ...(book.selected_genres?.map((genre) => genre.name) ?? []),
        ...(book.genres ?? []),
      ]
        .map((genre) => genre.trim())
        .filter(Boolean),
    ),
  );
}

export function getMostPopularMatchingGenre(targetGenres: string[], allBooks: Book[]): string | null {
  const targetNames = new Map(
    targetGenres
      .map((genre) => genre.trim())
      .filter(Boolean)
      .map((genre) => [normalizeGenreName(genre), genre] as const),
  );
  if (targetNames.size === 0) return null;

  const counts = new Map<string, { name: string; count: number }>();

  allBooks.forEach((book) => {
    getBookGenreNames(book).forEach((genre) => {
      const key = normalizeGenreName(genre);
      const targetName = targetNames.get(key);
      if (!targetName) return;

      const current = counts.get(key);
      counts.set(key, {
        name: targetName,
        count: (current?.count ?? 0) + 1,
      });
    });
  });

  return (
    [...counts.values()].sort(
      (left, right) =>
        right.count - left.count ||
        left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true }),
    )[0]?.name ?? null
  );
}

export function bookHasGenreName(book: Book, genreName: string): boolean {
  const normalizedGenre = normalizeGenreName(genreName);
  return getBookGenreNames(book).some((genre) => normalizeGenreName(genre) === normalizedGenre);
}
