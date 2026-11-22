import JournalEntryMediaContent from "@/components/JournalEntryMediaContent";
import QuoteBlock, { ClosingQuoteMark } from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { getJournalEntryTags, type JournalTimelineEntry } from "@/lib/journal";
import { visibleJournalTags } from "@/lib/journalTags";
import { renderNoteMarkdownToHtml } from "@/lib/noteFormatting";
import { cn } from "@/lib/utils";
import { useMemo, type ReactNode } from "react";

interface JournalEntryCardProps {
  entry: JournalTimelineEntry;
  date: string;
  onRead: (trigger: HTMLButtonElement) => void;
  actions?: ReactNode;
  showTags?: boolean;
}

export function formatJournalDate(value: string): string {
  const dateValue = value.includes("T") ? value : `${value}T00:00:00`;
  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function JournalEntryDate({ date }: { date: string }) {
  return <time dateTime={date} className="mb-2 block text-xs text-muted-foreground">{formatJournalDate(date)}</time>;
}

export function JournalEntryExcerpt({ markdown, quote = false }: { markdown: string; quote?: boolean }) {
  const text = useMemo(() => {
    const template = document.createElement("template");
    const html = renderNoteMarkdownToHtml(markdown);
    template.innerHTML = html.replace(/<br\s*\/?>|<\/(?:p|li|h[1-6]|pre|blockquote)>/gi, "$&\n");
    return template.content.textContent?.replace(/[^\S\n]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
  }, [markdown]);

  if (!text) return null;
  return (
    <p className="line-clamp-3 whitespace-pre-line break-words text-[13px] leading-5">
      {text}{quote && <ClosingQuoteMark />}
    </p>
  );
}

export function JournalEntryReadButton({ date, onRead }: {
  date: string;
  onRead: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Read journal entry, ${formatJournalDate(date)}`}
      aria-haspopup="dialog"
      className="absolute inset-0 z-[1] cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-ring"
      onClick={(event) => onRead(event.currentTarget)}
    />
  );
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

export default function JournalEntryCard({ entry, date, onRead, actions, showTags = true }: JournalEntryCardProps) {
  const tags = visibleJournalTags(getJournalEntryTags(entry));
  const title = titleForEntry(entry);
  const media = mediaForEntry(entry);

  return (
    <article
      className={cn(
        "relative h-full rounded-lg bg-card p-4",
        actions ? "pr-24" : "pr-4",
      )}
    >
      <JournalEntryReadButton date={date} onRead={onRead} />
      {actions && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          {actions}
        </div>
      )}

      <JournalEntryDate date={date} />
      {title && <h3 className="mb-3 pr-8 text-sm font-medium">{title}</h3>}

      {entry.type === "passage" ? (
        <QuoteBlock
          className={cn(actions && "pr-8")}
          attribution={attributionForEntry(entry) ? `- ${attributionForEntry(entry)}` : null}
        >
          <JournalEntryExcerpt markdown={contentForEntry(entry)} quote />
        </QuoteBlock>
      ) : (
        <JournalEntryExcerpt markdown={contentForEntry(entry)} />
      )}

      {media.length > 0 && (
        <JournalEntryMediaContent
          markdown=""
          media={media}
          thumbnail
          interactiveMedia={false}
          visibleMediaLimit={1}
          mediaClassName="mb-0 mt-3"
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
