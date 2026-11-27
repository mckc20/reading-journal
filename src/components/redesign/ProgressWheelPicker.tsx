import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';

const ROW_HEIGHT = 32;
const ROW_BUFFER = 50;

interface ProgressWheelPickerProps {
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  pageJump?: number;
  disabled?: boolean;
  describedBy?: string;
  formatValue?: (value: number) => string;
  parseTypedValue?: (digits: string) => number | null;
  onChange: (value: number) => void;
}

/** Three visible rows with native touch/wheel scrolling and spinbutton keyboard support. */
export function ProgressWheelPicker({
  label, value, min, max, step = 1, pageJump = step * 10, disabled = false, describedBy,
  formatValue = String, parseTypedValue = Number, onChange,
}: ProgressWheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const typedDigits = useRef({ text: '', lastTyped: 0 });
  const selectedIndex = Math.round((value - min) / step);
  const maxIndex = max === undefined ? undefined : Math.floor((max - min) / step);
  // Leave the scroll positions fixed as rows are added and removed around the selection.
  const firstIndex = Math.max(0, selectedIndex - ROW_BUFFER);
  const lastIndex = Math.min(maxIndex ?? Infinity, selectedIndex + ROW_BUFFER);
  const remainingRows = (maxIndex ?? lastIndex) - lastIndex;

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    // User scrolling already selected the nearest row. Only move the scroll position
    // for picks made by keyboard, by tapping a row, or by changes to the form.
    if (Math.round(scroller.scrollTop / ROW_HEIGHT) !== selectedIndex) {
      scroller.scrollTop = selectedIndex * ROW_HEIGHT;
    }
  }, [selectedIndex]);

  function choose(nextValue: number) {
    const index = Math.max(0, Math.min(maxIndex ?? Infinity, Math.round((nextValue - min) / step)));
    onChange(min + index * step);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const changes: Record<string, number> = {
      ArrowUp: value + step, ArrowDown: value - step,
      PageUp: value + pageJump, PageDown: value - pageJump, Home: min,
    };
    if (max !== undefined) changes.End = max;
    if (event.key in changes) {
      event.preventDefault();
      typedDigits.current.text = '';
      choose(changes[event.key]);
    } else if (/^\d$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = ((now - typedDigits.current.lastTyped < 800 ? typedDigits.current.text : '') + event.key).slice(0, 10);
      typedDigits.current = { text, lastTyped: now };
      const parsed = parseTypedValue(text);
      if (parsed !== null) choose(parsed);
    }
  }

  return (
    <div
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
      onBlur={() => { typedDigits.current.text = ''; }}
      onPointerDown={event => {
        if (disabled) return;
        typedDigits.current.text = '';
        event.currentTarget.focus({ preventScroll: true });
      }}
    >
      <div className="rj-wheel-selection" aria-hidden="true" />
      <div
        ref={scrollRef}
        className="rj-wheel-scroll"
        aria-hidden="true"
        style={{ overflowY: disabled ? 'hidden' : 'auto' }}
        onScroll={event => {
          if (disabled) return;
          const index = Math.round(event.currentTarget.scrollTop / ROW_HEIGHT);
          const next = min + index * step;
          if (next !== value) choose(next);
        }}
      >
        <div style={{ height: (firstIndex + 1) * ROW_HEIGHT }} />
        {Array.from({ length: lastIndex - firstIndex + 1 }, (_, offset) => {
          const itemValue = min + (firstIndex + offset) * step;
          return <div
            key={itemValue}
            className="rj-wheel-row"
            data-selected={itemValue === value}
            onClick={() => { if (!disabled) choose(itemValue); }}
          >{formatValue(itemValue)}</div>;
        })}
        <div style={{ height: (remainingRows + 1) * ROW_HEIGHT }} />
      </div>
    </div>
  );
}
