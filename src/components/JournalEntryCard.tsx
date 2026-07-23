import FormattedNoteContent from "@/components/FormattedNoteContent";
import { JournalMediaFigure } from "@/components/JournalEntryMediaContent";
import QuoteBlock from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { getJournalEntryTags, type JournalTimelineEntry } from "@/lib/journal";
import { visibleJournalTags } from "@/lib/journalTags";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface JournalEntryCardProps {
  entry: JournalTimelineEntry;
  actions?: ReactNode;
  showTags?: boolean;
}

function titleForEntry(entry: JournalTimelineEntry): ReactNode {
  if (entry.source === "generated_book_event") return entry.label;
  const isReviewEntry =
    entry.source === "book_note" &&
    (entry.bookJournalEntry.label === "review" ||
      getJournalEntryTags(entry).some((tag) => tag.toLocaleLowerCase() === "review"));
  if (entry.source === "book_note" && isReviewEntry && entry.relatedBookTitle) {
    return (
      <>
        Review of <span className="font-serif italic">{entry.relatedBookTitle}</span>
      </>
    );
  }
  return "";
}

function contentForEntry(entry: JournalTimelineEntry): string {
  if (entry.source === "generated_book_event") return entry.description ?? "";
  if (entry.source === "book_note") return entry.bookJournalEntry.content;
  if (entry.source === "series_note") return entry.seriesJournalEntry.content;
  return entry.authorJournalEntry.content;
}

function attributionForEntry(entry: JournalTimelineEntry): string | null {
  if (entry.source === "book_note") return entry.bookJournalEntry.attribution ?? null;
  if (entry.source === "series_note") return entry.seriesJournalEntry.attribution ?? null;
  if (entry.source === "author_note") return entry.authorJournalEntry.attribution ?? null;
  return null;
}

function mediaForEntry(entry: JournalTimelineEntry) {
  if (entry.source === "book_note") return entry.bookJournalEntry.media ?? [];
  if (entry.source === "series_note") return entry.seriesJournalEntry.media ?? [];
  if (entry.source === "author_note") return entry.authorJournalEntry.media ?? [];
  return [];
}

export default function JournalEntryCard({ entry, actions, showTags = true }: JournalEntryCardProps) {
  const tags = visibleJournalTags(getJournalEntryTags(entry));
  const title = titleForEntry(entry);
  const media = mediaForEntry(entry);

  return (
    <article
      className={cn(
        "relative h-full rounded-lg border bg-background p-4",
        actions ? "pr-24" : "pr-4",
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
          attribution={attributionForEntry(entry) ? `- ${attributionForEntry(entry)}` : null}
        >
          <FormattedNoteContent markdown={contentForEntry(entry)} className="line-clamp-4 text-sm leading-6" />
        </QuoteBlock>
      ) : (
        <FormattedNoteContent markdown={contentForEntry(entry)} className="line-clamp-4 text-sm leading-6" />
      )}

      {media.length > 0 && (
        <JournalMediaFigure
          item={media[0]}
          thumbnail
          className="mb-0 mt-3"
          imageClassName="h-24 rounded object-cover"
          captionClassName="line-clamp-1"
        />
      )}

      {showTags && tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[0.7rem]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

    </article>
  );
}
