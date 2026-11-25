import { Heart } from "lucide-react";
import { SeriesCoverStack, type SeriesCoverBook } from "./SeriesCoverStack";
import { cn } from "@/lib/utils";
import "./library-preview.css";

export function SeriesCard({ title, books, onOpen, shelf = false, favorite }: {
  title: string;
  books: SeriesCoverBook[];
  onOpen: () => void;
  shelf?: boolean;
  favorite?: boolean;
}) {
  return (
    <article className={cn("rj-series-card", shelf && "rj-series-shelf-card")} data-shelf-item={shelf || undefined}>
      <SeriesCoverStack books={books} showPaused={shelf} />
      <button type="button" className="rj-book-title rj-library-title rj-series-card-title" onClick={onOpen}>
        {title}
      </button>
      {shelf && <p className="rj-muted rj-series-card-count">{books.length} {books.length === 1 ? "book" : "books"}</p>}
      {favorite && shelf && <Heart className="rj-series-card-favorite" role="img" aria-label="Favorite series" />}
    </article>
  );
}
