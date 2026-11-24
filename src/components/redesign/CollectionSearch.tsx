import { useCallback, useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import './collection-search.css';

const mobileBreakpoint = '(max-width: 767px)';

type SearchGesture = {
  x: number;
  y: number;
  scrollY: number;
  expanded: boolean;
};

function verticalDistance(gesture: SearchGesture, touch: Touch) {
  const dy = touch.clientY - gesture.y;
  return Math.abs(dy) >= Math.abs(touch.clientX - gesture.x) * 1.3 ? dy : 0;
}

function openingProgress(gesture: SearchGesture, dy: number) {
  if (dy <= 0 || window.scrollY > 2) return 0;
  return Math.min(1, Math.max(0, (dy - gesture.scrollY) / 56));
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
  const searchBar = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const label = `Search your ${collection.toLowerCase()}`;
  const placeholder = `Search ${collection.toLowerCase()}`;

  // Update the field directly so touch frames never rerender the book list.
  const showProgress = useCallback((progress: number, pulling = false) => {
    const field = searchBar.current;
    if (!field) return;
    field.toggleAttribute('data-pulling', pulling);
    field.toggleAttribute('data-revealed', progress > 0);
    field.style.setProperty('--search-reveal', String(progress));
  }, []);

  const settle = useCallback((open: boolean) => {
    expanded.current = open;
    showProgress(open ? 1 : 0);
    if (!open && document.activeElement === mobileInput.current) mobileInput.current?.blur();
  }, [showProgress]);

  useLayoutEffect(() => { showProgress(expanded.current ? 1 : 0); }, [showProgress]);

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
      const dy = verticalDistance(gesture, event.touches[0]);
      if (gesture.expanded) {
        if (dy < -12) {
          gesture = null;
          settle(false);
        }
        return;
      }
      const progress = openingProgress(gesture, dy);
      if (progress === 0 && !trackingPull) return;
      trackingPull = true;
      showProgress(progress, true);
    }

    function end(event: TouchEvent) {
      const origin = gesture;
      gesture = null;
      if (!origin) return;
      const dy = event.changedTouches.length === 1 ? verticalDistance(origin, event.changedTouches[0]) : 0;
      settle(origin.expanded ? dy >= -12 : openingProgress(origin, dy) >= .35);
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
  }, [settle, showProgress]);

  return (
    <div ref={panel} tabIndex={-1} className="rj-redesign rj-collection-search">
      <div ref={searchBar} className="rj-library-mobile-search" role="search" aria-label={label}>
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
