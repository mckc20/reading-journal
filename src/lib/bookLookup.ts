export interface BookLookupResult {
  title: string;
  authors: string[];
  totalPages?: number;
  genres?: string[];
  language?: string;
  format?: string;
  coverUrl?: string;
}

interface GoogleBooksVolume {
  items?: {
    volumeInfo: {
      title?: string;
      authors?: string[];
      pageCount?: number;
      categories?: string[];
      language?: string;
    };
  }[];
}

interface BookcoverResponse {
  url?: string;
}

const languageMap: Record<string, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
};

async function fetchGoogleBooksMetadata(
  isbn: string,
): Promise<GoogleBooksVolume["items"]> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
  );
  if (!res.ok) return undefined;
  const data: GoogleBooksVolume = await res.json();
  return data.items;
}

async function fetchBookcoverUrl(isbn: string): Promise<string | null> {
  const res = await fetch(
    `https://bookcover.longitood.com/bookcover?isbn=${isbn}`,
  );
  if (!res.ok) return null;
  const data: BookcoverResponse = await res.json();
  return data.url ?? null;
}

export async function fetchBookByISBN(
  isbn: string,
): Promise<BookLookupResult | null> {
  const [items, coverUrl] = await Promise.all([
    fetchGoogleBooksMetadata(isbn),
    fetchBookcoverUrl(isbn).catch(() => null),
  ]);

  if (!items || items.length === 0) return null;

  const info = items[0].volumeInfo;
  const authors = Array.from(
    new Set((info.authors ?? []).map((author) => author.trim()).filter(Boolean)),
  );

  return {
    title: info.title ?? "Untitled",
    authors: authors.length > 0 ? authors : ["Unknown"],
    totalPages: info.pageCount,
    genres: info.categories?.map((genre) => genre.trim()).filter(Boolean),
    language: info.language ? languageMap[info.language] : undefined,
    coverUrl: coverUrl ?? undefined,
  };
}
