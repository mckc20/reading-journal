import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { BookOpen, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { BookCover } from '@/components/reading-journal/BookCover';
import { formatPublicationDateInput, parsePublicationDateInput } from '@/lib/publicationDate';
import type { BookFormat, BookLanguage, BookSource, BookStatus } from '@/types';
import { BookFormTagField, mergeBookNames, RequiredBookFieldLabel } from './BookFormFields';
import { BookLookupPreview } from './BookLookupPreview';
import type { BookFormDraft, BookLookupMode, BookLookupResult } from './bookFormTypes';
import './redesign.css';
import './book-form.css';

export type { BookFormDraft, BookLookupResult, BookLookupMode } from './bookFormTypes';
export interface BookFormPreviewProps {
  open: boolean;
  mode?: 'add' | 'edit';
  returnFocusTo?: HTMLElement | null;
  initialBook?: BookFormDraft;
  authorOptions?: string[];
  genreOptions?: string[];
  seriesOptions?: { id: string; name: string }[];
  onLookup?: (query: string, mode: BookLookupMode) => Promise<BookLookupResult[]>;
  onScanISBN?: () => Promise<string | null>;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: BookFormDraft) => Promise<void>;
}
const statuses: BookStatus[] = ['Wishlist', 'To Read', 'Up Next', 'Reading', 'Paused', 'Finished', 'DNF'];
const formats: BookFormat[] = ['eBook', 'Audiobook', 'Paperback', 'Hardcover'];
const sources: BookSource[] = ['Owned', 'Family', 'Friends', 'Library'];
const languages: BookLanguage[] = ['German', 'Spanish', 'English'];

/** Caller owns lookup, scanner and persistence. No account clients are imported. */
export function BookFormPreview({ open, mode = 'add', initialBook, onOpenChange, onSave, returnFocusTo, onLookup, onScanISBN, authorOptions = [], genreOptions = [], seriesOptions = [] }: BookFormPreviewProps) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState({ title: initialBook?.title ?? '', authors: initialBook?.authors.join('; ') ?? '', genres: initialBook?.genres?.join('; ') ?? '', status: initialBook?.status ?? 'To Read', totalPages: initialBook?.total_pages?.toString() ?? '', currentPage: initialBook?.current_page?.toString() ?? '', language: initialBook?.language ?? '', source: initialBook?.source ?? 'Owned', format: initialBook?.format ?? '', isbn: initialBook?.isbn ?? '', publicationYear: formatPublicationDateInput(initialBook?.publication_date), description: initialBook?.description ?? '', seriesId: initialBook?.series_id ?? '', volume: initialBook?.volume_number?.toString() ?? '', started: initialBook?.date_started ?? '', finished: initialBook?.date_finished ?? '', price: initialBook?.price?.toString() ?? '', purchaseUrl: initialBook?.purchase_url ?? '' });
  const [cover, setCover] = useState<string | null>(initialBook?.cover_url ?? null);
  const [authorInput, setAuthorInput] = useState('');
  const [genreInput, setGenreInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(mode === 'edit');
  const savingRef = useRef(false);
  const coverRequest = useRef(0);
  useEffect(() => () => { coverRequest.current++; }, []);
  const change = (field: keyof typeof draft, value: string) => { setDraft(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: '' })); setSaveError(''); };
  const close = () => { if (!savingRef.current) onOpenChange(false); };
  const showStarted = ['Reading', 'Paused', 'Finished', 'DNF'].includes(draft.status);
  const showFinished = ['Finished', 'DNF'].includes(draft.status);

  function applyBook(book: BookLookupResult) {
    coverRequest.current++; setCoverLoading(false);
    setDraft(current => ({ ...current, title: book.title, authors: book.authors.join('; '), genres: book.genres?.join('; ') ?? '', totalPages: book.total_pages?.toString() ?? '', language: book.language ?? '', format: book.format ?? '', isbn: book.isbn ?? '', publicationYear: formatPublicationDateInput(book.publication_date), description: book.description ?? '' }));
    setCover(book.cover_url ?? null); setAuthorInput(''); setGenreInput(''); setErrors({}); setSaveError('');
  }
  function uploadCover(file?: File) {
    if (!file) return;
    const request = ++coverRequest.current;
    setCoverLoading(false);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setErrors(current => ({ ...current, cover: 'Choose a JPG, PNG or WebP image smaller than 10 MB.' })); return; }
    setErrors(current => ({ ...current, cover: '' })); setCoverLoading(true);
    const reader = new FileReader();
    reader.onload = () => { if (request === coverRequest.current) { setCover(String(reader.result)); setCoverLoading(false); } };
    reader.onerror = () => { if (request === coverRequest.current) { setErrors(current => ({ ...current, cover: 'This image couldn’t be opened. Try another file.' })); setCoverLoading(false); } };
    reader.readAsDataURL(file);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current || lookupBusy || coverLoading) return;
    const next: Record<string, string> = {};
    const authors = mergeBookNames(draft.authors.split(';'), authorInput);
    const genres = mergeBookNames(draft.genres.split(';'), genreInput);
    if (!draft.title.trim()) next.title = 'Enter a book title.';
    if (!authors.length) next.authors = 'Enter at least one author.';
    if (draft.totalPages && (!Number.isSafeInteger(Number(draft.totalPages)) || Number(draft.totalPages) < 1)) next.totalPages = 'Enter a positive whole number of pages, or leave this blank.';
    if (draft.status === 'Reading' && draft.currentPage && (!Number.isSafeInteger(Number(draft.currentPage)) || Number(draft.currentPage) < 0 || (draft.totalPages && Number(draft.currentPage) > Number(draft.totalPages)))) next.currentPage = 'Enter a whole page number between zero and the total pages.';
    if (draft.seriesId && draft.volume && (!Number.isFinite(Number(draft.volume)) || Number(draft.volume) <= 0)) next.volume = 'Enter a volume number greater than zero.';
    if (draft.publicationYear && !parsePublicationDateInput(draft.publicationYear)) next.publicationYear = 'Enter a four-digit publication year.';
    if (showFinished && draft.started && draft.finished && draft.finished < draft.started) next.finished = 'The finish date must be on or after the start date.';
    if (draft.status === 'Wishlist' && draft.price && (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0)) next.price = 'Enter a price of zero or more.';
    if (draft.status === 'Wishlist' && draft.purchaseUrl.trim()) {
      try { if (!['http:', 'https:'].includes(new URL(draft.purchaseUrl.trim()).protocol)) throw new Error(); }
      catch { next.purchaseUrl = 'Enter a valid web link, including https://.'; }
    }
    setErrors(next);
    if (Object.keys(next).length) {
      const focusError = () => form.current?.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      if (['publicationYear', 'price', 'purchaseUrl'].some(field => next[field])) { setSecondaryOpen(true); requestAnimationFrame(focusError); }
      else focusError();
      return;
    }
    savingRef.current = true; setSaving(true); setSaveError('');
    try {
      await onSave({ title: draft.title.trim(), authors, genres, cover_url: cover, status: draft.status as BookStatus, total_pages: draft.totalPages ? Number(draft.totalPages) : undefined, language: (draft.language || undefined) as BookLanguage | undefined, source: draft.source as BookSource, format: (draft.format || undefined) as BookFormat | undefined, isbn: draft.isbn.trim() || undefined, publication_date: parsePublicationDateInput(draft.publicationYear)?.date, description: draft.description.trim() || undefined, series_id: draft.seriesId || undefined, volume_number: draft.seriesId && draft.volume ? Number(draft.volume) : undefined, current_page: draft.status === 'Reading' && draft.currentPage ? Number(draft.currentPage) : initialBook?.current_page, date_started: showStarted ? draft.started || undefined : undefined, date_finished: showFinished ? draft.finished || undefined : undefined, price: draft.status === 'Wishlist' && draft.price ? Number(draft.price) : undefined, purchase_url: draft.status === 'Wishlist' ? draft.purchaseUrl.trim() || undefined : undefined });
      onOpenChange(false);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Your book couldn’t be saved. Try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const errorFor = (name: string) => errors[name] && <p id={`${id}-${name}-error`} className="rj-book-form-error">{errors[name]}</p>;
  const field = (name: keyof typeof draft, label: string, options?: { type?: string }) => <div className="rj-book-form-field">
    {name === 'title' ? <RequiredBookFieldLabel htmlFor={`${id}-${name}`} text={label} /> : <Label htmlFor={`${id}-${name}`}>{label}</Label>}
    <Input id={`${id}-${name}`} name={name} value={draft[name]} type={options?.type ?? 'text'} inputMode={['totalPages', 'currentPage', 'publicationYear'].includes(name) ? 'numeric' : ['volume', 'price'].includes(name) ? 'decimal' : undefined} onChange={event => change(name, event.target.value)} aria-required={name === 'title'} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${id}-${name}-error` : undefined} />
    {errorFor(name)}
  </div>;
  const select = (name: 'status' | 'language' | 'source' | 'format', label: string, values: readonly string[], optional = false) => <div className="rj-book-form-field"><Label htmlFor={`${id}-${name}`}>{label}</Label><select id={`${id}-${name}`} name={name} value={draft[name]} onChange={event => change(name, event.target.value)}>{optional && <option value="">Not specified</option>}{values.map(value => <option key={value}>{value}</option>)}</select></div>;
  function picker(kind: 'authors' | 'genres') {
    const author = kind === 'authors';
    const value = author ? authorInput : genreInput;
    const setValue = author ? setAuthorInput : setGenreInput;
    const selected = mergeBookNames([], draft[kind]);
    return <BookFormTagField kind={kind} query={value}
      selected={selected.map(label => ({ id: label, label }))}
      options={author ? authorOptions : genreOptions} error={errors[kind]}
      onQueryChange={query => { setValue(query); setErrors(current => ({ ...current, [kind]: '' })); }}
      onAdd={() => { change(kind, mergeBookNames(selected, value).join('; ')); setValue(''); }}
      onRemove={name => change(kind, selected.filter(item => item !== name).join('; '))} />;
  }
  return <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
    <DialogContent className="rj-redesign rj-book-form-dialog" showCloseButton={false} onCloseAutoFocus={event => { if (returnFocusTo) { event.preventDefault(); returnFocusTo.focus(); } }} onEscapeKeyDown={event => { if (savingRef.current) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
      <header className="rj-book-form-heading"><span className="rj-book-form-icon"><BookOpen size={24} /></span><div><DialogTitle info={mode === 'edit' ? 'Update the book details.' : 'Find a book or fill in the details yourself.'}>{mode === 'edit' ? 'Edit book' : 'Add a book'}</DialogTitle></div><Button className="rj-book-form-close" type="button" variant="ghost" size="icon" aria-label="Close book form" onClick={close} disabled={saving}><X aria-hidden="true" /></Button></header>
      <form ref={form} onSubmit={submit} noValidate className="rj-book-form" aria-busy={saving}>
        <div className="rj-book-form-scroll"><fieldset disabled={saving} className="rj-book-form-fields"><legend className="sr-only">Book information</legend>
          {mode !== 'edit' && <BookLookupPreview onLookup={onLookup} onScanISBN={onScanISBN} onApply={applyBook} onBusyChange={setLookupBusy} />}
          <div className="rj-book-form-primary"><div className="rj-book-cover-editor"><label className="rj-book-cover-upload"><span className="sr-only">Book cover</span><input className="sr-only" aria-label="Book cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { uploadCover(event.target.files?.[0]); event.target.value = ''; }} /><BookCover src={cover} title={draft.title || 'New book'} imageClassName="object-contain" /><span><ImagePlus size={18} aria-hidden="true" />{cover ? 'Change cover' : 'Add cover'}</span></label>{cover && <Button type="button" variant="ghost" onClick={() => { coverRequest.current++; setCoverLoading(false); setCover(null); }}>Remove cover</Button>}{coverLoading && <p role="status">Opening cover…</p>}{errorFor('cover')}</div><div className="rj-book-form-identity">{field('title', 'Title')}{picker('authors')}{picker('genres')}</div></div>
          <div className="rj-book-form-grid">{select('status', 'Reading status', statuses)}{select('language', 'Language', languages, true)}{field('totalPages', 'Total pages')}{draft.status === 'Reading' && field('currentPage', 'Current page')}<div className="rj-book-form-field"><Label htmlFor={`${id}-series`}>Series</Label><select id={`${id}-series`} value={draft.seriesId} onChange={event => change('seriesId', event.target.value)}><option value="">None</option>{seriesOptions.map(series => <option key={series.id} value={series.id}>{series.name}</option>)}</select></div>{draft.seriesId && field('volume', 'Volume number')}{showStarted && field('started', 'Date started', { type: 'date' })}{showFinished && field('finished', 'Date finished', { type: 'date' })}</div>
          <details className="rj-book-form-details" open={secondaryOpen} onToggle={event => setSecondaryOpen(event.currentTarget.open)}><summary>Secondary Information <span>Optional details</span></summary><div className="rj-book-form-secondary"><div className="rj-book-form-grid">{field('publicationYear', 'Publication year')}{select('format', 'Format', formats, true)}{select('source', 'Source', sources)}{field('isbn', 'ISBN')}{draft.status === 'Wishlist' && <>{field('price', 'Price')}{field('purchaseUrl', 'Purchase link', { type: 'url' })}</>}</div></div></details>
          <div className="rj-book-form-field"><Label htmlFor={`${id}-description`}>Description</Label><textarea id={`${id}-description`} value={draft.description} onChange={event => change('description', event.target.value)} rows={4} /></div>
        </fieldset>{Object.values(errors).some(Boolean) && <p role="alert" className="rj-book-form-error">Check the highlighted fields before saving.</p>}{saveError && <p role="alert" className="rj-book-form-error">{saveError} Your edits are still here.</p>}</div>
        <footer className="rj-book-form-actions"><Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || lookupBusy || coverLoading}>{saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add book'}</Button></footer>
      </form>
    </DialogContent>
  </Dialog>;
}
