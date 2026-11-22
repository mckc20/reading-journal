import { useEffect, useId, useRef, useState } from 'react';
import { ScanBarcode, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookCover } from '@/components/reading-journal/BookCover';
import { BookLookupModeSwitch } from './BookFormFields';
import type { BookLookupMode, BookLookupResult } from './bookFormTypes';

export function BookLookupPreview({ onLookup, onScanISBN, onApply, onBusyChange }: {
  onLookup?: (query: string, mode: BookLookupMode) => Promise<BookLookupResult[]>;
  onScanISBN?: () => Promise<string | null>;
  onApply: (book: BookLookupResult) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<BookLookupMode>('isbn');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookLookupResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  function reset() { sequence.current++; setBusy(false); onBusyChange(false); setResults([]); setError(''); setMessage(''); }
  async function lookup() {
    if (!onLookup || busy) return;
    const value = mode === 'isbn' ? query.replace(/[\s-]/g, '').toUpperCase() : query.trim();
    if (mode === 'isbn' ? !/^(\d{13}|\d{9}[\dX])$/.test(value) : value.length < 2) {
      setError(mode === 'isbn' ? 'Enter a 10 or 13 character ISBN.' : 'Enter at least two characters.'); return;
    }
    const request = ++sequence.current;
    setBusy(true); onBusyChange(true); setResults([]); setError(''); setMessage('');
    try {
      const found = await onLookup(value, mode);
      if (request !== sequence.current) return;
      setResults(found); setMessage(found.length ? `${found.length} ${found.length === 1 ? 'match' : 'matches'}. Choose a book to fill in its details.` : 'No books found. Try another search or enter the details below.');
    } catch { if (request === sequence.current) setError('Search couldn’t load. Try again, or enter the book manually.'); }
    finally { if (request === sequence.current) { setBusy(false); onBusyChange(false); } }
  }
  async function scan() {
    if (!onScanISBN || busy) return;
    const request = ++sequence.current;
    setBusy(true); onBusyChange(true); setError(''); setMessage(''); setResults([]);
    try {
      const isbn = await onScanISBN();
      if (request === sequence.current && isbn) { setQuery(isbn); setMessage('ISBN ready. Choose Look up to find the book.'); }
    } catch { if (request === sequence.current) setError('Scanning couldn’t start. You can type the ISBN instead.'); }
    finally { if (request === sequence.current) { setBusy(false); onBusyChange(false); } }
  }
  return <section className="rj-book-lookup" aria-label="Find book details">
    <BookLookupModeSwitch mode={mode} onChange={value => { reset(); setMode(value); setQuery(''); }} />
    {mode === 'isbn' && <Button type="button" variant="outline" className="rj-lookup-scan" disabled={!onScanISBN || busy} onClick={() => void scan()}><ScanBarcode aria-hidden="true" />Scan ISBN barcode</Button>}
    <Label htmlFor={`${id}-query`} className="sr-only">{mode === 'isbn' ? 'ISBN to look up' : 'Book title to search'}</Label>
    <div className="rj-lookup-query"><Input id={`${id}-query`} type="search" value={query} placeholder={mode === 'isbn' ? 'Enter ISBN' : 'Enter a book title'} onChange={event => { reset(); setQuery(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void lookup(); } }} /><Button type="button" disabled={!onLookup || !query.trim() || busy} onClick={() => void lookup()}><Search aria-hidden="true" />{mode === 'isbn' ? 'Look up' : 'Search books'}</Button></div>
    {busy && <p role="status">Finding book details…</p>}
    {error && <p role="alert" className="rj-book-form-error">{error}</p>}
    {message && <p role="status" className="rj-book-form-hint">{message}</p>}
    {results.length > 0 && <><p className="rj-book-form-hint">Using a result replaces the book metadata below. Status, source and series stay as you set them.</p><ul className="rj-lookup-results" aria-label="Book search results">{results.map(book => <li key={book.id}><BookCover src={book.cover_url} title={book.title} /><div><strong>{book.title}</strong><p>{book.authors.join(', ')}</p>{book.isbn && <small>{book.isbn}</small>}<Button type="button" variant="outline" onClick={() => { onApply(book); setResults([]); setMessage('Book details filled in. Review them before saving.'); }} aria-label={`Use ${book.title}`}>Use these details</Button></div></li>)}</ul></>}
  </section>;
}
