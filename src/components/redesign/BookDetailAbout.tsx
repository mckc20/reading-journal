import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AboutSection } from "@/components/design";
import { buildBookLibraryFilterPath, MetadataLink } from "@/components/LinkedMetadata";
import { useGenresContext } from "@/context/GenresContext";
import { buildGenreSlugLookup, formatGenrePathForDisplay, getSelectedGenreTags } from "@/lib/genreTree";
import { formatPublicationDateForDisplay } from "@/lib/publicationDate";
import type { Book } from "@/types";

export function externalBookUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    // Older records can contain incomplete URLs.
  }
}

function MetadataRow({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

export function BookDetailAbout({ book }: { book: Book }) {
  const { genres } = useGenresContext();
  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);
  const linkedGenres = getSelectedGenreTags(book.selected_genres ?? []);
  const genreLabels = book.genre_paths?.length ? book.genre_paths.map(formatGenrePathForDisplay) : book.genres;
  const [year] = (book.publication_date ?? "").split("-");
  const publicationYear = year && /^\d{4}$/.test(year) ? year : null;
  const isWishlist = book.status === "Wishlist";
  const catalogue = isWishlist && (book.metadata_source === "open_library" ? "Open Library"
    : book.metadata_source === "google_books" ? "Google Books" : null);
  const catalogueUrl = isWishlist ? externalBookUrl(book.metadata_source_url) : undefined;
  const purchaseUrl = isWishlist ? externalBookUrl(book.purchase_url) : undefined;
  const publication = publicationYear && <MetadataRow key="publication" label="Publication Date" value={
    <MetadataLink to={buildBookLibraryFilterPath("publicationYear", publicationYear)}>
      {formatPublicationDateForDisplay(book.publication_date)}
    </MetadataLink>
  } />;
  const format = book.format && <MetadataRow key="format" label="Format" value={<MetadataLink to={buildBookLibraryFilterPath("format", book.format)}>{book.format}</MetadataLink>} />;
  const language = book.language && <MetadataRow key="language" label="Language" value={<MetadataLink to={buildBookLibraryFilterPath("language", book.language)}>{book.language}</MetadataLink>} />;
  const source = book.source && <MetadataRow key="source" label="Source" value={<MetadataLink to={buildBookLibraryFilterPath("source", book.source)}>{book.source}</MetadataLink>} />;
  const isbn = book.isbn && <MetadataRow key="isbn" label="ISBN" value={book.isbn} />;
  const details = isWishlist ? [
    publication,
    book.total_pages != null && <MetadataRow key="pages" label="Pages" value={book.total_pages} />,
    language,
    isbn,
    source,
    (catalogue || catalogueUrl) && <MetadataRow key="catalogue" label={book.source ? "Catalogue" : "Source"} value={
      catalogueUrl ? <a href={catalogueUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{catalogue ?? new URL(catalogueUrl).hostname}</a> : catalogue
    } />,
    format,
    book.price != null && <MetadataRow key="price" label="Price" value={book.price} />,
    purchaseUrl && <MetadataRow key="purchase" label="Purchase" value={<a href={purchaseUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">Purchase link</a>} />,
  ] : [format, language, source, publication, isbn];

  return <div>
    <AboutSection className="rj-detail-description" title="About this book" text={book.description}
      titleContent={<div className="rj-detail-tags">
        {linkedGenres.length
          ? linkedGenres.map(genre => <Link key={genre.id} to={`/genres/${slugById.get(genre.id) ?? genre.id}`}>{genre.name}</Link>)
          : genreLabels?.map(label => <span key={label}>{label}</span>)}
      </div>} />
    {details.some(Boolean) && <details className="rj-detail-metadata">
      <summary>More book details</summary>
      <dl>{details}</dl>
    </details>}
  </div>;
}
