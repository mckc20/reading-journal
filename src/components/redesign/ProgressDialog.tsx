import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { HomeBook } from './HomeCards';
import { ProgressBookSummary, ProgressWheels } from './ProgressFields';
import './redesign.css';

export interface ProgressDraft { page: number; minutes?: number }

function ProgressForm({ book, onSave, onClose, initialDraft }: { book: HomeBook; onSave: (draft: ProgressDraft) => Promise<void>; onClose: () => void; initialDraft?: ProgressDraft }) {
  const errorId = useId();
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
    <ProgressBookSummary book={book} />
    <ProgressWheels page={page} minPage={book.currentPage} maxPage={totalKnown ? book.totalPages! : undefined}
      hours={hours} minutes={minutes} disabled={saving} errorId={error ? errorId : undefined}
      onPageChange={setPage} onHoursChange={setHours} onMinutesChange={setMinutes} />
    {error && <p role="alert" id={errorId}>{error}</p>}
    <div className="rj-progress-footer"><Button variant="outline" type="button" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
  </form>;
}

/** The workshop uses the same fields as the app with a simulated save. */
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
