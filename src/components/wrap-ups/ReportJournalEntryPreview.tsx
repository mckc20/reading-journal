import { Bookmark } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FormattedNoteContent from '@/components/FormattedNoteContent';
import QuoteBlock from '@/components/QuoteBlock';
import type { ReportJournalEntry } from '@/lib/wrapUpReports';

export default function ReportJournalEntryPreview({ entry }: { entry: ReportJournalEntry }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);
  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    // Measure the rendered Markdown so formatting and shorter entries stay intact.
    const measure = () => setTruncated(preview.scrollHeight > preview.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    if (preview.firstElementChild) observer.observe(preview.firstElementChild);
    return () => observer.disconnect();
  }, [entry.content, entry.label, entry.attribution]);

  return (
    <div className="space-y-2 rounded-lg bg-muted/30 p-4">
      <p className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
        {entry.label === 'quote' ? 'Quote' : entry.label === 'review' ? 'Review' : 'Journal entry'}
        {entry.is_favorite && <Bookmark className="h-3.5 w-3.5 fill-primary text-primary" aria-label="Saved entry" />}
        {' · '}{new Date(`${entry.entry_date}T12:00:00Z`).toLocaleDateString('en', {
          month: 'short', day: 'numeric', timeZone: 'UTC',
        })}
      </p>
      <div ref={previewRef} className="max-h-48 overflow-hidden">
        <div>
          {entry.label === 'quote' ? (
            <QuoteBlock
              className="gap-x-2"
              markClassName="text-muted-foreground/40"
              attribution={entry.attribution ? <span className="font-serif italic">- {entry.attribution}</span> : null}
            >
              <FormattedNoteContent markdown={entry.content} className="break-words text-base leading-8" />
            </QuoteBlock>
          ) : (
            <>
              <FormattedNoteContent markdown={entry.content} className="break-words text-sm" />
              {entry.attribution && <p className="text-sm">— {entry.attribution}</p>}
            </>
          )}
        </div>
      </div>
      {truncated && (
        <Link
          to={`/books/${entry.book_id}/journal?entry=${encodeURIComponent(entry.id)}`}
          className="inline-block text-sm text-primary underline underline-offset-4"
        >Read full entry</Link>
      )}
    </div>
  );
}
