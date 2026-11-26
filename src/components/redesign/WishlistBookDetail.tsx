import { Fragment, useId, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { AppLayoutOutletContext } from "@/components/AppLayout";
import DetailActionsMenu from "@/components/DetailActionsMenu";
import { buildAuthorDetailPath, MetadataLink } from "@/components/LinkedMetadata";
import { BookCover } from "@/components/reading-journal/BookCover";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useBookHeroColor } from "@/hooks/useDominantImageColor";
import { findAuthorSummary } from "@/lib/authorShelf";
import type { Book, Series } from "@/types";
import { BookDetailAbout } from "./BookDetailAbout";
import { WishlistBookActions } from "./WishlistBookActions";
import { DetailHero } from "./DetailHero";
import { DetailBack } from "./DetailSheet";

export const wishlistCollectionHref = "/library/collections?collection=Wishlist";

export function WishlistBookDetail({ book, series, onClose }: {
  book: Book;
  series?: Pick<Series, "id" | "name">;
  onClose: () => void;
}) {
  const headingId = useId();
  const { openAddBook } = useOutletContext<AppLayoutOutletContext>();
  const { authors } = useAuthorsContext();
  const { deleteBook } = useBooksContext();
  const color = useBookHeroColor(book.cover_url);
  const wishlistQuery = new URLSearchParams({ wishlistBook: book.id });
  const [error, setError] = useState<string | null>(null);

  async function removeBook() {
    try {
      await deleteBook(book.id);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete this book.");
    }
  }

  return <div className="rj-detail-page">
    <DetailHero titleId={headingId} color={color}
      navigation={<DetailBack label="Book details" fallbackTo={wishlistCollectionHref} onClose={onClose} />}
      artwork={<BookCover src={book.cover_url} title={book.title} className="rj-detail-cover" showFallbackTitle />}
      actions={<DetailActionsMenu kind="book" label={book.title}
        onEdit={trigger => openAddBook({ editBook: book }, trigger)}
        onDuplicate={trigger => openAddBook({ duplicateBooks: [book] }, trigger)}
        onDelete={removeBook} deleteTitle="Delete this book?"
        deleteDescription="This removes the book and any saved journal and reading data." />}>
      {series && <p className="mb-2 break-words text-lg text-muted-foreground sm:text-xl">
        <MetadataLink to={`/series/${encodeURIComponent(series.id)}?${wishlistQuery}`}>{series.name}</MetadataLink>
        {book.volume_number != null && ` #${book.volume_number}`}
      </p>}
      <h1 id={headingId} className="rj-detail-title rj-detail-title-italic">{book.title}</h1>
      {book.authors.length > 0 && <p className="rj-detail-author break-words">
        {book.authors.map((author, index) => <Fragment key={author}>
          {index > 0 && ", "}
          <MetadataLink to={`${buildAuthorDetailPath(findAuthorSummary(authors, author)?.id ?? author)}?${wishlistQuery}`}>{author}</MetadataLink>
        </Fragment>)}
      </p>}
      <WishlistBookActions book={book} />
      {error && <p className="rj-detail-notice text-sm text-destructive" role="alert">{error}</p>}
    </DetailHero>
    <div className="rj-detail-body"><BookDetailAbout book={book} /></div>
  </div>;
}
