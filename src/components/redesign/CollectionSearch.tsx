import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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

const mobileBreakpoint = '(max-width: 767px)';
const revealZoneHeight = 92;
type SwipePoint = Pick<Touch, 'clientX' | 'clientY'>;

function verticalSwipe(start: SwipePoint | null, end: SwipePoint | undefined) {
  if (!start || !end) return null;
  const dy = end.clientY - start.clientY;
  const dx = end.clientX - start.clientX;
  if (Math.abs(dy) < 48 || Math.abs(dy) < Math.abs(dx) * 1.5) return null;
  return dy < 0 ? 'up' : 'down';
}

/** The caller supplies only the active collection, never a global search index. */
export function CollectionSearch({ collection, items, onSelect, query, onQueryChange, children }: {
  collection: string;
  items: CollectionSearchItem[];
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  children: (controls: { desktopSearch: ReactNode }) => ReactNode;
}) {
  const id = useId();
  const [mobile, setMobile] = useState(() => window.matchMedia(mobileBreakpoint).matches);
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState('');
  const browse = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const desktopInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dialogStart = useRef<SwipePoint | null>(null);
  const label = `Search your ${collection.toLowerCase()}`;
  const needle = mobileQuery.trim().toLocaleLowerCase();
  const results = needle.length >= 2 ? items.filter(item => (item.searchText ?? item.name).toLocaleLowerCase().includes(needle)) : [];

  useEffect(() => {
    const media = window.matchMedia(mobileBreakpoint);
    const update = () => { setMobile(media.matches); setOpen(false); setRevealed(false); setMobileQuery(''); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!mobile || open) return;
    const main = browse.current?.closest('main');
    const header = main?.querySelector('[data-library-header]')
      ?? main?.closest('.rj-app, .rj-home-shell')?.querySelector('.rj-app-header');
    if (!main || !header) return;
    let start: Touch | null = null;

    const begin = (event: TouchEvent) => {
      start = null;
      const target = event.target;
      if (!(target instanceof Element) || event.touches.length !== 1 ||
          target.closest('[inert], input, textarea, select, [role="slider"], [role="spinbutton"]')) return;
      const touch = event.touches[0];
      const headerBottom = header.getBoundingClientRect().bottom;
      if (touch.clientY >= headerBottom && touch.clientY <= headerBottom + revealZoneHeight) start = touch;
    };

    function end(event: TouchEvent) {
      const direction = verticalSwipe(start, event.changedTouches.length === 1 ? event.changedTouches[0] : undefined);
      start = null;
      if (direction === 'up') setRevealed(true);
      if (direction === 'down') {
        setRevealed(false);
        if (bar.current?.contains(document.activeElement)) browse.current?.focus({ preventScroll: true });
      }
    }

    function cancel() { start = null; }
    main.addEventListener('touchstart', begin, { passive: true });
    main.addEventListener('touchend', end, { passive: true });
    main.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      main.removeEventListener('touchstart', begin);
      main.removeEventListener('touchend', end);
      main.removeEventListener('touchcancel', cancel);
    };
  }, [mobile, open]);

  function close() {
    setOpen(false);
    setRevealed(false);
    setMobileQuery('');
  }

  return <div ref={browse} tabIndex={-1} className="rj-redesign rj-collection-search">
    {mobile && <div ref={bar} className={revealed ? 'rj-mobile-search-bar' : 'sr-only'} role="search" aria-label={label}>
      <button type="button" className="rj-search-invitation" aria-haspopup="dialog" aria-label={label}
        onFocus={() => setRevealed(true)} onClick={() => setOpen(true)}>
        <Search size={18} aria-hidden="true" /><span>Search {collection.toLowerCase()}</span>
      </button>
      {revealed && <Button variant="ghost" size="icon" aria-label="Hide search" onClick={() => {
        setRevealed(false);
        browse.current?.focus({ preventScroll: true });
      }}><X aria-hidden="true" /></Button>}
    </div>}
    {children({
      desktopSearch: <div className="rj-library-search rj-desktop-search"><label htmlFor={`${id}-desktop`}>{label}</label><div><Search size={18} aria-hidden="true" /><input ref={desktopInput} id={`${id}-desktop`} type="search" placeholder={`Search ${collection.toLowerCase()}`} value={query} onChange={event => onQueryChange(event.target.value)} /></div></div>,
    })}
    <Dialog open={mobile && open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="rj-redesign rj-collection-search-dialog" showCloseButton={false}
        onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          (window.matchMedia(mobileBreakpoint).matches ? browse.current : desktopInput.current)?.focus({ preventScroll: true });
        }}>
        <header onTouchStart={event => {
          dialogStart.current = event.touches.length === 1 && event.target instanceof Element && !event.target.closest('input')
            ? event.touches[0]
            : null;
        }}
          onTouchCancel={() => { dialogStart.current = null; }}
          onTouchEnd={event => {
            const direction = verticalSwipe(dialogStart.current, event.changedTouches.length === 1 ? event.changedTouches[0] : undefined);
            dialogStart.current = null;
            if (direction === 'down') close();
          }}>
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
