import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './collection-search.css';

const mobileBreakpoint = '(max-width: 767px)';

/** Each panel owns its query and filters its existing results as the reader types. */
export function CollectionSearch({ collection, query, onQueryChange, children }: {
  collection: string;
  query: string;
  onQueryChange: (query: string) => void;
  children: (controls: { desktopSearch: ReactNode }) => ReactNode;
}) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const label = `Search your ${collection.toLowerCase()}`;
  const placeholder = `Search ${collection.toLowerCase()}`;

  useEffect(() => {
    const main = panel.current?.closest('main');
    if (!main) return;
    const mobile = window.matchMedia(mobileBreakpoint);
    let start: { x: number; y: number; atTop: boolean } | null = null;

    function begin(event: TouchEvent) {
      start = null;
      const target = event.target;
      if (!mobile.matches || event.touches.length !== 1 || !(target instanceof Element) ||
          target.closest('[inert], input, textarea, select, [role="slider"], [role="spinbutton"]')) return;
      const { clientX, clientY } = event.touches[0];
      start = { x: clientX, y: clientY, atTop: window.scrollY <= 2 };
    }

    function end(event: TouchEvent) {
      const origin = start;
      start = null;
      if (!origin || event.changedTouches.length !== 1) return;
      const { clientX, clientY } = event.changedTouches[0];
      const dy = clientY - origin.y;
      if (dy >= 40 && dy >= Math.abs(clientX - origin.x) * 1.5 && (origin.atTop || window.scrollY <= 2)) {
        setRevealed(true);
      }
    }

    function wheel(event: WheelEvent) {
      if (mobile.matches && window.scrollY <= 2 && event.deltaY < -Math.abs(event.deltaX) && !event.ctrlKey) {
        setRevealed(true);
      }
    }

    function cancel() { start = null; }

    main.addEventListener('touchstart', begin, { passive: true });
    main.addEventListener('touchend', end, { passive: true });
    main.addEventListener('touchcancel', cancel, { passive: true });
    main.addEventListener('wheel', wheel, { passive: true });
    return () => {
      main.removeEventListener('touchstart', begin);
      main.removeEventListener('touchend', end);
      main.removeEventListener('touchcancel', cancel);
      main.removeEventListener('wheel', wheel);
    };
  }, []);

  function hideSearch() {
    onQueryChange('');
    setRevealed(false);
    panel.current?.focus({ preventScroll: true });
  }

  return (
    <div ref={panel} tabIndex={-1} className="rj-redesign rj-collection-search">
      <div className="rj-library-mobile-search" data-revealed={revealed || query.length > 0 || undefined} role="search" aria-label={label}>
        <div className="rj-library-search-field">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={query} aria-label={label} placeholder={placeholder} autoComplete="off"
            enterKeyHint="search" onFocus={() => setRevealed(true)} onChange={event => onQueryChange(event.target.value)}
            onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); hideSearch(); } }} />
        </div>
        {(revealed || query.length > 0) && (
          <Button type="button" variant="ghost" size="icon" aria-label="Hide search" onClick={hideSearch}>
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      {children({
        desktopSearch: (
          <div className="rj-library-search rj-desktop-search">
            <label htmlFor={id}>{label}</label>
            <div>
              <Search size={18} aria-hidden="true" />
              <input id={id} type="search" placeholder={placeholder} value={query} onChange={event => onQueryChange(event.target.value)} />
            </div>
          </div>
        ),
      })}
    </div>
  );
}
