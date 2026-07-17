import FormattedNoteContent from "@/components/FormattedNoteContent";
import QuoteBlock from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { getJournalEntryTags, type JournalTimelineEntry } from "@/lib/journal";
import { visibleJournalTags } from "@/lib/journalTags";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface JournalEntryCardProps {
  entry: JournalTimelineEntry;
  linkedEntryCount?: number;
  actions?: ReactNode;
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

function quoteSpeakerForEntry(entry: JournalTimelineEntry): string | null {
  if (entry.source === "book_note") return entry.bookJournalEntry.quote_speaker ?? null;
  if (entry.source === "series_note") return entry.seriesJournalEntry.quote_speaker ?? null;
  if (entry.source === "author_note") return entry.authorJournalEntry.quote_speaker ?? null;
  return null;
}

function linkedEntryCountLabel(count: number): string {
  return `Linked to ${count} ${count === 1 ? "entry" : "entries"}`;
}

export default function JournalEntryCard({ entry, linkedEntryCount = 0, actions }: JournalEntryCardProps) {
  const tags = visibleJournalTags(getJournalEntryTags(entry));
  const title = titleForEntry(entry);
  const hasLinkedEntries = linkedEntryCount > 0;

  return (
    <article
      className={cn(
        "relative h-full rounded-lg border bg-background p-4",
        actions ? (hasLinkedEntries ? "pr-56" : "pr-24") : "pr-4",
        hasLinkedEntries && "pb-9",
      )}
    >
      {actions && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          {actions}
        </div>
      )}

      {title && <h3 className="mb-3 pr-8 text-sm font-medium">{title}</h3>}

      {entry.type === "passage" ? (
        <QuoteBlock
          className={cn(actions && "pr-8")}
          attribution={quoteSpeakerForEntry(entry) ? `- ${quoteSpeakerForEntry(entry)}` : null}
        >
          <FormattedNoteContent markdown={contentForEntry(entry)} className="line-clamp-4 text-sm leading-6" />
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

      {hasLinkedEntries && (
        <span className="absolute bottom-3 right-3 z-10 text-xs text-muted-foreground">
          {linkedEntryCountLabel(linkedEntryCount)}
        </span>
      )}
    </article>
  );
}
