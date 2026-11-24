import { LibraryMosaic } from "./LibraryMosaic";

interface LibrarySeriesEntry {
  id: string;
  title: string;
  books: { id: string; title: string; cover?: string | null }[];
}

export function LibrarySeriesEntries({ entries, onOpen }: {
  entries: LibrarySeriesEntry[];
  onOpen: (id: string) => void;
}) {
  return (
    <ul aria-label="Series collection" data-view="grid" className="rj-collection-grid">
      {entries.map(entry => <li key={entry.id}>
        <article className="rj-collection-card">
          <LibraryMosaic books={entry.books} />
          <button type="button" className="rj-book-title rj-library-title rj-collection-title" onClick={() => onOpen(entry.id)}>{entry.title}</button>
        </article>
      </li>)}
    </ul>
  );
}
