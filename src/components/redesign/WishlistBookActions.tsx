import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { acquireWishlistItem } from "@/lib/wishlist";
import type { Book } from "@/types";
import { externalBookUrl } from "./BookDetailAbout";

export function WishlistBookActions({ book }: { book: Book }) {
  const { reload } = useBooksContext();
  const source = externalBookUrl(book.metadata_source_url) ?? externalBookUrl(book.purchase_url);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addToLibrary() {
    if (adding) return;
    setAdding(true);
    setError(null);
    try {
      await acquireWishlistItem(book.id);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not add this book to your library.");
    } finally {
      setAdding(false);
    }
  }

  return <>
    <div className="rj-detail-actions rj-wishlist-detail-actions">
      <Button type="button" onClick={() => void addToLibrary()} disabled={adding}>
        {adding && <Loader2 className="animate-spin" aria-hidden="true" />}
        {adding ? "Adding…" : "Add to library"}
      </Button>
      {source ? <Button variant="outline" asChild>
        <a href={source} target="_blank" rel="noreferrer">View source <ExternalLink aria-hidden="true" /></a>
      </Button> : <Button type="button" variant="outline" disabled>View source</Button>}
    </div>
    {error && <p className="rj-detail-notice text-sm text-destructive" role="alert">{error}</p>}
  </>;
}
