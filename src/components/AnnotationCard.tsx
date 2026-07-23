import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import FormattedNoteContent from "@/components/FormattedNoteContent";
import QuoteBlock from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { formatBookJournalEntryRecordPageRange } from "@/lib/bookJournal";
import { cn } from "@/lib/utils";
import type { BookJournalEntryRecord, JournalEntryLabel } from "@/types";

const LABEL_STYLES: Record<JournalEntryLabel, string> = {
  quote: "border-quote/25 bg-quote/10 text-quote",
  review: "border-insight/25 bg-insight/10 text-insight",
  note: "border-note/25 bg-note/10 text-note",
};

function formatNoteDate(value: string): string {
  const dateValue = value.includes("T") ? value : `${value}T00:00:00`;

  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function labelText(label: JournalEntryLabel): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface AnnotationCardProps {
  note: BookJournalEntryRecord;
  bookId?: string | null;
  bookTitle?: string | null;
  compact?: boolean;
  className?: string;
}

export default function AnnotationCard({ note, bookId, bookTitle, compact = false, className }: AnnotationCardProps) {
  const pageRangeLabel = formatBookJournalEntryRecordPageRange(note);
  const visibleDate = note.entry_date ?? note.created_at;
  const bookLabel = bookTitle && bookId ? (
    <Link to={`/books/${bookId}`} className="text-muted-foreground transition-colors hover:text-foreground">
      From {bookTitle}
    </Link>
  ) : bookTitle ? (
    <span>{bookTitle}</span>
  ) : null;

  if (note.label === "quote") {
    return (
      <article className={cn("rounded-lg border bg-background p-4 dark:bg-card", className)}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <time dateTime={visibleDate}>{formatNoteDate(visibleDate)}</time>
            {pageRangeLabel && <span>{pageRangeLabel}</span>}
            {bookLabel}
          </div>
          {note.is_favorite && <Heart className="h-4 w-4 fill-favorite text-favorite" />}
        </div>
        <QuoteBlock
          attribution={
            note.attribution ? (
              <span className="font-serif italic">- {note.attribution}</span>
            ) : null
          }
        >
          <FormattedNoteContent
            markdown={note.content}
            className={cn(
              "text-sm leading-6 text-foreground",
              compact && "line-clamp-5",
            )}
          />
        </QuoteBlock>
      </article>
    );
  }

  return (
    <article className={cn("rounded-lg border bg-background p-4 dark:bg-card", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={LABEL_STYLES[note.label]}>
            {labelText(note.label)}
          </Badge>
          {pageRangeLabel && <span className="text-xs font-medium text-muted-foreground">{pageRangeLabel}</span>}
          {bookLabel}
        </div>
        <div className="flex items-center gap-2">
          {note.is_favorite && <Heart className="h-4 w-4 fill-favorite text-favorite" />}
          <time className="text-xs text-muted-foreground" dateTime={visibleDate}>
            {formatNoteDate(visibleDate)}
          </time>
        </div>
      </div>
      <FormattedNoteContent
        markdown={note.content}
        className={cn("text-sm leading-6 text-foreground", compact && "line-clamp-5")}
      />
    </article>
  );
}
