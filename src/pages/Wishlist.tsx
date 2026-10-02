import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Download, ExternalLink, Loader2, Trash2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import BookCard from "@/components/BookCard";
import { BookCover } from "@/components/reading-journal";
import { PageHeader, EmptyState } from "@/components/reading-journal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { acquireWishlistItem, fetchWishlist, removeWishlistItem, wishlistCsv } from "@/lib/wishlist";
import type { Book, WishlistItem } from "@/types";

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wishlist.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function wishlistItemAsBook(item: WishlistItem): Book {
  return {
    id: item.book_id ?? item.id,
    title: item.title,
    authors: item.authors ?? [],
    genre_ids: item.genre_ids ?? [],
    genres: item.genres ?? [],
    status: "To Read",
    cover_url: item.cover_url,
    rating: null,
    is_favorite: false,
    total_pages: item.total_pages ?? undefined,
    language: item.language ?? undefined,
    format: item.format ?? undefined,
    isbn: item.isbn ?? undefined,
    publication_date: item.publication_date,
    description: item.description,
    metadata_source: item.metadata_source,
    metadata_source_url: item.metadata_source_url,
    series_id: item.series_id ?? undefined,
    volume_number: item.volume_number ?? undefined,
    user_id: item.user_id,
    created_at: item.created_at,
  };
}

function WishlistCard({
  item,
  book,
  onOpen,
}: {
  item: WishlistItem;
  book: Book;
  onOpen: (item: WishlistItem) => void;
}) {
  return (
    <BookCard
      book={book}
      onClick={() => onOpen(item)}
      textSize="compact"
      footer={!item.book_id ? <Badge variant="outline" className="text-[10px]">Wishlist</Badge> : undefined}
    />
  );
}

export default function Wishlist() {
  const { books, reload: reloadBooks } = useBooksContext();
  const { series } = useSeries();
  const navigate = useNavigate();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [selected, setSelected] = useState<WishlistItem | null>(null);
  const [acquiredOpen, setAcquiredOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await fetchWishlist());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load wishlist.");
    }
  }

  useEffect(() => { void load(); }, []);

  const pending = useMemo(() => items.filter((item) => !item.book_id), [items]);
  const acquired = useMemo(() => items.filter((item) => item.book_id), [items]);
  const selectedBook = selected?.book_id ? books.find((book) => book.id === selected.book_id) : undefined;
  const selectedDetails = selected && {
    title: selectedBook?.title ?? selected.title,
    authors: selectedBook?.authors ?? selected.authors,
    cover: selectedBook?.cover_url ?? selected.cover_url,
    description: selectedBook?.description ?? selected.description,
    genres: selectedBook?.genres ?? selected.genres ?? [],
    language: selectedBook?.language ?? selected.language,
    format: selectedBook?.format ?? selected.format,
    pages: selectedBook?.total_pages ?? selected.total_pages,
    publicationDate: selectedBook?.publication_date ?? selected.publication_date,
    isbn: selectedBook?.isbn ?? selected.isbn,
    metadataSource: selectedBook?.metadata_source ?? selected.metadata_source,
    metadataSourceUrl: selectedBook?.metadata_source_url ?? selected.metadata_source_url,
    seriesId: selectedBook?.series_id ?? selected.series_id,
    volumeNumber: selectedBook?.volume_number ?? selected.volume_number,
    price: selected.price,
    purchaseUrl: selected.purchase_url,
  };

  async function acquire(item: WishlistItem) {
    setSaving(item.id);
    setError(null);
    try {
      const bookId = await acquireWishlistItem(item.id);
      await load();
      await reloadBooks();
      setSelected(null);
      navigate(`/books/${bookId}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not add this book.");
    } finally {
      setSaving(null);
    }
  }

  async function remove(item: WishlistItem) {
    if (!confirm(`Remove “${item.title}” from your wishlist?`)) return;
    setSaving(item.id);
    setError(null);
    try {
      await removeWishlistItem(item);
      setSelected(null);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove this wish.");
    } finally {
      setSaving(null);
    }
  }

  function cardBook(item: WishlistItem): Book {
    return item.book_id ? books.find((book) => book.id === item.book_id) ?? wishlistItemAsBook(item) : wishlistItemAsBook(item);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-1">
        <BackButton fallbackTo="/library" className="mt-0.5 shrink-0" />
        <PageHeader title="Wishlist" description="Books you want to read or have already acquired." />
      </div>

      {error && <p role="status" className="text-sm text-destructive">{error}</p>}

      <section className="rounded-xl border">
        <button className="flex w-full items-center justify-between p-4 text-left font-semibold" onClick={() => setAcquiredOpen(!acquiredOpen)}>
          Acquired books <span className="text-sm font-normal text-muted-foreground">{acquired.length}</span>
        </button>
        {acquiredOpen && <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3 border-t p-4 sm:grid-cols-[repeat(auto-fill,minmax(126px,1fr))] sm:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
          {acquired.map((item) => <WishlistCard key={item.id} item={item} book={cardBook(item)} onOpen={setSelected} />)}
          {!acquired.length && <p className="text-sm text-muted-foreground">No acquired wishlist books yet.</p>}
        </div>}
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Wishlist</h2>
        <Button variant="outline" size="sm" disabled={!items.length} onClick={() => download(wishlistCsv(items))}>
          <Download className="mr-2 h-4 w-4" />Export CSV
        </Button>
      </div>

      {!pending.length ? <EmptyState icon={BookOpen} message="No pending wishes yet." /> : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(126px,1fr))] sm:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
          {pending.map((item) => <WishlistCard key={item.id} item={item} book={wishlistItemAsBook(item)} onOpen={setSelected} />)}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && selectedDetails && <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedDetails.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <BookCover src={selectedDetails.cover} title={selectedDetails.title} className="mx-auto w-32 sm:mx-0 sm:w-full" />
            <div className="min-w-0 space-y-3">
              {selectedDetails.authors.length > 0 && <p className="text-sm text-muted-foreground">{selectedDetails.authors.join(", ")}</p>}
              {selectedDetails.description && <p className="max-h-40 overflow-y-auto whitespace-pre-line text-sm">{selectedDetails.description}</p>}
              {selectedDetails.genres.length > 0 && <div className="flex flex-wrap gap-1.5" aria-label="Genres">
                {selectedDetails.genres.map((genre) => <Badge key={genre} variant="outline" className="normal-case tracking-normal">{genre}</Badge>)}
              </div>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
            {selectedDetails.publicationDate && <div><dt className="text-xs text-muted-foreground">Publication date</dt><dd>{formatDate(selectedDetails.publicationDate)}</dd></div>}
            {selectedDetails.pages && <div><dt className="text-xs text-muted-foreground">Pages</dt><dd>{selectedDetails.pages}</dd></div>}
            {selectedDetails.language && <div><dt className="text-xs text-muted-foreground">Language</dt><dd>{selectedDetails.language}</dd></div>}
            {selectedDetails.format && <div><dt className="text-xs text-muted-foreground">Format</dt><dd>{selectedDetails.format}</dd></div>}
            {selectedDetails.seriesId && <div><dt className="text-xs text-muted-foreground">Series</dt><dd>{series.find((entry) => entry.id === selectedDetails.seriesId)?.name ?? "Series"}</dd></div>}
            {selectedDetails.volumeNumber != null && <div><dt className="text-xs text-muted-foreground">Volume</dt><dd>{selectedDetails.volumeNumber}</dd></div>}
            {selectedDetails.price != null && <div><dt className="text-xs text-muted-foreground">Price</dt><dd>{selectedDetails.price}</dd></div>}
            {selectedDetails.isbn && <div><dt className="text-xs text-muted-foreground">ISBN</dt><dd>{selectedDetails.isbn}</dd></div>}
            {selectedDetails.metadataSource && <div><dt className="text-xs text-muted-foreground">Source</dt><dd className="capitalize">{selectedDetails.metadataSource.replace("_", " ")}</dd></div>}
          </dl>

          {selectedDetails.metadataSourceUrl && <a href={selectedDetails.metadataSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
            View catalogue source <ExternalLink className="h-3.5 w-3.5" />
          </a>}
          {selectedDetails.purchaseUrl && <a href={selectedDetails.purchaseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
            Purchase link <ExternalLink className="h-3.5 w-3.5" />
          </a>}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            {selected.book_id ? <Button asChild variant="outline"><Link to={`/books/${selected.book_id}`}>Open library book</Link></Button> : (
              <Button disabled={saving === selected.id} onClick={() => void acquire(selected)}>
                {saving === selected.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add to Library
              </Button>
            )}
            <Button variant="destructive" size="icon" disabled={saving === selected.id} onClick={() => void remove(selected)} aria-label="Remove from wishlist">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>}
      </Dialog>
    </div>
  );
}
