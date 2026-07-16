import { Bookmark } from "lucide-react";
import FormattedNoteContent from "@/components/FormattedNoteContent";
import QuoteBlock from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { getJournalEntryTags, type JournalTimelineEntry } from "@/lib/journal";
import { normalizeJournalTags } from "@/lib/journalTags";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface JournalEntryCardProps {
  entry: JournalTimelineEntry;
  busy?: boolean;
  onToggleSaved?: (entry: JournalTimelineEntry) => void;
}

function titleForEntry(entry: JournalTimelineEntry): ReactNode {
  if (entry.source === "generated_book_event") return entry.label;
  const tags = normalizeJournalTags(getJournalEntryTags(entry));
  if (entry.source === "book_note" && tags.some((tag) => tag.toLocaleLowerCase() === "review") && entry.relatedBookTitle) {
    return (
      <>
        Review of <span className="font-serif italic">{entry.relatedBookTitle}</span>
      </>
    );
  }
  if (entry.source === "book_note") return entry.bookNote.label === "quote" ? "" : entry.bookNote.title || "";
  if (entry.source === "series_note") return entry.seriesNote.label === "quote" ? "" : entry.seriesNote.title || "";
  return entry.authorNote.label === "quote" ? "" : entry.authorNote.title || "";
}

function contentForEntry(entry: JournalTimelineEntry): string {
  if (entry.source === "generated_book_event") return entry.description ?? "";
  if (entry.source === "book_note") return entry.bookNote.content;
  if (entry.source === "series_note") return entry.seriesNote.content;
  return entry.authorNote.content;
}

function quoteSpeakerForEntry(entry: JournalTimelineEntry): string | null {
  if (entry.source === "book_note") return entry.bookNote.quote_speaker ?? null;
  if (entry.source === "series_note") return entry.seriesNote.quote_speaker ?? null;
  if (entry.source === "author_note") return entry.authorNote.quote_speaker ?? null;
  return null;
}

function isSaved(entry: JournalTimelineEntry): boolean {
  if (entry.source === "book_note") return entry.bookNote.is_favorite;
  if (entry.source === "series_note") return entry.seriesNote.is_favorite;
  if (entry.source === "author_note") return entry.authorNote.is_favorite;
  return false;
}

function isManual(entry: JournalTimelineEntry): boolean {
  return entry.source === "book_note" || entry.source === "series_note" || entry.source === "author_note";
}

export default function JournalEntryCard({ entry, busy = false, onToggleSaved }: JournalEntryCardProps) {
  const tags = normalizeJournalTags(getJournalEntryTags(entry));
  const title = titleForEntry(entry);
  const saved = isSaved(entry);

  return (
    <article className="relative h-full rounded-lg border bg-background p-4">
      {isManual(entry) && onToggleSaved && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-3 top-3 z-10 h-7 w-7 text-muted-foreground hover:text-primary"
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
    </article>
  );
}
