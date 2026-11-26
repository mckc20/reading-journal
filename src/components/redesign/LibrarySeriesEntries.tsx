import { SeriesCard } from "./SeriesCard";
import type { SeriesCoverBook } from "./SeriesCoverStack";
import "./collections-preview.css";

interface LibrarySeriesEntry {
  id: string;
  title: string;
  books: SeriesCoverBook[];
}

export function LibrarySeriesEntries({ entries, onOpen, label = "Series collection" }: {
  entries: LibrarySeriesEntry[];
  label?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <ul aria-label={label} data-view="grid" className="rj-collection-grid">
      {entries.map(entry => <li key={entry.id}>
        <SeriesCard title={entry.title} books={entry.books} onOpen={() => onOpen(entry.id)} />
      </li>)}
    </ul>
  );
}
