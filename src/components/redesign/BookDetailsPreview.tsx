import { useId, useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, ChevronDown, Clock3, Heart, MoreHorizontal, NotebookPen, Pencil } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { BookCover } from '@/components/reading-journal/BookCover';
import { BookProgress, getBookProgress } from '@/components/reading-journal/BookProgress';
import { BookStatus } from '@/components/reading-journal/BookStatus';
import BookRating from '@/components/reading-journal/BookRating';
import type { BookStatus as Status } from '@/types';
import type { HomeBook } from './HomeCards';
import { HomeShell, type CreateDestination, type HomeDestination } from './HomeShell';
import './redesign.css';
import './book-details.css';

export interface DetailPreviewBook extends HomeBook {
  status: Status;
  description?: string;
  genres: string[];
  format?: string;
  source?: string;
  language?: string;
  publicationYear?: number;
  rating?: number;
  favorite?: boolean;
  startedOn?: string;
  finishedOn?: string;
  readingMinutes?: number;
}

export interface BookDetailsPreviewProps {
  book: DetailPreviewBook;
  entries: { id: string; date: string; title: string; content: string }[];
  notice?: string;
  onReadingAction: () => void;
  onClose: () => void;
  onEdit: () => void;
  onAddEntry: () => void;
  onToggleFavorite: () => void;
  onViewAnalytics: () => void;
  onOpenJournal: () => void;
  onNavigate: (destination: HomeDestination) => void;
  onCreate: (destination: CreateDestination) => void;
  onNotifications: () => void;
}

/** Presentational workshop page. Status and persistence belong to the caller. */
export function BookDetailsPreview({ book, entries, notice, onReadingAction, onClose, onEdit, onAddEntry, onToggleFavorite, onViewAnalytics, onOpenJournal, ...shell }: BookDetailsPreviewProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const action = book.status === 'Reading' ? 'Update Progress' : book.status === 'Paused' ? 'Resume' : book.status === 'Finished' ? 'Reread' : 'Start Reading';
  const progress = getBookProgress(book.currentPage, book.totalPages);
  const description = book.description?.trim();
  const longDescription = Boolean(description && description.length > 240);
  const latestEntry = entries[0];
  const hasReadingSummary = Boolean(book.startedOn || book.finishedOn || book.readingMinutes != null);
  const metadata = [
    ['Format', book.format],
    ['Language', book.language],
    ['Source', book.source],
    ['Published', book.publicationYear],
  ] as const;

  return <div className="rj-redesign"><HomeShell {...shell} activeDestination="Library">
    <div className="rj-detail-page">
      <section className="rj-detail-hero" aria-labelledby={`${id}-title`}>
        <div className="rj-detail-cover-stage">
          <div className="rj-detail-topline">
            <Button variant="ghost" size="icon-lg" onClick={onClose} aria-label="Close book details"><ChevronDown aria-hidden="true" /></Button>
            <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="ghost" size="icon-lg" aria-label="More book actions"><MoreHorizontal aria-hidden="true" /></Button></DropdownMenu.Trigger>
              <DropdownMenu.Content className="rj-redesign rj-add-menu" align="end" sideOffset={6}>
                <DropdownMenu.Item onSelect={onEdit}><Pencil size={16} aria-hidden="true" />Edit book</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={onViewAnalytics}><ArrowUpRight size={16} aria-hidden="true" />View reading analytics</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
          <BookCover className="rj-detail-cover" src={book.cover} title={book.title} paused={book.status === 'Paused'} showFallbackTitle />
        </div>
        <div className="rj-detail-summary">
          <div className="rj-detail-title-row"><h1 id={`${id}-title`}>{book.title}</h1><Button variant="ghost" size="icon-lg" aria-label={book.favorite ? 'Remove from Favorites' : 'Add to Favorites'} aria-pressed={!!book.favorite} onClick={onToggleFavorite}><Heart aria-hidden="true" fill={book.favorite ? 'currentColor' : 'none'} /></Button></div>
          <p className="rj-detail-author">{book.author}</p>
          <div className="rj-detail-status-row"><BookStatus status={book.status} />{book.rating != null && <div className="rj-detail-rating"><BookRating rating={book.rating} /><span aria-hidden="true">{book.rating} / 5</span></div>}</div>
          <div className="rj-detail-position"><p aria-label="Reading position">{book.currentPage}{book.totalPages && book.totalPages > 0 ? ` / ${book.totalPages}` : ''} pages</p>{progress != null && <span>{progress}%</span>}</div>
          <BookProgress currentPage={book.currentPage} totalPages={book.totalPages} />
          <div className="rj-detail-actions"><Button onClick={onReadingAction}><BookOpen aria-hidden="true" />{action}</Button><Button variant="outline" onClick={onAddEntry}><NotebookPen aria-hidden="true" />Add entry</Button></div>
        </div>
      </section>
      {notice && <p className="rj-detail-notice" role="status">{notice}</p>}
      <div className="rj-detail-body">
        <section className="rj-detail-about" aria-labelledby={`${id}-about`}>
          <h2 id={`${id}-about`}>About this book</h2>
          {book.genres.length > 0 && <div className="rj-detail-tags">{book.genres.slice(0, 3).map(genre => <span key={genre}>{genre}</span>)}</div>}
          <p id={`${id}-description`}>{description ? longDescription && !expanded ? `${description.slice(0, 240).trimEnd()}…` : description : 'No description yet.'}</p>
          {longDescription && <Button variant="ghost" className="rj-detail-text-action" aria-expanded={expanded} aria-controls={`${id}-description`} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Show more'}</Button>}
          {(metadata.some(([, value]) => value != null) || book.genres.length > 3) && <details className="rj-detail-metadata"><summary>More book details</summary><dl>{metadata.filter(([, value]) => value != null).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}{book.genres.length > 3 && <div><dt>All genres</dt><dd>{book.genres.join(', ')}</dd></div>}</dl></details>}
        </section>
        <section className="rj-detail-history" aria-labelledby={`${id}-progress`}>
          <div className="rj-detail-section-heading"><h2 id={`${id}-progress`}>Reading Progress</h2><Button variant="ghost" onClick={onViewAnalytics} aria-label="View more reading analytics">View more<ArrowUpRight aria-hidden="true" /></Button></div>
          {hasReadingSummary ? <dl className="rj-detail-stats">
            {(book.finishedOn || book.startedOn) && <div><dt><CalendarDays aria-hidden="true" />{book.finishedOn ? 'Finished on' : 'Started on'}</dt><dd>{book.finishedOn || book.startedOn}</dd></div>}
            {book.readingMinutes != null && <div><dt><Clock3 aria-hidden="true" />Reading time</dt><dd>{Math.floor(book.readingMinutes / 60) > 0 ? `${Math.floor(book.readingMinutes / 60)}h ` : ''}{book.readingMinutes % 60}m</dd></div>}
          </dl> : <p className="rj-detail-quiet">Your reading sessions will appear here.</p>}
        </section>
        <section className="rj-detail-journal" aria-labelledby={`${id}-journal`}>
          <div className="rj-detail-section-heading"><h2 id={`${id}-journal`}>Journal</h2><Button variant="ghost" onClick={onOpenJournal}>Open journal<ArrowUpRight aria-hidden="true" /></Button></div>
          {latestEntry ? <article><p className="rj-muted">{latestEntry.date}</p><h3>{latestEntry.title}</h3><p>{latestEntry.content.length > 220 ? `${latestEntry.content.slice(0, 220).trimEnd()}…` : latestEntry.content}</p>{entries.length > 1 && <p className="rj-detail-entry-count">{entries.length} journal entries</p>}</article> : <div className="rj-detail-empty"><NotebookPen aria-hidden="true" /><p>A place for your thoughts</p><Button variant="outline" onClick={onAddEntry}>Write your first entry</Button></div>}
        </section>
      </div>
    </div>
  </HomeShell></div>;
}
