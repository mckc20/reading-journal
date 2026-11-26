import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AboutSection } from "@/components/design";
import { buildBookLibraryFilterPath, MetadataLink } from "@/components/LinkedMetadata";
import { formatGenrePathForDisplay, getSelectedGenreTags } from "@/lib/genreTree";
import { getCatalogueName, getPublicationYear } from "@/lib/libraryBookFilters";
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
  const linkedGenres = getSelectedGenreTags(book.selected_genres ?? []);
  const genres = linkedGenres.length
    ? linkedGenres.map(genre => ({ key: genre.id, name: genre.name, label: genre.name }))
    : (book.genres ?? []).map(name => ({ key: name, name, label: formatGenrePathForDisplay(name) }));
  const publicationYear = getPublicationYear(book);
  const isWishlist = book.status === "Wishlist";
  const catalogue = isWishlist ? getCatalogueName(book.metadata_source) : undefined;
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
  const isbn = book.isbn && <MetadataRow key="isbn" label="ISBN" value={
    <MetadataLink to={buildBookLibraryFilterPath("isbn", book.isbn)}>{book.isbn}</MetadataLink>
  } />;
  const pages = book.total_pages != null && <MetadataRow key="pages" label="Pages" value={
    <MetadataLink to={buildBookLibraryFilterPath("pages", String(book.total_pages))}>{book.total_pages}</MetadataLink>
  } />;
  const details = isWishlist ? [
    publication,
    pages,
    language,
    isbn,
    source,
    (catalogue || catalogueUrl) && <MetadataRow key="catalogue" label={book.source ? "Catalogue" : "Source"} value={
      catalogue ? <MetadataLink to={buildBookLibraryFilterPath("catalogue", catalogue)}>{catalogue}</MetadataLink>
        : catalogueUrl && new URL(catalogueUrl).hostname
    } />,
    format,
    book.price != null && <MetadataRow key="price" label="Price" value={
      <MetadataLink to={buildBookLibraryFilterPath("price", String(book.price))}>{book.price}</MetadataLink>
    } />,
    purchaseUrl && <MetadataRow key="purchase" label="Purchase" value={<a href={purchaseUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">Purchase link</a>} />,
  ] : [format, language, source, publication, pages, isbn];

  return <div>
    <AboutSection className="rj-detail-description" title="About this book" text={book.description}
      titleContent={<div className="rj-detail-tags">
        {genres.map(genre => (
          <Link key={genre.key} to={buildBookLibraryFilterPath("genre", genre.name)}>{genre.label}</Link>
        ))}
      </div>} />
    {details.some(Boolean) && <details className="rj-detail-metadata">
      <summary>More book details</summary>
      <dl>{details}</dl>
    </details>}
  </div>;
}
