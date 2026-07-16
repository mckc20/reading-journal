import { Bookmark, Link as LinkIcon, Reply } from "lucide-react";
import FormattedNoteContent from "@/components/FormattedNoteContent";
import QuoteBlock from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { getJournalEntryTags, type JournalTimelineEntry } from "@/lib/journal";
import { GENERATED_EVENT_NOTE_TAG_PREFIX, READING_LOG_NOTE_TAG_PREFIX, normalizeJournalTags, visibleJournalTags } from "@/lib/journalTags";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface JournalEntryCardProps {
  entry: JournalTimelineEntry;
  busy?: boolean;
  onToggleSaved?: (entry: JournalTimelineEntry) => void;
  onReply?: (entry: JournalTimelineEntry) => void;
  onLink?: (entry: JournalTimelineEntry) => void;
}

function titleForEntry(entry: JournalTimelineEntry): ReactNode {
  if (entry.source === "generated_book_event") return entry.label;
  const tags = visibleJournalTags(getJournalEntryTags(entry));
  if (entry.source === "book_note" && tags.some((tag) => tag.toLocaleLowerCase() === "review") && entry.relatedBookTitle) {
    return (
      <>
        Review of <span className="font-serif italic">{entry.relatedBookTitle}</span>
      </>
    );
  }
  if (entry.source === "book_note") return entry.bookJournalEntry.label === "quote" ? "" : entry.bookJournalEntry.title || "";
  if (entry.source === "series_note") return entry.seriesJournalEntry.label === "quote" ? "" : entry.seriesJournalEntry.title || "";
  return entry.authorJournalEntry.label === "quote" ? "" : entry.authorJournalEntry.title || "";
}

function contentForEntry(entry: JournalTimelineEntry): string {
  if (entry.source === "generated_book_event") return entry.description ?? "";
  if (entry.source === "book_note") return entry.bookJournalEntry.content;
  if (entry.source === "series_note") return entry.seriesJournalEntry.content;
  return entry.authorJournalEntry.content;
}

function isCompactEntry(entry: JournalTimelineEntry): boolean {
  const title = titleForEntry(entry);
  const titleText = typeof title === "string" ? title.trim() : "";
  const content = contentForEntry(entry)
    .replace(/[#>*_\-[\]()`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const explicitLineCount = contentForEntry(entry).split(/\r?\n/).filter((line) => line.trim()).length;
  const estimatedLineCount = Math.max(explicitLineCount, Math.ceil((titleText.length + content.length) / 72));

  return estimatedLineCount <= 3;
}

function quoteSpeakerForEntry(entry: JournalTimelineEntry): string | null {
  if (entry.source === "book_note") return entry.bookJournalEntry.quote_speaker ?? null;
  if (entry.source === "series_note") return entry.seriesJournalEntry.quote_speaker ?? null;
  if (entry.source === "author_note") return entry.authorJournalEntry.quote_speaker ?? null;
  return null;
}

function isSaved(entry: JournalTimelineEntry): boolean {
  if (entry.source === "book_note") return entry.bookJournalEntry.is_favorite;
  if (entry.source === "series_note") return entry.seriesJournalEntry.is_favorite;
  if (entry.source === "author_note") return entry.authorJournalEntry.is_favorite;
  return false;
}

function isManual(entry: JournalTimelineEntry): boolean {
  return entry.source === "book_note" || entry.source === "series_note" || entry.source === "author_note";
}

function isReply(entry: JournalTimelineEntry): boolean {
  if (entry.source === "book_note") return Boolean(entry.bookJournalEntry.parent_entry_id);
  if (entry.source === "series_note") return Boolean(entry.seriesJournalEntry.parent_entry_id);
  if (entry.source === "author_note") return Boolean(entry.authorJournalEntry.parent_entry_id);
  return false;
}

function isAttachedGeneratedNote(entry: JournalTimelineEntry): boolean {
  if (!isManual(entry)) return false;
  return normalizeJournalTags(getJournalEntryTags(entry)).some(
    (tag) => tag.startsWith(GENERATED_EVENT_NOTE_TAG_PREFIX) || tag.startsWith(READING_LOG_NOTE_TAG_PREFIX),
  );
}

export default function JournalEntryCard({ entry, busy = false, onToggleSaved, onReply, onLink }: JournalEntryCardProps) {
  const tags = visibleJournalTags(getJournalEntryTags(entry));
  const title = titleForEntry(entry);
  const saved = isSaved(entry);
  const showReply = ((isManual(entry) && !isReply(entry) && !isAttachedGeneratedNote(entry)) || (entry.source === "generated_book_event" && entry.entityType === "Book")) && onReply;
  const showLink = isManual(entry) && onLink;
  const linkWithSave = Boolean(showLink && isCompactEntry(entry));
  const linkWithReply = Boolean(showLink && !linkWithSave);

  return (
    <article
      className={cn(
        "relative h-full rounded-lg border bg-background p-4",
        linkWithSave ? "pr-20" : isManual(entry) && onToggleSaved ? "pr-12" : "pr-4",
      )}
    >
      {((isManual(entry) && onToggleSaved) || linkWithSave) && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          {isManual(entry) && onToggleSaved && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              aria-label={saved ? "Unsave entry" : "Save entry"}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSaved(entry);
              }}
            >
              <Bookmark className={cn("h-4 w-4", saved && "fill-primary text-primary")} />
            </Button>
          )}
          {linkWithSave && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              aria-label="Link entry"
              title="Link entry"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onLink?.(entry);
              }}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {title && <h3 className="mb-3 pr-8 text-sm font-medium">{title}</h3>}

      {entry.type === "passage" ? (
        <QuoteBlock
          className={cn(isManual(entry) && onToggleSaved && "pr-8")}
          attribution={quoteSpeakerForEntry(entry) ? `- ${quoteSpeakerForEntry(entry)}` : null}
        >
          <FormattedNoteContent markdown={contentForEntry(entry)} className="line-clamp-4 text-sm leading-6 [&_em]:not-italic" />
        </QuoteBlock>
      ) : (
        <FormattedNoteContent markdown={contentForEntry(entry)} className="line-clamp-4 text-sm leading-6" />
      )}

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[0.7rem]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {(showReply || linkWithReply) && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1">
          {linkWithReply && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              aria-label="Link entry"
              title="Link entry"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onLink?.(entry);
              }}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          )}
          {showReply && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              aria-label="Add note"
              title="Add note"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onReply(entry);
              }}
            >
              <Reply className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
