import { SeriesCard } from "./SeriesCard";
import type { SeriesCoverBook } from "./SeriesCoverStack";
import "./collections-preview.css";

interface LibrarySeriesEntry {
  id: string;
  title: string;
  books: SeriesCoverBook[];
}

export function LibrarySeriesEntries({ entries, onOpen }: {
  entries: LibrarySeriesEntry[];
  onOpen: (id: string) => void;
}) {
  return (
    <ul aria-label="Series collection" data-view="grid" className="rj-collection-grid">
      {entries.map(entry => <li key={entry.id}>
        <SeriesCard title={entry.title} books={entry.books} muted={entry.books.some(book => book.status === "Wishlist")}
          onOpen={() => onOpen(entry.id)} />
      </li>)}
    </ul>
  );
}
