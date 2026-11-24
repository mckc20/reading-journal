import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import './collection-search.css';

const mobileBreakpoint = '(max-width: 767px)';

type SearchGesture = {
  x: number;
  y: number;
  scrollY: number;
  expanded: boolean;
};

/** How much of the field to show while a predominantly vertical gesture is in progress. */
function getReveal(gesture: SearchGesture, touch: Touch) {
  const dy = touch.clientY - gesture.y;
  if (Math.abs(dy) < 5 || Math.abs(dy) < Math.abs(touch.clientX - gesture.x) * 1.3) return;
  if (gesture.expanded && dy < 0) return Math.max(0, 1 + dy / 44);
  if (!gesture.expanded && dy > 0 && window.scrollY <= 2) {
    return Math.min(1, Math.max(0, (dy - gesture.scrollY) / 56));
  }
}

/** Each panel owns its query and filters its existing results as the reader types. */
export function CollectionSearch({ collection, query, onQueryChange, children }: {
  collection: string;
  query: string;
  onQueryChange: (query: string) => void;
  children: (controls: { desktopSearch: ReactNode }) => ReactNode;
}) {
  const id = useId();
  const expanded = useRef(Boolean(query));
  const [reveal, setReveal] = useState(query ? 1 : 0);
  const [pulling, setPulling] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const label = `Search your ${collection.toLowerCase()}`;
  const placeholder = `Search ${collection.toLowerCase()}`;

  const settle = useCallback((open: boolean) => {
    expanded.current = open;
    setPulling(false);
    setReveal(open ? 1 : 0);
    if (!open && document.activeElement === mobileInput.current) mobileInput.current?.blur();
  }, []);

  useEffect(() => {
    const main = panel.current?.closest('main');
    if (!main) return;
    const mobile = window.matchMedia(mobileBreakpoint);
    let gesture: SearchGesture | null = null;
    let trackingPull = false;
    let lastScrollY = Math.max(0, window.scrollY);

    function begin(event: TouchEvent) {
      if (gesture) settle(gesture.expanded);
      gesture = null;
      trackingPull = false;
      const target = event.target;
      if (!mobile.matches || event.touches.length !== 1 || !(target instanceof Element) ||
          target.closest('[inert], textarea, select, [role="slider"], [role="spinbutton"]') ||
          (target instanceof HTMLInputElement && target !== mobileInput.current)) return;
      const { clientX, clientY } = event.touches[0];
      gesture = { x: clientX, y: clientY, scrollY: Math.max(0, window.scrollY), expanded: expanded.current };
    }

    function move(event: TouchEvent) {
      if (!gesture || event.touches.length !== 1) return;
      const progress = getReveal(gesture, event.touches[0]);
      if (progress === undefined && !trackingPull) return;
      if (!trackingPull) {
        trackingPull = true;
        setPulling(true);
      }
      setReveal(progress ?? (gesture.expanded ? 1 : 0));
    }

    function end(event: TouchEvent) {
      const origin = gesture;
      gesture = null;
      if (!origin) return;
      const progress = event.changedTouches.length === 1 ? getReveal(origin, event.changedTouches[0]) : undefined;
      settle(progress === undefined ? origin.expanded : progress >= (origin.expanded ? .8 : .35));
    }

    function cancel() {
      if (gesture) settle(gesture.expanded);
      gesture = null;
    }

    function wheel(event: WheelEvent) {
      if (!mobile.matches || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (window.scrollY <= 2 && event.deltaY < 0) settle(true);
      else if (event.deltaY > 0 && expanded.current) settle(false);
    }

    function scroll() {
      const scrollY = Math.max(0, window.scrollY);
      // Focusing the field can scroll the page when a software keyboard opens.
      if (mobile.matches && !gesture && expanded.current && scrollY > lastScrollY &&
          document.activeElement !== mobileInput.current) settle(false);
      lastScrollY = scrollY;
    }

    main.addEventListener('touchstart', begin, { passive: true });
    main.addEventListener('touchmove', move, { passive: true });
    main.addEventListener('touchend', end, { passive: true });
    main.addEventListener('touchcancel', cancel, { passive: true });
    main.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      main.removeEventListener('touchstart', begin);
      main.removeEventListener('touchmove', move);
      main.removeEventListener('touchend', end);
      main.removeEventListener('touchcancel', cancel);
      main.removeEventListener('wheel', wheel);
      window.removeEventListener('scroll', scroll);
    };
  }, [settle]);

  return (
    <div ref={panel} tabIndex={-1} className="rj-redesign rj-collection-search">
      <div className="rj-library-mobile-search" style={{ '--search-reveal': reveal } as CSSProperties}
        data-pulling={pulling || undefined} data-revealed={reveal > 0 || undefined} role="search" aria-label={label}>
        <div className="rj-library-search-field">
          <Search size={18} aria-hidden="true" />
          <input ref={mobileInput} type="search" value={query} aria-label={label} placeholder={placeholder} autoComplete="off"
            enterKeyHint="search" onFocus={() => settle(true)} onChange={event => onQueryChange(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              onQueryChange('');
              settle(false);
              panel.current?.focus({ preventScroll: true });
            }} />
        </div>
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
