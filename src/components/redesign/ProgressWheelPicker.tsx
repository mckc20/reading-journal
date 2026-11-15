import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';

const ROW_HEIGHT = 32;

interface ProgressWheelPickerProps {
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  describedBy?: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}

/** Three visible rows with native touch/wheel scrolling and spinbutton keyboard support. */
export function ProgressWheelPicker({
  label, value, min, max, step = 1, disabled = false, describedBy,
  formatValue = String, onChange,
}: ProgressWheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const typedDigits = useRef({ text: '', lastTyped: 0 });
  // Keep a small window of choices even for very large or unknown page counts.
  // Recenter as the reader moves; this does not impose a maximum page count.
  const firstValue = min + Math.max(0, Math.round((value - min) / step) - 50) * step;
  const lastValue = Math.min(max ?? value + 50 * step, value + 50 * step);
  const count = Math.floor((lastValue - firstValue) / step) + 1;

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const target = (value - firstValue) / step * ROW_HEIGHT;
    // Let touch scrolling finish naturally when it is already in this row.
    if (Math.abs(scroller.scrollTop - target) > ROW_HEIGHT / 2) {
      scroller.scrollTop = target;
    }
  }, [value, firstValue, step]);

  function choose(nextValue: number) {
    const rounded = min + Math.round((nextValue - min) / step) * step;
    const next = Math.max(min, Math.min(max ?? rounded, rounded));
    onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const changes: Record<string, number> = {
      ArrowUp: value + step, ArrowDown: value - step,
      PageUp: value + step * 10, PageDown: value - step * 10, Home: min,
    };
    if (event.key === 'End' && max !== undefined) changes.End = max;
    if (event.key in changes) {
      event.preventDefault();
      typedDigits.current.text = '';
      choose(changes[event.key]);
    } else if (/^\d$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = ((now - typedDigits.current.lastTyped < 800 ? typedDigits.current.text : '') + event.key).slice(0, 10);
      typedDigits.current = { text, lastTyped: now };
      choose(Number(text));
    }
  }

  return (
    <div
      ref={controlRef}
      className="rj-wheel"
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={formatValue(value)}
      aria-disabled={disabled}
      aria-describedby={describedBy}
      onKeyDown={handleKeyDown}
      onPointerDown={() => { if (!disabled) controlRef.current?.focus({ preventScroll: true }); }}
    >
      <div className="rj-wheel-selection" aria-hidden="true" />
      <div
        ref={scrollRef}
        className="rj-wheel-scroll"
        aria-hidden="true"
        style={{ overflowY: disabled ? 'hidden' : 'auto' }}
        onScroll={event => {
          if (disabled) return;
          const index = Math.max(0, Math.min(count - 1, Math.round(event.currentTarget.scrollTop / ROW_HEIGHT)));
          const next = firstValue + index * step;
          // Commit the centered row immediately, so Save never races a scroll debounce.
          if (next !== value) onChange(next);
        }}
      >
        <div className="rj-wheel-spacer" />
        {Array.from({ length: count }, (_, index) => {
          const itemValue = firstValue + index * step;
          return <div
            key={itemValue}
            className="rj-wheel-row"
            data-selected={itemValue === value}
            onClick={() => { if (!disabled) choose(itemValue); }}
          >{formatValue(itemValue)}</div>;
        })}
        <div className="rj-wheel-spacer" />
      </div>
    </div>
  );
}
