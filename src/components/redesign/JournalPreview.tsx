import { useId, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { BookCover } from '@/components/reading-journal/BookCover';
import { EmptyState } from '@/components/reading-journal/EmptyState';
import type { JournalEntryLabel } from '@/types';
import { HomeShell, type CreateDestination, type HomeDestination } from './HomeShell';
import './redesign.css';
import './journal-preview.css';

/** Preview data, not a persistence contract. Independent entries need separate production design. */
export interface JournalPreviewEntry {
  id: string;
  title?: string;
  content: string;
  type: JournalEntryLabel;
  date: string;
  attribution?: string;
  related?: { kind: 'Book' | 'Series' | 'Author'; id: string; name: string; cover?: string };
}
export interface JournalPreviewProps {
  entries: JournalPreviewEntry[];
  loading?: boolean;
  error?: string;
  initialQuery?: string;
  onRetry: () => void;
  onNavigate: (destination: HomeDestination) => void;
  onCreate: (destination: CreateDestination) => void;
  onNotifications: () => void;
}
const labels = { note: 'Note', quote: 'Quote', review: 'Review' };
const formatDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const entryName = (entry: JournalPreviewEntry) => entry.title || entry.content.slice(0, 65);

function EntryContext({ entry }: { entry: JournalPreviewEntry }) {
  return <div className="rj-journal-context">
    {entry.related?.kind === 'Book' && <div aria-hidden="true"><BookCover className="rj-journal-cover" src={entry.related.cover} title={entry.related.name} /></div>}
    <div><span>{entry.related?.kind || 'Independent entry'}</span>{entry.related && <p>{entry.related.name}</p>}</div>
  </div>;
}

export function JournalPreview({ entries, loading, error, initialQuery = '', ...actions }: JournalPreviewProps) {
  const id = useId();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState('all');
  const [relationship, setRelationship] = useState('all');
  const [selected, setSelected] = useState<JournalPreviewEntry | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const readerTitle = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const needle = query.trim().toLocaleLowerCase();
  const visible = entries.filter(entry => (type === 'all' || entry.type === type)
    && (relationship === 'all' || (relationship === 'independent' ? !entry.related : `${entry.related?.kind}:${entry.related?.id}` === relationship))
    && (!needle || [entry.title, entry.content, entry.attribution, entry.related?.name].join(' ').toLocaleLowerCase().includes(needle)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const relationships = Array.from(new Map(entries.flatMap(entry => entry.related ? [[`${entry.related.kind}:${entry.related.id}`, entry.related] as const] : [])).entries());
  const filtered = !!query || type !== 'all' || relationship !== 'all';
  function reset() { setQuery(''); setType('all'); setRelationship('all'); }

  return <div className="rj-redesign rj-journal-preview"><HomeShell {...actions} activeDestination="Journal">
    <header className="rj-journal-heading"><div><p className="rj-journal-eyebrow">Thoughts to return to</p><h1>Journal</h1><p>Your books, your words. And everything in between.</p></div><Button onClick={() => actions.onCreate('entry')}><NotebookPen aria-hidden="true" />Write an entry</Button></header>
    {loading ? <div className="rj-journal-state" role="status">Loading your journal…</div>
      : error ? <div className="rj-journal-state"><EmptyState title="Your journal couldn’t load" message={error} action={<Button onClick={actions.onRetry}>Try again</Button>} /></div>
      : entries.length === 0 ? <div className="rj-journal-state"><EmptyState title="A little room for your thoughts" message="A line from a book, a reflection, or something entirely your own." action={<Button onClick={() => actions.onCreate('entry')}>Write your first entry</Button>} /></div>
      : <>
        <div className="rj-journal-tools">
          <label htmlFor={`${id}-type`}>Entry type<select id={`${id}-type`} value={type} onChange={event => setType(event.target.value)}><option value="all">All entries</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label htmlFor={`${id}-related`}>Related to<select id={`${id}-related`} value={relationship} onChange={event => setRelationship(event.target.value)}><option value="all">Everything</option><option value="independent">Independent entries</option>{relationships.map(([key, related]) => <option key={key} value={key}>{related.kind}: {related.name}</option>)}</select></label>
          <label className="rj-journal-search" htmlFor={`${id}-search`}>Search journal<input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Words, titles, related names…" /></label>
        </div>
        <div className="rj-journal-results"><p role="status">{visible.length} {visible.length === 1 ? 'entry' : 'entries'} · Newest first</p>{filtered && <Button variant="ghost" onClick={reset}>Reset filters</Button>}</div>
        {visible.length ? <ul className="rj-journal-grid" aria-label="Journal entries">{visible.map(entry => <li key={entry.id}><article className="rj-journal-card" data-type={entry.type}>
          <div className="rj-journal-meta"><span>{labels[entry.type]}</span><time dateTime={entry.date}>{formatDate(entry.date)}</time></div>
          {entry.title && <h2>{entry.title}</h2>}
          {entry.type === 'quote' ? <blockquote className="rj-journal-excerpt">{entry.content}</blockquote> : <p className="rj-journal-excerpt">{entry.content}</p>}
          {entry.attribution && <p className="rj-journal-attribution">— {entry.attribution}</p>}
          <EntryContext entry={entry} />
          <button className="rj-journal-open" aria-label={`Read entry: ${entryName(entry)}`} onClick={event => { returnFocus.current = event.currentTarget; setSelected(entry); setReaderOpen(true); }}>Read entry <span aria-hidden="true">↗</span></button>
        </article></li>)}</ul>
          : <EmptyState title="No entries found" message="Try another phrase or include more entry types and relationships." action={<Button variant="outline" onClick={reset}>Show all entries</Button>} />}
      </>}
  </HomeShell>
    <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
      <DialogContent className="rj-redesign rj-journal-dialog" showCloseButton={false} onOpenAutoFocus={event => { event.preventDefault(); readerTitle.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}>
        {selected && <><header><DialogTitle ref={readerTitle} tabIndex={-1}>{selected.title || `${labels[selected.type]} · ${formatDate(selected.date)}`}</DialogTitle><DialogDescription>{labels[selected.type]} · {formatDate(selected.date)}</DialogDescription></header>
          <div className="rj-journal-reader" tabIndex={0} role="region" aria-label="Full entry"><div className="rj-journal-writing">{selected.type === 'quote' ? <blockquote>{selected.content}</blockquote> : <p>{selected.content}</p>}{selected.attribution && <p className="rj-journal-attribution">— {selected.attribution}</p>}</div><EntryContext entry={selected} /></div>
          <footer><DialogClose asChild><Button variant="outline">Back to journal</Button></DialogClose></footer></>}
      </DialogContent>
    </Dialog>
  </div>;
}
