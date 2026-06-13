export const BOOK_GENRES = [
  "Fiction",
  "Contemporary Fiction",
  "Historical Fiction",
  "Literary Fiction",
  "Romance",
  "Mystery & Crime",
  "Thriller & Suspense",
  "Science Fiction",
  "Fantasy",
  "Horror",
  "Action & Adventure",
  "Humor & Satire",
  "Biography & Memoir",
  "History",
  "True Crime",
  "Politics & Current Events",
  "Self-Help & Personal Development",
  "Business & Economics",
  "Science & Technology",
  "Philosophy & Spirituality",
  "Health & Wellness",
  "Travel",
  "Cookbooks & Food",
  "Art, Photography & Design",
  "Essays & Anthologies",
  "Children's",
  "Middle Grade",
  "Young Adult",
  "New Adult",
  "Adult",
] as const;

export type BookGenre = (typeof BOOK_GENRES)[number];

const GENRE_BY_NORMALIZED_LABEL = new Map(
  BOOK_GENRES.map((genre) => [normalizeGenreLabel(genre), genre])
);

function normalizeGenreLabel(genre: string): string {
  return genre.trim().toLowerCase();
}

export function getAllowedGenres(genres?: string[]): string[] {
  if (!genres) return [];

  return Array.from(
    new Set(
      genres
        .map((genre) => GENRE_BY_NORMALIZED_LABEL.get(normalizeGenreLabel(genre)))
        .filter((genre): genre is BookGenre => Boolean(genre))
    )
  );
}

export function isAllowedGenre(genre: string): boolean {
  return GENRE_BY_NORMALIZED_LABEL.has(normalizeGenreLabel(genre));
}
