import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookCover } from '@/components/reading-journal/BookCover';
import type { HomeBook } from './HomeCards';
import { ProgressWheelPicker } from './ProgressWheelPicker';
import './redesign.css';

export interface ProgressDraft { page: number; minutes?: number }

function ProgressForm({ book, onSave, onClose, initialDraft }: { book: HomeBook; onSave: (draft: ProgressDraft) => Promise<void>; onClose: () => void; initialDraft?: ProgressDraft }) {
  const errorId = useId();
  const pageLabelId = useId();
  const timeLabelId = useId();
  const [page, setPage] = useState(initialDraft?.page ?? book.currentPage);
  const [hours, setHours] = useState(Math.floor((initialDraft?.minutes ?? 0) / 60));
  const [minutes, setMinutes] = useState((initialDraft?.minutes ?? 0) % 60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const totalKnown = Boolean(book.totalPages && book.totalPages > 0);

  return <form className="rj-progress-form" onSubmit={async event => {
    event.preventDefault();
    if (saving) return;
    const selectedPage = page;
    if (!Number.isInteger(selectedPage) || selectedPage < book.currentPage || (totalKnown && selectedPage > book.totalPages!)) {
      setError(`Enter a page from ${book.currentPage}${totalKnown ? ` to ${book.totalPages}` : ' onward'}.`);
      return;
    }
    const selectedMinutes = hours * 60 + minutes;
    try {
      setSaving(true); setError('');
      await onSave({ page: selectedPage, minutes: selectedMinutes || undefined });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Progress could not be saved. Try again.'); }
    finally { setSaving(false); }
  }}>
    <div className="rj-progress-book"><div><span className="rj-book-title">{book.title}</span><span className="rj-muted">{book.author}</span><dl className="rj-progress-page-count"><div><dt>Current page:</dt><dd>{book.currentPage}</dd></div><div><dt>Total pages:</dt><dd>{totalKnown ? book.totalPages : 'Unknown'}</dd></div></dl></div><BookCover src={book.cover} title={book.title} /></div>
    <div role="group" aria-labelledby={pageLabelId}>
      <p id={pageLabelId} className="rj-picker-label">To what page did you read?</p>
      <div className="rj-picker-panel rj-page-picker-panel">
        <ProgressWheelPicker label="To what page did you read?" value={page} min={book.currentPage} max={totalKnown ? book.totalPages! : undefined} onChange={setPage} disabled={saving} describedBy={error ? errorId : undefined} />
      </div>
    </div>
    <div role="group" aria-labelledby={timeLabelId}>
      <p id={timeLabelId} className="rj-picker-label">How long did you read?<span className="sr-only"> (optional)</span></p>
      <div className="rj-picker-panel rj-time-picker-panel">
        <ProgressWheelPicker label="Hours" value={hours} min={0} max={23} formatValue={value => `${value}h`} onChange={setHours} disabled={saving} />
        <ProgressWheelPicker label="Minutes" value={minutes} min={0} max={55} step={5} formatValue={value => `${String(value).padStart(2, '0')}m`} onChange={setMinutes} disabled={saving} />
      </div>
    </div>
    {error && <p role="alert" id={errorId}>{error}</p>}
    <div className="rj-progress-footer"><Button variant="outline" type="button" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
  </form>;
}

/** Save is injected; the workshop supplies a local simulation, the app can supply its API later. */
export function ProgressDialog({ book, onSave, initiallyOpen = false, open: controlledOpen, onOpenChange, trigger, returnFocusTo, initialDraft }: {
  book: HomeBook; onSave: (draft: ProgressDraft) => Promise<void>; initiallyOpen?: boolean;
  open?: boolean; onOpenChange?: (open: boolean) => void; trigger?: ReactNode; returnFocusTo?: HTMLElement | null;
  initialDraft?: ProgressDraft;
}) {
  const [localOpen, setLocalOpen] = useState(initiallyOpen);
  const open = controlledOpen ?? localOpen;
  function setOpen(next: boolean) { setLocalOpen(next); onOpenChange?.(next); }
  const [saving, setSaving] = useState(false);
  return <Dialog open={open} onOpenChange={next => { if (!saving) setOpen(next); }}>
    {trigger !== null && <DialogTrigger asChild>{trigger ?? <Button>Update Progress</Button>}</DialogTrigger>}
    <DialogContent className="rj-redesign rj-progress-dialog" showCloseButton={!saving} onCloseAutoFocus={event => { if (returnFocusTo) { event.preventDefault(); returnFocusTo.focus(); } }} onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onPointerDownOutside={event => { if (saving) event.preventDefault(); }}>
      <DialogTitle>Update Progress</DialogTitle>
      <DialogDescription className="sr-only">Record the page you reached and, optionally, your reading time. Scroll the wheels, use arrow keys or type digits to choose a value.</DialogDescription>
      <ProgressForm book={book} initialDraft={initialDraft} onClose={() => setOpen(false)} onSave={async draft => { setSaving(true); try { await onSave(draft); } finally { setSaving(false); } }} />
    </DialogContent>
  </Dialog>;
}
