export const BOOK_GENRES = [
  "Fiction",
  "Fantasy",
  "Science Fiction",
  "Romance",
  "Mystery",
  "Crime",
  "Thriller",
  "Horror",
  "Historical Fiction",
  "Literary Fiction",
  "Contemporary Fiction",
  "Classics",
  "Adventure",
  "Young Adult",
  "Children's",
  "Graphic Novel/Comics",
  "Short Stories",
  "Poetry",
  "Biography",
  "Memoir",
  "History",
  "Science",
  "Psychology",
  "Philosophy",
  "Religion/Spirituality",
  "Self-Help",
  "Business",
  "Politics",
  "Travel",
  "True Crime",
  "Cooking/Food",
  "Art/Design",
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
