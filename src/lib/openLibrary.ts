export interface OpenLibraryBookData {
  title: string;
  author: string;
  totalPages?: number;
  genre?: string;
  language?: string;
  format?: string;
  coverUrl?: string;
}

interface OpenLibraryEdition {
  title?: string;
  authors?: { key: string }[];
  works?: { key: string }[];
  number_of_pages?: number;
  subjects?: string[];
  languages?: { key: string }[];
  physical_format?: string;
}

interface OpenLibraryWork {
  authors?: { author: { key: string } }[];
  subjects?: string[];
}

interface OpenLibraryAuthor {
  name?: string;
}

async function resolveAuthorName(authorKey: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org${authorKey}.json`);
    if (!res.ok) return null;
    const data: OpenLibraryAuthor = await res.json();
    return data.name ?? null;
  } catch {
    return null;
  }
}

export async function fetchBookByISBN(
  isbn: string,
): Promise<OpenLibraryBookData | null> {
  const editionRes = await fetch(
    `https://openlibrary.org/isbn/${isbn}.json`,
  );
  if (!editionRes.ok) return null;

  const edition: OpenLibraryEdition = await editionRes.json();

  // Fetch the work record for author/subject fallback
  let work: OpenLibraryWork | null = null;
  const workKey = edition.works?.[0]?.key;
  if (workKey) {
    try {
      const workRes = await fetch(`https://openlibrary.org${workKey}.json`);
      if (workRes.ok) work = await workRes.json();
    } catch {
      // non-critical
    }
  }

  // Resolve author: edition.authors → work.authors fallback
  let author = "Unknown";
  const authorKey =
    edition.authors?.[0]?.key ?? work?.authors?.[0]?.author?.key;
  if (authorKey) {
    const name = await resolveAuthorName(authorKey);
    if (name) author = name;
  }

  // Subjects: prefer edition, fall back to work
  const subjects = edition.subjects ?? work?.subjects;

  // Map Open Library language key to app language
  const languageMap: Record<string, string> = {
    "/languages/eng": "English",
    "/languages/spa": "Spanish",
    "/languages/ger": "German",
    "/languages/fre": "French",
  };
  const langKey = edition.languages?.[0]?.key;
  const language = langKey ? languageMap[langKey] : undefined;

  // Map Open Library physical_format to app format
  const formatMap: Record<string, string> = {
    paperback: "Paperback",
    hardcover: "Hardcover",
    "mass market paperback": "Paperback",
    ebook: "eBook",
    "e-book": "eBook",
  };
  const rawFormat = edition.physical_format?.toLowerCase();
  const format = rawFormat ? formatMap[rawFormat] : undefined;

  return {
    title: edition.title ?? "Untitled",
    author,
    totalPages: edition.number_of_pages ?? undefined,
    genre: subjects?.[0] ?? undefined,
    language,
    format,
    coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
  };
}
