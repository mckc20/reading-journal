import { useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/reading-journal/BookCover";
import { buildGenreHistory, getDefaultHistoryGenre, getGenreHistoryOptions, getHistoryWindowBounds } from "@/lib/genreHistory";
import { cn } from "@/lib/utils";
import type { Book, Genre } from "@/types";

interface GenreHistoryProps {
  books: Book[];
  genres: Genre[];
}

export default function GenreHistory({ books, genres }: GenreHistoryProps) {
  const headingId = useId();
  const selectorId = useId();
  const [chosenGenreId, setChosenGenreId] = useState<string | null>(null);
  const options = useMemo(() => getGenreHistoryOptions(books, genres), [books, genres]);
  const selectedId = options.some((entry) => entry.genre.id === chosenGenreId)
    ? chosenGenreId : getDefaultHistoryGenre(books, genres);
  const genre = genres.find((item) => item.id === selectedId);
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <AppHeading level={4} id={headingId}>Your reading through the years</AppHeading>
          <HeadingDescription>Explore your enjoyment and the books you finished.</HeadingDescription>
        </div>
        {options.length > 0 && <div className="space-y-1">
          <label htmlFor={selectorId} className="block text-xs text-muted-foreground">Genre</label>
          <select id={selectorId} value={selectedId ?? ""} onChange={(event) => setChosenGenreId(event.target.value)}
            className="min-h-11 w-full max-w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {options.map((entry) => <option key={entry.genre.id} value={entry.genre.id}>{entry.genre.name}</option>)}
          </select>
        </div>}
      </div>
      {genre ? <HistoryChart key={genre.id} books={books} genres={genres} genre={genre} />
        : <p className="text-sm text-muted-foreground">Genre history appears once you have finished books in a main genre in at least two different years, with valid finish dates.</p>}
    </section>
  );
}

function HistoryChart({ books, genres, genre }: { books: Book[]; genres: Genre[]; genre: Genre }) {
  const panelId = useId();
  const currentYear = new Date().getFullYear();
  const [endYear, setEndYear] = useState(currentYear);
  const [view, setView] = useState<"enjoyment" | "count">("enjoyment");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const yearButtons = useRef(new Map<number, HTMLButtonElement>());
  // Keep a fixed timeline origin while browsing, including the adjacent years for the line.
  const history = useMemo(() => buildGenreHistory(books, genres, genre.id,
    Math.max(endYear, selectedYear ?? endYear),
    Math.min(endYear - 4, selectedYear === null ? endYear - 4 : selectedYear - 1)),
  [books, genres, genre.id, endYear, selectedYear]);
  const bounds = getHistoryWindowBounds(currentYear, history.earliestYear);
  const selected = history.years.find((entry) => entry.year === selectedYear);
  const enjoyment = view === "enjoyment";
  const maxCount = Math.max(2, Math.ceil(Math.max(...history.years.map((entry) => entry.finishedCount)) / 2) * 2);
  const ticks = enjoyment ? [5, 4, 3, 2, 1] : [maxCount, maxCount / 2, 0];
  const labelYear = (year: number) => `${year}${year === currentYear ? " so far" : ""}`;
  const valueLabel = (entry: typeof history.years[number]) => enjoyment
    ? entry.averageRating === null ? "No ratings" : `${entry.averageRating.toFixed(1)} / 5`
    : `${entry.finishedCount} book${entry.finishedCount === 1 ? "" : "s"}`;
  // Leave room around the ends of the scale so dots and focus indicators stay visible.
  const ratingY = (rating: number) => 190 - ((rating - 1) / 4) * 180;
  // Slide the whole timeline together so the line retains its shape and spacing.
  const timelineOffset = selected ? (endYear - selected.year) * 20 : 0;
  const yearPosition = (year: number) => (year - (endYear - 4)) * 20;
  const timelineStyle = { transform: `translateX(${timelineOffset}%)` };
  const moveWindow = (delta: number) => {
    setEndYear((year) => Math.max(bounds.minEndYear, Math.min(bounds.maxEndYear, year + delta)));
    setSelectedYear(null);
  };
  const closeYear = () => {
    if (selectedYear !== null) yearButtons.current.get(selectedYear)?.focus();
    if (selectedYear !== null && selectedYear < endYear - 4) setEndYear(selectedYear + 4);
    else if (selectedYear !== null && selectedYear > endYear) setEndYear(selectedYear);
    setSelectedYear(null);
  };
  const moveSelectedYear = (delta: number) => {
    if (!selected || history.earliestYear === null) return;
    const year = Math.max(history.earliestYear, Math.min(currentYear, selected.year + delta));
    setSelectedYear(year);
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="History measurement" className="flex flex-wrap gap-1">
        <Button size="sm" variant={enjoyment ? "default" : "outline"} aria-pressed={enjoyment} onClick={() => setView("enjoyment")}>Enjoyment</Button>
        <Button size="sm" variant={!enjoyment ? "default" : "outline"} aria-pressed={!enjoyment} onClick={() => setView("count")}>Books read</Button>
      </div>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" aria-label="Show one year earlier" disabled={history.earliestYear === null || endYear <= bounds.minEndYear} onClick={() => moveWindow(-1)}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></Button>
        <span className="text-sm tabular-nums" aria-live="polite">{endYear - 4}–{endYear}</span>
        <Button size="icon" variant="ghost" aria-label="Show one year later" disabled={history.earliestYear === null || endYear >= currentYear} onClick={() => moveWindow(1)}><ChevronRight aria-hidden="true" className="h-4 w-4" /></Button>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">{enjoyment ? "Average rating · 1–5 stars" : "Finished books · includes unrated books"}. Select a year to explore its books.</p>
    {history.finishedCount === 0 ? <p className="text-sm text-muted-foreground">No finished books yet.</p>
      : history.ratedCount === 0 && enjoyment ? <p className="text-sm text-muted-foreground">Finished books have no ratings yet.</p>
        : null}
    {history.finishedCount > 0 && history.excludedDateCount === history.finishedCount && <p className="text-sm text-muted-foreground">No finished books have usable finish dates yet.</p>}
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2" onKeyDown={(event) => {
      if (event.key === "Escape" && selected) { event.preventDefault(); closeYear(); }
    }}>
      <div aria-hidden="true" className="relative h-[200px] text-right text-xs text-muted-foreground">{ticks.map((tick, index) => <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: 10 + index / (ticks.length - 1) * 180 }}>{tick}</span>)}</div>
      <div className="min-w-0">
        <div className="relative h-[200px] overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 inset-y-2.5 flex flex-col justify-between">{ticks.map((tick) => <div key={tick} className="border-t border-border/60" />)}</div>
          <div className="absolute inset-0 transition-transform duration-350 ease-in-out motion-reduce:transition-none" style={timelineStyle} data-genre-timeline>
          {enjoyment && <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 200" preserveAspectRatio="none">
            {history.years.slice(1).map((entry, index) => {
              const previous = history.years[index];
              return entry.averageRating !== null && previous.averageRating !== null
                ? <line key={entry.year} x1={yearPosition(previous.year) + 10} x2={yearPosition(entry.year) + 10}
                  y1={ratingY(previous.averageRating)} y2={ratingY(entry.averageRating)} stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null;
            })}
          </svg>}
            {history.years.map((entry) => <button key={entry.year} type="button"
              aria-hidden={selected && entry.year !== selected.year ? true : undefined}
              tabIndex={selected && entry.year !== selected.year ? -1 : 0}
              style={{ left: `${yearPosition(entry.year)}%`, width: "20%" }}
              ref={(element) => { if (element) yearButtons.current.set(entry.year, element); else yearButtons.current.delete(entry.year); }}
              aria-label={`${genre.name}, ${labelYear(entry.year)}: ${valueLabel(entry)}. ${entry.ratedCount} rated. ${selectedYear === entry.year ? "Hide" : "Show"} books.`}
              aria-expanded={selectedYear === entry.year} aria-controls={panelId}
              onClick={() => setSelectedYear((year) => year === entry.year ? null : entry.year)}
              className={cn("absolute inset-y-0 min-w-0 rounded-md hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selectedYear === entry.year && "bg-primary/10 ring-1 ring-primary/40", selected && entry.year !== selected.year && "pointer-events-none")}>
              {enjoyment ? entry.averageRating !== null && <span aria-hidden="true" className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary" style={{ top: ratingY(entry.averageRating) }} />
                : <span aria-hidden="true" className="absolute bottom-2.5 left-1/2 w-[55%] max-w-10 -translate-x-1/2 rounded-t-sm bg-primary/75" style={{ height: entry.finishedCount / maxCount * 180 }} />}
            </button>)}
          </div>
          {selected && <div id={panelId} className="absolute inset-y-0 left-0 right-[20%] z-10 mr-2 animate-in fade-in-0 bg-background duration-350 motion-reduce:animate-none">
            <section aria-label={`${genre.name} · ${labelYear(selected.year)} books`} className="flex h-full flex-col gap-2 rounded-lg bg-muted/20 p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <h5 className="font-heading text-sm">{genre.name} · {labelYear(selected.year)}</h5>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close year details" onClick={closeYear}><X aria-hidden="true" className="h-4 w-4" /></Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{selected.finishedCount} book{selected.finishedCount === 1 ? "" : "s"} finished · {selected.ratedCount} rated · {selected.averageRating === null ? "No average rating" : `★ ${selected.averageRating.toFixed(1)} / 5`}</p>
              {selected.books.length ? <ul aria-label="Books finished in the selected year" className="flex min-h-0 flex-1 gap-2 overflow-auto p-1">
                {selected.books.map((book) => <li key={book.id} className="w-12 shrink-0 sm:w-16"><Link to={`/books/${book.id}`} aria-label={book.title} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <BookCover src={book.cover_url} title={book.title} showFallbackTitle />
                  <p className="mt-1 line-clamp-1 text-[11px] leading-tight sm:line-clamp-2">{book.title}</p>
                </Link></li>)}
              </ul> : <p className="text-xs text-muted-foreground">No finished books in this year.</p>}
            </section>
          </div>}
        </div>
        <div className="relative mt-2 h-14 text-center text-[11px] leading-snug">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 transition-transform duration-350 ease-in-out motion-reduce:transition-none" style={timelineStyle}>
              {history.years.map((entry) => <div key={entry.year} aria-hidden="true"
                className={cn("absolute top-0 pt-1.5 transition-opacity duration-350 motion-reduce:transition-none", selected && entry.year !== selected.year && "opacity-0")}
                style={{ left: `${yearPosition(entry.year)}%`, width: "20%" }}>
                <p className="tabular-nums">{entry.year}{entry.year === currentYear && <span className="block">so far</span>}</p>
                <p className="mt-1 text-muted-foreground">{valueLabel(entry)}</p>
              </div>)}
            </div>
          </div>
          {selected && <div className="absolute right-0 top-0 w-[20%] animate-in fade-in-0 duration-350 motion-reduce:animate-none">
            <span className="sr-only" aria-live="polite">Selected year: {labelYear(selected.year)}</span>
            <Button variant="ghost" size="icon" className="absolute -left-3 top-0 h-7 w-6" aria-label="Previous selected year" disabled={history.earliestYear === null || selected.year <= history.earliestYear} onClick={() => moveSelectedYear(-1)}><ChevronLeft aria-hidden="true" className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="absolute -right-3 top-0 h-7 w-6" aria-label="Next selected year" disabled={selected.year >= currentYear} onClick={() => moveSelectedYear(1)}><ChevronRight aria-hidden="true" className="h-3 w-3" /></Button>
          </div>}
        </div>
      </div>
    </div>
    <ul className="sr-only" aria-label={`${genre.name} yearly history`}>
      {history.years.map((entry) => <li key={entry.year}>{labelYear(entry.year)}: {entry.finishedCount} finished books; {entry.ratedCount} rated; {entry.averageRating === null ? "no average rating" : `average rating ${entry.averageRating.toFixed(1)} out of 5`}.</li>)}
    </ul>
    {history.excludedDateCount > 0 && <p className="text-xs text-muted-foreground">{history.excludedDateCount} finished book{history.excludedDateCount === 1 ? " was" : "s were"} excluded from yearly values because the finish date is missing or invalid.</p>}
  </div>;
}
