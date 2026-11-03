import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const duration = 360;
interface SlideState {
  current: string;
  previous?: string;
  direction: number;
}

/** Slide immediately; the incoming month can display its loading state while fetching. */
export default function WrapUpSlide({ monthKey, inline = false, children }: {
  monthKey: string;
  inline?: boolean;
  children: (key: string) => ReactNode;
}) {
  const [slide, setSlide] = useState<SlideState>({ current: monthKey, direction: 1 });
  if (slide.current !== monthKey) {
    setSlide({
      current: monthKey,
      previous: slide.current,
      direction: monthKey > slide.current ? 1 : -1,
    });
  }
  useEffect(() => {
    if (!slide.previous) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => setSlide(state => state.current === slide.current ? { ...state, previous: undefined } : state);
    const timer = window.setTimeout(finish, reducedMotion.matches ? 0 : duration);
    return () => window.clearTimeout(timer);
  }, [slide.current, slide.previous]);

  const Tag = inline ? 'span' : 'div';
  const moving = Boolean(slide.previous);
  const keys = slide.previous ? [slide.previous, slide.current] : [slide.current];
  return (
    <Tag
      tabIndex={inline ? undefined : -1}
      className={`wrap-up-slide ${inline ? 'wrap-up-slide-heading' : ''}`}
      style={{ '--wrap-up-slide-direction': slide.direction } as CSSProperties}
    >
      {keys.map(key => {
        const outgoing = key !== slide.current;
        return (
          <Tag
            key={key}
            ref={node => {
              if (!node) return;
              if (outgoing) {
                // Move focus before hiding the old month from assistive technology.
                // The parent survives month changes, including incoming loading states.
                if (node.contains(node.ownerDocument.activeElement)) {
                  node.parentElement?.focus({ preventScroll: true });
                }
                node.setAttribute('inert', '');
                node.setAttribute('aria-hidden', 'true');
              } else {
                node.removeAttribute('inert');
                node.removeAttribute('aria-hidden');
              }
            }}
            className={`wrap-up-slide-layer ${outgoing ? 'wrap-up-slide-outgoing' : ''} ${moving ? outgoing ? 'wrap-up-slide-out' : 'wrap-up-slide-in' : ''}`}
          >
            {children(key)}
          </Tag>
        );
      })}
    </Tag>
  );
}
