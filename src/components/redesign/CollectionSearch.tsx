import { useEffect, useId, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import './collection-search.css';

export interface CollectionSearchItem {
  id: string;
  name: string;
  detail?: string;
  searchText?: string;
}

/** The caller supplies only the active collection, never a global search index. */
export function CollectionSearch({ collection, items, onSelect, query, onQueryChange, children }: {
  collection: string;
  items: CollectionSearchItem[];
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  children: (controls: { desktopSearch: ReactNode; mobileSearchButton: ReactNode }) => ReactNode;
}) {
  const id = useId();
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const desktopInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const label = `Search your ${collection.toLowerCase()}`;
  const needle = mobileQuery.trim().toLocaleLowerCase();
  const results = needle.length >= 2 ? items.filter(item => (item.searchText ?? item.name).toLocaleLowerCase().includes(needle)) : [];

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => { setMobile(media.matches); setOpen(false); setRevealed(false); setMobileQuery(''); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  function begin(event: TouchEvent) {
    start.current = null;
    if (!mobile || event.touches.length !== 1) return;
    // Leave sliders, inputs, horizontal shelves and other controls to their owners.
    if ((event.target as Element).closest('input, textarea, select, [role="slider"], [role="spinbutton"]')) return;
    start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  function end(event: TouchEvent, searching = false) {
    const origin = start.current;
    start.current = null;
    if (!origin || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - origin.x;
    const dy = event.changedTouches[0].clientY - origin.y;
    if (Math.abs(dy) < 48 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
    if (dy < 0 && !searching) setRevealed(true);
    if (dy > 0) { setRevealed(false); if (searching) close(); }
  }
  function close() { setOpen(false); setMobileQuery(''); }
  function showSearch() { setRevealed(true); setOpen(true); }

  return <div className="rj-redesign rj-collection-search" data-search-revealed={revealed || undefined}
    onTouchStart={begin} onTouchEnd={event => end(event)} onTouchCancel={() => { start.current = null; }}>
    {children({
      desktopSearch: <div className="rj-library-search rj-desktop-search"><label htmlFor={`${id}-desktop`}>{label}</label><div><Search size={18} aria-hidden="true" /><input ref={desktopInput} id={`${id}-desktop`} type="search" placeholder={`Search ${collection.toLowerCase()}`} value={query} onChange={event => onQueryChange(event.target.value)} /></div></div>,
      mobileSearchButton: <Button ref={trigger} className="rj-mobile-search-button" variant="outline" size="icon" aria-label={label} onClick={showSearch}><Search aria-hidden="true" /></Button>,
    })}
    {mobile && revealed && <div className="rj-mobile-search-bar" role="search" aria-label={label}>
      <button className="rj-search-invitation" onClick={showSearch}><Search size={20} aria-hidden="true" /><span>{label}</span></button>
      <Button variant="ghost" size="icon" aria-label="Hide search" onClick={() => setRevealed(false)}><X aria-hidden="true" /></Button>
    </div>}
    <Dialog open={mobile && open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="rj-redesign rj-collection-search-dialog" showCloseButton={false}
        onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          (window.matchMedia('(max-width: 767px)').matches ? trigger.current : desktopInput.current)?.focus({ preventScroll: true });
        }}>
        <header onTouchStart={begin} onTouchEnd={event => { event.stopPropagation(); end(event, true); }}>
          <DialogTitle>{label}</DialogTitle>
          <div className="rj-search-input-row"><div><Search size={20} aria-hidden="true" /><input ref={input} type="search" aria-label={label} placeholder={`Search ${collection.toLowerCase()}`} value={mobileQuery} onChange={event => setMobileQuery(event.target.value)} autoComplete="off" enterKeyHint="search" /></div><Button variant="ghost" onClick={close}>Cancel</Button></div>
          <DialogDescription>Search only in your {collection.toLowerCase()}. Enter at least two characters.</DialogDescription>
        </header>
        <section className="rj-search-results" aria-label={`${collection} search results`}>
          <p role="status">{needle.length < 2 ? 'Type at least two characters to start searching.' : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}</p>
          {needle.length >= 2 && (results.length ? <ul>{results.map(item => <li key={item.id}><button onClick={() => { close(); onSelect(item.id); }}><span>{item.name}</span>{item.detail && <small>{item.detail}</small>}</button></li>)}</ul> : <p>No {collection.toLowerCase()} found. Try another search.</p>)}
        </section>
      </DialogContent>
    </Dialog>
  </div>;
}
