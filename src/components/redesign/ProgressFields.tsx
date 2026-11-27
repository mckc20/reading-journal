import { useId, type ComponentProps, type ReactNode } from 'react';
import { BookCover } from '@/components/reading-journal/BookCover';
import type { HomeBook } from './HomeCards';
import { ProgressWheelPicker } from './ProgressWheelPicker';

export function ProgressBookSummary({ book, titleLink }: { book: HomeBook; titleLink?: ReactNode }) {
  return (
    <div className="rj-progress-book">
      <div>
        <span className="rj-book-title">{titleLink ?? book.title}</span>
        <span className="rj-muted">{book.author}</span>
        <dl className="rj-progress-page-count">
          <div><dt>Current page:</dt><dd>{book.currentPage}</dd></div>
          <div><dt>Total pages:</dt><dd>{book.totalPages && book.totalPages > 0 ? book.totalPages : 'Unknown'}</dd></div>
        </dl>
      </div>
      <BookCover src={book.cover} title={book.title} decorative />
    </div>
  );
}

export function ProgressWheelField({
  pagePanel = false, ...wheel
}: ComponentProps<typeof ProgressWheelPicker> & { pagePanel?: boolean }) {
  const labelId = useId();

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="rj-picker-label">{wheel.label}</p>
      <div className={pagePanel ? "rj-picker-panel rj-page-picker-panel" : "rj-picker-panel"}>
        <ProgressWheelPicker {...wheel} />
      </div>
    </div>
  );
}

export function ProgressPageWheel(wheel: Omit<ComponentProps<typeof ProgressWheelPicker>, "label">) {
  return <ProgressWheelField {...wheel} pagePanel label="What page did you read up to?" />;
}

interface ProgressWheelsProps {
  page: number;
  minPage: number;
  maxPage?: number;
  hours: number;
  maxHours?: number;
  minutes: number;
  disabled?: boolean;
  errorId?: string;
  additionalTime?: boolean;
  onPageChange: (page: number) => void;
  onHoursChange: (hours: number) => void;
  onMinutesChange: (minutes: number) => void;
}

export function ProgressWheels({
  page, minPage, maxPage, hours, maxHours = 23, minutes, disabled, errorId, additionalTime,
  onPageChange, onHoursChange, onMinutesChange,
}: ProgressWheelsProps) {
  const timeLabelId = useId();

  return (
    <>
      <ProgressPageWheel value={page} min={minPage} max={maxPage}
        onChange={onPageChange} disabled={disabled} describedBy={errorId} />
      <div role="group" aria-labelledby={timeLabelId}>
        <p id={timeLabelId} className="rj-picker-label">{additionalTime ? "Additional reading time" : "How long did you read?"}<span className="sr-only"> (optional)</span></p>
        <div className="rj-picker-panel rj-time-picker-panel">
          <ProgressWheelPicker label="Hours" value={hours} min={0} max={maxHours} formatValue={value => `${value}h`} onChange={onHoursChange} disabled={disabled} />
          <ProgressWheelPicker label="Minutes" value={minutes} min={0} max={55} step={5} formatValue={value => `${String(value).padStart(2, '0')}m`} onChange={onMinutesChange} disabled={disabled} />
        </div>
      </div>
    </>
  );
}
