import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  CornerDownRight,
  Eye,
  EyeOff,
  Flag,
  Link as LinkIcon,
  MessageSquareText,
  Pencil,
  Quote,
  Reply,
  Star,
  StickyNote,
  TrendingUp,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { JournalEntryForm } from "@/components/AddJournalEntryDialog";
import FormattedNoteContent from "@/components/FormattedNoteContent";
import JournalEntryCard from "@/components/JournalEntryCard";
import QuoteBlock from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import {
  deleteAuthorJournalEntryRecord,
  getAuthorJournalReplies,
  getRelatedAuthorJournalEntries,
  linkAuthorJournalEntries,
  updateAuthorJournalEntryRecord,
} from "@/lib/authorJournal";
import {
  deleteBookJournalEntryRecord,
  getBookJournalReplies,
  getRelatedBookJournalEntries,
  linkBookJournalEntries,
  updateBookJournalEntryRecord,
} from "@/lib/bookJournal";
import {
  GENERATED_EVENT_NOTE_TAG_PREFIX,
  READING_LOG_NOTE_TAG_PREFIX,
  normalizeJournalTags,
  visibleJournalTags,
} from "@/lib/journalTags";
import {
  fetchHiddenJournalEntries,
  getHiddenJournalEntryKeys,
  getJournalVisibilityKey,
  hideJournalEntry,
  restoreJournalEntry,
} from "@/lib/journalVisibility";
import {
  authorJournalEntryToJournalEntry,
  bookJournalEntryToJournalEntry,
  getJournalEntryTags,
  isThoughtJournalEntry,
  seriesJournalEntryToJournalEntry,
  sortJournalEntries,
  type AuthorJournalEntryRecordJournalEntry,
  type BookJournalEntryRecordJournalEntry,
  type GeneratedBookJournalEntry,
  type JournalTimelineEntry,
  type SeriesJournalEntryRecordJournalEntry,
} from "@/lib/journal";
import {
  deleteSeriesJournalEntryRecord,
  getSeriesJournalReplies,
  getRelatedSeriesJournalEntries,
  linkSeriesJournalEntries,
  updateSeriesJournalEntryRecord,
} from "@/lib/seriesJournal";
import { cn } from "@/lib/utils";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord, SeriesJournalEntryRecord } from "@/types";
import { useEffect, useMemo, useState, type ReactNode } from "react";

interface JournalTimelineProps {
  entries: JournalTimelineEntry[];
  generatedReferenceEntries?: GeneratedBookJournalEntry[];
  emptyMessage?: string;
  className?: string;
  layout?: "timeline" | "cards";
  sortMode?: "entry-date" | "date-added" | "book-progress";
  onEntryUpdated?: (entry: JournalTimelineEntry) => void;
  onEntryEdit?: (entry: JournalTimelineEntry) => void;
  onEntryCreated?: (entry: JournalTimelineEntry) => void;
  onEntryDeleted?: (entry: JournalTimelineEntry) => void;
}

type ManualJournalTimelineEntry = BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry;
type GeneratedSession = NonNullable<NonNullable<GeneratedBookJournalEntry["metadata"]>["sessions"]>[number];
type GeneratedNoteTarget = {
  entry: GeneratedBookJournalEntry;
  session?: GeneratedSession;
};
type PendingDeleteTarget =
  | { type: "entry"; entry: ManualJournalTimelineEntry }
  | { type: "note"; entry: ManualJournalTimelineEntry };

function formatJournalDate(value: string): string {
  const dateValue = value.includes("T") ? value : `${value}T00:00:00`;

  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatJournalTime(value: string): string {
  const dateValue = value.includes("T") ? value : `${value}T00:00:00`;

  return new Date(dateValue).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimelineDateParts(value: string): { day: string; month: string; year: string } {
  const dateValue = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(dateValue);
  return {
    day: date.toLocaleDateString(undefined, { day: "2-digit" }),
    month: date.toLocaleDateString(undefined, { month: "short" }).toLocaleUpperCase(),
    year: date.toLocaleDateString(undefined, { year: "numeric" }),
  };
}

function isBookJournalEntryRecordEntry(entry: JournalTimelineEntry): entry is BookJournalEntryRecordJournalEntry {
  return entry.source === "book_note";
}

function isSeriesJournalEntryRecordEntry(entry: JournalTimelineEntry): entry is SeriesJournalEntryRecordJournalEntry {
  return entry.source === "series_note";
}

function isAuthorJournalEntryRecordEntry(entry: JournalTimelineEntry): entry is AuthorJournalEntryRecordJournalEntry {
  return entry.source === "author_note";
}

function isGeneratedBookEntry(entry: JournalTimelineEntry): entry is GeneratedBookJournalEntry {
  return entry.source === "generated_book_event";
}

function getManualNote(
  entry: BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry,
): BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord {
  if (isBookJournalEntryRecordEntry(entry)) return entry.bookJournalEntry;
  if (isSeriesJournalEntryRecordEntry(entry)) return entry.seriesJournalEntry;
  return entry.authorJournalEntry;
}

function isManualEntry(
  entry: JournalTimelineEntry,
): entry is ManualJournalTimelineEntry {
  return isBookJournalEntryRecordEntry(entry) || isSeriesJournalEntryRecordEntry(entry) || isAuthorJournalEntryRecordEntry(entry);
}

function isReplyEntry(entry: JournalTimelineEntry): boolean {
  return isManualEntry(entry) && Boolean(getManualNote(entry).parent_entry_id);
}

function isGeneratedAttachableEntry(entry: JournalTimelineEntry): entry is GeneratedBookJournalEntry {
  return isGeneratedBookEntry(entry) && entry.entityType === "Book";
}

function canLinkEntry(entry: JournalTimelineEntry): entry is ManualJournalTimelineEntry {
  return isManualEntry(entry);
}

function getGeneratedEventNoteTag(entry: GeneratedBookJournalEntry): string {
  return `${GENERATED_EVENT_NOTE_TAG_PREFIX}${entry.sourceId}`;
}

function getReadingLogNoteTag(sessionId: string): string {
  return `${READING_LOG_NOTE_TAG_PREFIX}${sessionId}`;
}

function getReadingLogSessionIdFromTag(tag: string): string | null {
  return tag.startsWith(READING_LOG_NOTE_TAG_PREFIX)
    ? tag.slice(READING_LOG_NOTE_TAG_PREFIX.length)
    : null;
}

function getGeneratedTargetTags(target: GeneratedNoteTarget): string[] {
  if (target.session) return [getReadingLogNoteTag(target.session.id)];
  return [getGeneratedEventNoteTag(target.entry)];
}

function getAttachedGeneratedNoteTags(entry: ManualJournalTimelineEntry): string[] {
  return normalizeJournalTags(getManualNote(entry).tags).filter(
    (tag) => tag.startsWith(GENERATED_EVENT_NOTE_TAG_PREFIX) || tag.startsWith(READING_LOG_NOTE_TAG_PREFIX),
  );
}

function isAttachedGeneratedNote(entry: JournalTimelineEntry): entry is ManualJournalTimelineEntry {
  return isManualEntry(entry) && getAttachedGeneratedNoteTags(entry).length > 0;
}

function sameManualLinkTable(left: ManualJournalTimelineEntry, right: ManualJournalTimelineEntry): boolean {
  return left.source === right.source;
}

function getGeneratedEntryNoteTags(entry: GeneratedBookJournalEntry): string[] {
  const sessions = entry.metadata?.sessions ?? [];
  if (entry.type === "reading_session" && sessions.length > 0) {
    return sessions.map((session) => getReadingLogNoteTag(session.id));
  }
  return [getGeneratedEventNoteTag(entry)];
}

function formatManualPage(note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord): string | null {
  return note.page_start ? `p. ${note.page_start}` : null;
}

function TimelineTags({ tags }: { tags: string[] }) {
  const visibleTags = visibleJournalTags(tags);
  if (visibleTags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {visibleTags.map((tag) => (
        <Badge key={tag} variant="outline" className="text-[0.7rem]">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function hasReviewTag(entry: JournalTimelineEntry): boolean {
  return normalizeJournalTags(getJournalEntryTags(entry)).some((tag) => tag.toLocaleLowerCase() === "review");
}

function reviewBookTitle(entry: JournalTimelineEntry): string | null {
  return isBookJournalEntryRecordEntry(entry) ? entry.relatedBookTitle ?? null : null;
}

function isRelatedBookEntry(entry: JournalTimelineEntry): boolean {
  return isBookJournalEntryRecordEntry(entry) && Boolean(entry.relatedContext);
}

function isEntityOwnedEntry(entry: JournalTimelineEntry): boolean {
  return isSeriesJournalEntryRecordEntry(entry) || isAuthorJournalEntryRecordEntry(entry);
}

function displayEntryTitle(entry: JournalTimelineEntry): ReactNode | null {
  const title = reviewBookTitle(entry);
  if (hasReviewTag(entry) && title) {
    return (
      <>
        Review of <span className="font-serif italic">{title}</span>
      </>
    );
  }

  if (isBookJournalEntryRecordEntry(entry)) return entry.bookJournalEntry.title || null;
  if (isSeriesJournalEntryRecordEntry(entry)) return entry.seriesJournalEntry.title || null;
  if (isAuthorJournalEntryRecordEntry(entry)) return entry.authorJournalEntry.title || null;
  return null;
}

function isSavedEntry(entry: JournalTimelineEntry): boolean {
  return isManualEntry(entry) ? Boolean(getManualNote(entry).is_favorite) : false;
}

function isCompactManualEntry(entry: ManualJournalTimelineEntry): boolean {
  const note = getManualNote(entry);
  const title = typeof note.title === "string" ? note.title.trim() : "";
  const content = note.content
    .replace(/[#>*_\-[\]()`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const explicitLineCount = note.content.split(/\r?\n/).filter((line) => line.trim()).length;
  const estimatedLineCount = Math.max(explicitLineCount, Math.ceil((title.length + content.length) / 72));

  return estimatedLineCount <= 3;
}

function TimelineTopActions({
  entry,
  busy,
  onToggleSaved,
  onLink,
  showLink,
}: {
  entry: ManualJournalTimelineEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  showLink: boolean;
}) {
  const saved = isSavedEntry(entry);

  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
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
      {showLink && (
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
            onLink(entry);
          }}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function TimelineBottomActions({
  entry,
  onReply,
  onLink,
  showLink = false,
  allowReply = true,
}: {
  entry: JournalTimelineEntry;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink?: (entry: ManualJournalTimelineEntry) => void;
  showLink?: boolean;
  allowReply?: boolean;
}) {
  const showReply = allowReply && (
    isGeneratedAttachableEntry(entry) ||
    (isManualEntry(entry) && !isReplyEntry(entry) && !isAttachedGeneratedNote(entry))
  );

  if (!showReply && !showLink) return null;

  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1">
      {showLink && isManualEntry(entry) && onLink && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          aria-label="Link entry"
          title="Link entry"
          onClick={(event) => {
            event.stopPropagation();
            onLink(entry);
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
          onClick={(event) => {
            event.stopPropagation();
            onReply(entry);
          }}
        >
          <Reply className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function TimelineDateLabel({ entry }: { entry: JournalTimelineEntry }) {
  const { day, month, year } = formatTimelineDateParts(entryDate(entry));
  return (
    <div className="pt-1 text-center leading-tight">
      <p className="text-sm font-semibold tracking-wide text-foreground">{day}. {month}</p>
      <p className="text-sm tracking-[0.18em] text-muted-foreground">{year}</p>
    </div>
  );
}

function HiddenEntryRestoreButton({
  entry,
  busy,
  onRestore,
}: {
  entry: JournalTimelineEntry;
  busy: boolean;
  onRestore: (entry: JournalTimelineEntry) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Show entry"
      className="absolute right-2 top-2 z-10 bg-background/80"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        onRestore(entry);
      }}
    >
      <EyeOff className="h-4 w-4" />
    </Button>
  );
}

function JournalNoteEntry({
  entry,
  busy,
  onToggleSaved,
  onReply,
  onLink,
  allowReply,
  hideSaveButton = false,
}: {
  entry: BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  allowReply: boolean;
  hideSaveButton?: boolean;
}) {
  const note = getManualNote(entry);
  const linkWithSave = isCompactManualEntry(entry);

  return (
    <article className="relative pl-8">
      <div className={cn(
        "absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background",
        isRelatedBookEntry(entry) ? "text-muted-foreground" : "text-note",
      )}>
        <StickyNote className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className={cn(
        "relative rounded-lg border bg-background p-4 dark:bg-card",
        linkWithSave ? "pr-20" : "pr-12",
        isEntityOwnedEntry(entry) && "border-note/40",
        isRelatedBookEntry(entry) && "bg-muted/20 opacity-90",
      )}>
        {!hideSaveButton && <TimelineTopActions entry={entry} busy={busy} onToggleSaved={onToggleSaved} onLink={onLink} showLink={linkWithSave} />}
        {displayEntryTitle(entry) && (
          <h3 className="mb-2 text-sm font-heading leading-snug font-medium">{displayEntryTitle(entry)}</h3>
        )}
        <FormattedNoteContent markdown={note.content} className="text-sm leading-6 text-foreground" />
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
        <TimelineBottomActions entry={entry} onReply={onReply} onLink={onLink} showLink={!linkWithSave} allowReply={allowReply} />
      </div>
    </article>
  );
}

function JournalPassageEntry({
  entry,
  busy,
  onToggleSaved,
  onReply,
  onLink,
  allowReply,
  hideSaveButton = false,
}: {
  entry: BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  allowReply: boolean;
  hideSaveButton?: boolean;
}) {
  const note = getManualNote(entry);
  const linkWithSave = isCompactManualEntry(entry);

  return (
    <article className="relative pl-8">
      <div className={cn(
        "absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background",
        isRelatedBookEntry(entry)
          ? "border-muted-foreground/30 text-muted-foreground"
          : "border-note/30 text-note",
      )}>
        <Quote className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className={cn(
        "relative rounded-lg border border-note/40 bg-background p-4 dark:bg-card",
        linkWithSave ? "pr-20" : "pr-12",
        isRelatedBookEntry(entry) && "border-border bg-muted/20 opacity-90",
      )}>
        {!hideSaveButton && <TimelineTopActions entry={entry} busy={busy} onToggleSaved={onToggleSaved} onLink={onLink} showLink={linkWithSave} />}
        <QuoteBlock
          attribution={
            note.quote_speaker ? (
              <span className="font-serif italic">- {note.quote_speaker}</span>
            ) : null
          }
        >
          <FormattedNoteContent markdown={note.content} className="text-base leading-7 text-foreground [&_em]:not-italic" />
        </QuoteBlock>
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
        <TimelineBottomActions entry={entry} onReply={onReply} onLink={onLink} showLink={!linkWithSave} allowReply={allowReply} />
      </div>
    </article>
  );
}

function JournalReviewEntry({
  entry,
  busy,
  onToggleSaved,
  onReply,
  onLink,
  allowReply,
  hideSaveButton = false,
}: {
  entry: BookJournalEntryRecordJournalEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  allowReply: boolean;
  hideSaveButton?: boolean;
}) {
  const note = entry.bookJournalEntry;
  const linkWithSave = isCompactManualEntry(entry);

  return (
    <article className="relative pl-8">
      <div className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-insight">
        <MessageSquareText className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className={cn(
        "relative rounded-lg border bg-background p-4 dark:bg-card",
        linkWithSave ? "pr-20" : "pr-12",
        isRelatedBookEntry(entry) && "bg-muted/20 opacity-90",
      )}>
        {!hideSaveButton && <TimelineTopActions entry={entry} busy={busy} onToggleSaved={onToggleSaved} onLink={onLink} showLink={linkWithSave} />}
        {displayEntryTitle(entry) && (
          <h3 className="mb-2 text-sm font-heading leading-snug font-medium">{displayEntryTitle(entry)}</h3>
        )}
        <FormattedNoteContent markdown={note.content} className="text-sm leading-6 text-foreground" />
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
        <TimelineBottomActions entry={entry} onReply={onReply} onLink={onLink} showLink={!linkWithSave} allowReply={allowReply} />
      </div>
    </article>
  );
}

function getAutomaticEventIcon(entry: GeneratedBookJournalEntry): LucideIcon {
  if (entry.type === "started_reading") return Flag;
  if (entry.type === "finished_reading") return CheckCircle2;
  if (entry.type === "rating_added") return Star;
  if (entry.type === "reading_progress_milestone") return TrendingUp;
  return Clock;
}

function getTimelineMarkerIcon(entry: JournalTimelineEntry): LucideIcon {
  if (isReplyEntry(entry)) return Reply;
  if (isGeneratedBookEntry(entry)) return getAutomaticEventIcon(entry);
  if (entry.type === "passage") return Quote;
  if (entry.type === "review") return MessageSquareText;
  return StickyNote;
}

function getTimelineMarkerClassName(entry: JournalTimelineEntry): string {
  if (isReplyEntry(entry)) return "border-muted-foreground/30 bg-background text-muted-foreground";
  if (isGeneratedBookEntry(entry)) return "border-muted-foreground/30 bg-muted text-muted-foreground";
  if (isRelatedBookEntry(entry)) return "border-muted-foreground/30 bg-background text-muted-foreground";
  if (entry.type === "review") return "bg-background text-insight";
  return "border-note/30 bg-background text-note";
}

function formatAutomaticEventDetails(entry: GeneratedBookJournalEntry): string | null {
  const details: string[] = [];
  const { metadata } = entry;

  if (entry.description) details.push(entry.description);
  if (typeof metadata?.progressPercent === "number") details.push(`${metadata.progressPercent}%`);
  if (typeof metadata?.currentPage === "number") {
    details.push(
      metadata.totalPages
        ? `page ${metadata.currentPage} of ${metadata.totalPages}`
        : `page ${metadata.currentPage}`,
    );
  }

  return details.length > 0 ? details.join(" · ") : null;
}

function RatingStars({ rating }: { rating: number }) {
  const normalizedRating = Math.min(5, Math.max(0, Math.round(rating)));

  return (
    <div className="flex items-center gap-1" aria-label={`${normalizedRating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "h-4 w-4",
            index < normalizedRating
              ? "fill-favorite text-favorite"
              : "fill-transparent text-muted-foreground/40",
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function groupGeneratedSessionsByDay(
  sessions: NonNullable<GeneratedBookJournalEntry["metadata"]>["sessions"] = [],
) {
  type GeneratedSession = NonNullable<NonNullable<GeneratedBookJournalEntry["metadata"]>["sessions"]>[number];
  const groups = new Map<string, GeneratedSession[]>();
  sessions.forEach((session) => {
    const dateKey = session.loggedAt.slice(0, 10);
    groups.set(dateKey, [...(groups.get(dateKey) ?? []), session]);
  });
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function countSessionDays(sessions: GeneratedSession[]): number {
  return new Set(sessions.map((session) => session.loggedAt.slice(0, 10))).size;
}

function formatReadingSessionDescription(sessionCount: number, dayCount: number, readingMinutes: number): string {
  const base = `${sessionCount} ${sessionCount === 1 ? "session" : "sessions"} over ${dayCount} ${dayCount === 1 ? "day" : "days"}`;
  return readingMinutes > 0 ? `${base} · ${readingMinutes} min total` : base;
}

function formatGeneratedSessionTime(entry: GeneratedBookJournalEntry): string | null {
  if (entry.type !== "reading_session") return null;
  const sessions = [...(entry.metadata?.sessions ?? [])].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

  if (sessions.length === 0) return formatJournalTime(entry.createdAt);
  if (sessions.length === 1) return formatJournalTime(sessions[0].loggedAt);

  const firstSession = sessions[0];
  const finalSession = sessions[sessions.length - 1];
  const firstTime = formatJournalTime(firstSession.loggedAt);
  const finalTime = formatJournalTime(finalSession.loggedAt);

  return firstTime === finalTime ? firstTime : `${firstTime} - ${finalTime}`;
}

function createGeneratedSessionEntryFromSessions(
  sourceEntry: GeneratedBookJournalEntry,
  sessions: GeneratedSession[],
): GeneratedBookJournalEntry {
  const sortedSessions = [...sessions].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  const finalSession = sortedSessions[sortedSessions.length - 1];
  const sessionCount = sortedSessions.length;
  const readingMinutes = sortedSessions.reduce((total, session) => total + Math.max(0, session.readingMinutes ?? 0), 0);
  const isSingleSession = sessionCount === 1;
  const dateKeys = sortedSessions.map((session) => session.loggedAt.slice(0, 10));

  return {
    ...sourceEntry,
    id: isSingleSession
      ? `generated:book:${sourceEntry.entityId}:reading-session:${finalSession.id}`
      : `${sourceEntry.id}:split:${dateKeys[0]}:${dateKeys[dateKeys.length - 1]}`,
    sourceId: isSingleSession
      ? `reading_log:${finalSession.id}`
      : `${sourceEntry.sourceId}:split:${dateKeys[0]}:${dateKeys[dateKeys.length - 1]}`,
    createdAt: finalSession.loggedAt,
    label: isSingleSession ? "Reading session" : "Reading sessions",
    description: formatReadingSessionDescription(sessionCount, countSessionDays(sortedSessions), readingMinutes),
    metadata: {
      ...sourceEntry.metadata,
      currentPage: finalSession.currentPage,
      readingMinutes,
      sessionCount,
      sessions: sortedSessions,
    },
  };
}

function splitGeneratedReadingSessionEntry(
  entry: GeneratedBookJournalEntry,
  uncompressedReadingLogIds: Set<string>,
): GeneratedBookJournalEntry[] {
  const sessions = entry.metadata?.sessions ?? [];
  if (entry.type !== "reading_session" || sessions.length <= 1 || !sessions.some((session) => uncompressedReadingLogIds.has(session.id))) {
    return [entry];
  }

  const chunks: GeneratedSession[][] = [];
  sessions
    .slice()
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
    .forEach((session) => {
      if (uncompressedReadingLogIds.has(session.id)) {
        chunks.push([session]);
        return;
      }

      const previousChunk = chunks[chunks.length - 1];
      const previousSession = previousChunk?.[previousChunk.length - 1];
      if (!previousChunk || (previousSession && uncompressedReadingLogIds.has(previousSession.id))) {
        chunks.push([session]);
        return;
      }

      previousChunk.push(session);
    });

  return chunks.map((chunk) => createGeneratedSessionEntryFromSessions(entry, chunk));
}

function GeneratedBookEventEntry({
  entry,
  onReply,
  allowReply = true,
}: {
  entry: GeneratedBookJournalEntry;
  onReply: (entry: JournalTimelineEntry) => void;
  allowReply?: boolean;
}) {
  const Icon = getAutomaticEventIcon(entry);
  const details = formatAutomaticEventDetails(entry);
  const rating = entry.type === "rating_added" ? entry.metadata?.rating : undefined;

  return (
    <article className="relative pl-8">
      <div className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/30 bg-muted text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className="relative rounded-lg border border-dashed bg-muted/25 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-sm font-heading leading-snug font-medium">{entry.label}</h3>
            {typeof rating === "number" && <RatingStars rating={rating} />}
            {details && <p className="text-sm text-muted-foreground">{details}</p>}
          </div>
        </div>
        <TimelineBottomActions entry={entry} onReply={onReply} allowReply={allowReply} />
      </div>
    </article>
  );
}

function JournalTimelineItem({
  entry,
  busy,
  onToggleSaved,
  onReply,
  onLink,
  hideSaveButton = false,
  allowReply = true,
}: {
  entry: JournalTimelineEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  hideSaveButton?: boolean;
  allowReply?: boolean;
}) {
  if (isGeneratedBookEntry(entry)) return <GeneratedBookEventEntry entry={entry} onReply={onReply} allowReply={allowReply} />;
  if (entry.type === "passage" && (isBookJournalEntryRecordEntry(entry) || isSeriesJournalEntryRecordEntry(entry) || isAuthorJournalEntryRecordEntry(entry))) {
    return <JournalPassageEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} allowReply={allowReply} hideSaveButton={hideSaveButton} />;
  }
  if (isSeriesJournalEntryRecordEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} allowReply={allowReply} hideSaveButton={hideSaveButton} />;
  if (isAuthorJournalEntryRecordEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} allowReply={allowReply} hideSaveButton={hideSaveButton} />;
  if (!isBookJournalEntryRecordEntry(entry)) return null;
  if (entry.type === "review") return <JournalReviewEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} allowReply={allowReply} hideSaveButton={hideSaveButton} />;
  if (isThoughtJournalEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} allowReply={allowReply} hideSaveButton={hideSaveButton} />;
  return null;
}

function TimelineRow({
  entry,
  index,
  total,
  busy,
  onOpen,
  onToggleSaved,
  onReply,
  onLink,
  parentContextLabel,
  restoreButton,
  hideSaveButton = false,
  showConnector = true,
}: {
  entry: JournalTimelineEntry;
  index: number;
  total: number;
  busy: boolean;
  onOpen: (entry: JournalTimelineEntry) => void;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  parentContextLabel?: string | null;
  restoreButton?: ReactNode;
  hideSaveButton?: boolean;
  showConnector?: boolean;
}) {
  const MarkerIcon = getTimelineMarkerIcon(entry);

  return (
    <div
      role="button"
      tabIndex={0}
      className="grid cursor-pointer grid-cols-[1.5rem_5.5rem_minmax(0,1fr)] gap-3"
      onClick={() => onOpen(entry)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(entry);
        }
      }}
    >
      <div
        className={cn(
          "relative flex justify-center pt-1",
          showConnector && index < total - 1 &&
            "before:absolute before:left-1/2 before:top-6 before:-bottom-4 before:w-px before:-translate-x-1/2 before:bg-border",
        )}
      >
        <span className={cn(
          "relative z-10 flex h-5 w-5 items-center justify-center rounded-full border",
          getTimelineMarkerClassName(entry),
        )}>
          <MarkerIcon className="h-3 w-3" aria-hidden="true" />
        </span>
      </div>
      <TimelineDateLabel entry={entry} />
      <div className="relative [&>article]:pl-0 [&>article>div:first-child]:hidden">
        {restoreButton}
        {parentContextLabel && (
          <p className="mb-2 text-xs text-muted-foreground">with {parentContextLabel}</p>
        )}
        <JournalTimelineItem
          entry={entry}
          busy={busy}
          onToggleSaved={onToggleSaved}
          onReply={onReply}
          onLink={onLink}
          hideSaveButton={hideSaveButton}
        />
      </div>
    </div>
  );
}

function TimelineReplyRow({
  entry,
  parentEntry,
  busy,
  onToggleSaved,
  onLink,
  onOpenParent,
}: {
  entry: ManualJournalTimelineEntry;
  parentEntry: JournalTimelineEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onOpenParent: (entry: JournalTimelineEntry) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="grid cursor-pointer grid-cols-[1.5rem_5.5rem_minmax(0,1fr)] gap-3"
      onClick={() => onOpenParent(parentEntry)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenParent(parentEntry);
        }
      }}
    >
      <div aria-hidden="true" />
      <div aria-hidden="true" />
      <div className="relative pl-10 [&>article]:pl-0 [&>article>div:first-child]:hidden">
        <CornerDownRight className="absolute left-0 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <JournalTimelineItem
          entry={entry}
          busy={busy}
          onToggleSaved={onToggleSaved}
          onReply={() => undefined}
          onLink={onLink}
          allowReply={false}
        />
      </div>
    </div>
  );
}

function replaceManualEntryRecord(
  entry: JournalTimelineEntry,
  note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord,
): JournalTimelineEntry {
  if (isBookJournalEntryRecordEntry(entry) && "book_id" in note) {
    return {
      ...entry,
      type: note.label === "quote" ? "passage" : "thought",
      createdAt: note.entry_date ?? note.created_at,
      updatedAt: note.updated_at,
      bookJournalEntry: note,
    };
  }

  if (isSeriesJournalEntryRecordEntry(entry) && "series_id" in note) {
    return {
      ...entry,
      type: note.label === "quote" ? "passage" : "thought",
      createdAt: note.entry_date ?? note.created_at,
      updatedAt: note.updated_at,
      seriesJournalEntry: note,
    };
  }

  if (isAuthorJournalEntryRecordEntry(entry) && "author_id" in note) {
    return {
      ...entry,
      type: note.label === "quote" ? "passage" : "thought",
      createdAt: note.entry_date ?? note.created_at,
      updatedAt: note.updated_at,
      authorJournalEntry: note,
    };
  }

  return entry;
}

function entryTitle(entry: JournalTimelineEntry): string {
  if (isGeneratedBookEntry(entry)) return entry.label;
  if (isBookJournalEntryRecordEntry(entry)) {
    if (entry.bookJournalEntry.label === "quote") return "Quote";
    return entry.bookJournalEntry.title || "Thought";
  }
  if (isSeriesJournalEntryRecordEntry(entry)) return entry.seriesJournalEntry.title || "Thought";
  if (isAuthorJournalEntryRecordEntry(entry)) return entry.authorJournalEntry.title || "Thought";
  return "Journal entry";
}

function entryDate(entry: JournalTimelineEntry): string {
  if (isBookJournalEntryRecordEntry(entry)) return entry.bookJournalEntry.entry_date;
  if (isSeriesJournalEntryRecordEntry(entry)) return entry.seriesJournalEntry.entry_date;
  if (isAuthorJournalEntryRecordEntry(entry)) return entry.authorJournalEntry.entry_date;
  return entry.createdAt;
}

function entryPage(entry: JournalTimelineEntry): string | null {
  if (isBookJournalEntryRecordEntry(entry)) return formatManualPage(entry.bookJournalEntry);
  if (isSeriesJournalEntryRecordEntry(entry)) return formatManualPage(entry.seriesJournalEntry);
  if (isAuthorJournalEntryRecordEntry(entry)) return formatManualPage(entry.authorJournalEntry);
  if (isGeneratedBookEntry(entry) && typeof entry.metadata?.currentPage === "number") {
    return entry.metadata.totalPages
      ? `page ${entry.metadata.currentPage} of ${entry.metadata.totalPages}`
      : `page ${entry.metadata.currentPage}`;
  }
  return null;
}

function JournalPanelEntryContent({ entry, actions }: { entry: JournalTimelineEntry; actions?: ReactNode }) {
  if (isGeneratedBookEntry(entry)) {
    const details = formatAutomaticEventDetails(entry);
    const rating = entry.type === "rating_added" ? entry.metadata?.rating : undefined;
    const sessions = entry.metadata?.sessions ?? [];
    const sessionGroups = groupGeneratedSessionsByDay(sessions);

    return (
      <article className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <h3 className="font-heading text-xl font-medium leading-snug">{entry.label}</h3>
            {typeof rating === "number" && <RatingStars rating={rating} />}
            {details && <p className="text-sm text-muted-foreground">{details}</p>}
          </div>
          {actions}
        </div>
        {sessions.length > 1 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Sessions</p>
            <div className="divide-y rounded-lg border">
              {sessionGroups.map(([dateKey, daySessions]) => (
                <div key={dateKey} className="space-y-2 p-3">
                  <p className="text-sm font-medium">{formatJournalDate(dateKey)}</p>
                  <div className="space-y-1">
                    {daySessions.map((session) => (
                      <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                          {formatJournalTime(session.loggedAt)}
                          {session.readingMinutes ? ` · ${session.readingMinutes} min` : ""}
                        </span>
                        <span className="text-muted-foreground">page {session.currentPage}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    );
  }

  if (entry.type === "passage" && (isBookJournalEntryRecordEntry(entry) || isSeriesJournalEntryRecordEntry(entry) || isAuthorJournalEntryRecordEntry(entry))) {
    const note = getManualNote(entry);

  return (
    <article className="space-y-4">
        <QuoteBlock
          attribution={
            note.quote_speaker ? (
              <span className="font-serif italic">- {note.quote_speaker}</span>
            ) : null
          }
          actions={actions}
        >
          <FormattedNoteContent markdown={note.content} className="text-lg leading-8 text-foreground [&_em]:not-italic" />
        </QuoteBlock>
      </article>
    );
  }

  const note = isBookJournalEntryRecordEntry(entry)
    ? entry.bookJournalEntry
    : isSeriesJournalEntryRecordEntry(entry)
      ? entry.seriesJournalEntry
      : isAuthorJournalEntryRecordEntry(entry)
        ? entry.authorJournalEntry
        : null;

  if (!note) return null;

  return (
    <article className="space-y-4">
      {displayEntryTitle(entry) && (
        <h3 className="font-heading text-xl font-medium leading-snug">{displayEntryTitle(entry)}</h3>
      )}
      <div className="flex items-end justify-between gap-3">
        <FormattedNoteContent markdown={note.content} className="min-w-0 flex-1 text-base leading-7 text-foreground" />
        {actions}
      </div>
    </article>
  );
}

function JournalPanelInlineActions({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center justify-end gap-1">{children}</div>;
}

function JournalPanelReplyPreview({
  entry,
  busy,
  onToggleSaved,
  onLink,
  onEdit,
}: {
  entry: ManualJournalTimelineEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
}) {
  const note = getManualNote(entry);
  const saved = isSavedEntry(entry);

  return (
    <article className="group/reply relative pl-8">
      <CornerDownRight className="absolute left-0 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <div className="relative rounded-lg border bg-background p-4 pb-10 pr-20 dark:bg-card">
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            aria-label={saved ? "Unsave note" : "Save note"}
            disabled={busy}
            onClick={() => onToggleSaved(entry)}
          >
            <Bookmark className={cn("h-4 w-4", saved && "fill-primary text-primary")} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            aria-label="Link entry"
            title="Link entry"
            disabled={busy}
            onClick={() => onLink(entry)}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute bottom-2 right-2 h-7 w-7 opacity-0 transition-opacity group-hover/reply:opacity-100 focus-visible:opacity-100"
          aria-label="Edit note"
          title="Edit note"
          onClick={() => onEdit(entry)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <FormattedNoteContent markdown={note.content} className="text-sm leading-6 text-foreground" />
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
      </div>
    </article>
  );
}

function JournalPanelRelatedEntryPreview({
  entry,
  onOpen,
}: {
  entry: ManualJournalTimelineEntry;
  onOpen: (entry: JournalTimelineEntry) => void;
}) {
  const note = getManualNote(entry);

  return (
    <button
      type="button"
      className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/35 hover:bg-surface-hover"
      onClick={() => onOpen(entry)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium">{entryTitle(entry)}</p>
        <p className="shrink-0 text-xs text-muted-foreground">{formatJournalDate(entryDate(entry))}</p>
      </div>
      <FormattedNoteContent markdown={note.content} className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground" />
    </button>
  );
}

function getEntryVisibilityInput(entry: JournalTimelineEntry) {
  return {
    entityType: entry.entityType,
    entityId: entry.entityId,
    source: entry.source,
    sourceId: entry.sourceId,
  };
}

function getManualEntryDialogEntity(
  entry: ManualJournalTimelineEntry,
): { type: "Book"; id: string } | { type: "Series"; id: string } | { type: "Author"; id: string } {
  if (isBookJournalEntryRecordEntry(entry)) return { type: "Book", id: entry.bookJournalEntry.book_id };
  if (isSeriesJournalEntryRecordEntry(entry)) return { type: "Series", id: entry.seriesJournalEntry.series_id };
  return { type: "Author", id: entry.authorJournalEntry.author_id };
}

function manualRecordToJournalEntry(
  note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord,
): ManualJournalTimelineEntry {
  if ("book_id" in note) return bookJournalEntryToJournalEntry(note);
  if ("series_id" in note) return seriesJournalEntryToJournalEntry(note);
  return authorJournalEntryToJournalEntry(note);
}

async function linkManualJournalEntries(source: ManualJournalTimelineEntry, target: ManualJournalTimelineEntry): Promise<void> {
  if (!sameManualLinkTable(source, target)) {
    throw new Error("Entries can only be linked within the same journal source.");
  }

  if (isBookJournalEntryRecordEntry(source) && isBookJournalEntryRecordEntry(target)) {
    await linkBookJournalEntries(source.bookJournalEntry.id, target.bookJournalEntry.id);
    return;
  }

  if (isSeriesJournalEntryRecordEntry(source) && isSeriesJournalEntryRecordEntry(target)) {
    await linkSeriesJournalEntries(source.seriesJournalEntry.id, target.seriesJournalEntry.id);
    return;
  }

  if (isAuthorJournalEntryRecordEntry(source) && isAuthorJournalEntryRecordEntry(target)) {
    await linkAuthorJournalEntries(source.authorJournalEntry.id, target.authorJournalEntry.id);
  }
}

async function fetchRelatedManualJournalEntries(entry: ManualJournalTimelineEntry): Promise<ManualJournalTimelineEntry[]> {
  if (isBookJournalEntryRecordEntry(entry)) {
    return getRelatedBookJournalEntries(entry.bookJournalEntry.id).then((items) => items.map(bookJournalEntryToJournalEntry));
  }

  if (isSeriesJournalEntryRecordEntry(entry)) {
    return getRelatedSeriesJournalEntries(entry.seriesJournalEntry.id).then((items) => items.map(seriesJournalEntryToJournalEntry));
  }

  return getRelatedAuthorJournalEntries(entry.authorJournalEntry.id).then((items) => items.map(authorJournalEntryToJournalEntry));
}

function InlineAddEntryComposer({
  parentEntry,
  open,
  onCancel,
  onSaved,
}: {
  parentEntry: ManualJournalTimelineEntry;
  open: boolean;
  onCancel: () => void;
  onSaved: (parentEntry: ManualJournalTimelineEntry, note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
}) {
  const [shouldRender, setShouldRender] = useState(open);
  const entity = getManualEntryDialogEntity(parentEntry);
  const initialBookId = isBookJournalEntryRecordEntry(parentEntry) ? parentEntry.bookJournalEntry.book_id : "";

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      return;
    }

    const timeoutId = window.setTimeout(() => setShouldRender(false), 180);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  if (!open && !shouldRender) return null;

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="relative pl-10">
          <CornerDownRight className="absolute left-0 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <JournalEntryForm
            active={open}
            variant="inline"
            heading={<>Add <em>Note</em></>}
            initialBookId={initialBookId}
            entity={entity}
            initialEntry={null}
            parentEntryId={parentEntry.sourceId}
            hideEntitySelector
            onCancel={onCancel}
            onSaved={(note) => onSaved(parentEntry, note)}
          />
        </div>
      </div>
    </div>
  );
}

function getGeneratedTargetPage(target: GeneratedNoteTarget): number | null {
  return target.session?.currentPage ?? target.entry.metadata?.currentPage ?? null;
}

function getGeneratedTargetDate(target: GeneratedNoteTarget): string {
  return (target.session?.loggedAt ?? target.entry.createdAt).slice(0, 10);
}

function formatGeneratedSessionOption(session: GeneratedSession): string {
  const date = formatJournalDate(session.loggedAt);
  const time = formatJournalTime(session.loggedAt);
  const duration = session.readingMinutes ? ` · ${session.readingMinutes} min` : "";
  return `${date} · ${time}${duration} · page ${session.currentPage}`;
}

function SessionTargetSelector({
  id,
  sessions,
  selectedSessionId,
  onSelectedSessionIdChange,
}: {
  id: string;
  sessions: GeneratedSession[];
  selectedSessionId: string;
  onSelectedSessionIdChange: (sessionId: string) => void;
}) {
  if (sessions.length <= 1) return null;

  return (
    <div className="rounded-t-lg border border-b-0 bg-background px-4 py-3">
      <label className="text-xs font-medium uppercase text-muted-foreground" htmlFor={id}>
        Reading session
      </label>
      <Select value={selectedSessionId} onValueChange={onSelectedSessionIdChange}>
        <SelectTrigger id={id} className="mt-2">
          <SelectValue placeholder="Choose a reading session" />
        </SelectTrigger>
        <SelectContent>
          {sessions.map((session) => (
            <SelectItem key={session.id} value={session.id}>
              {formatGeneratedSessionOption(session)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InlineGeneratedNoteComposer({
  target,
  open,
  onCancel,
  onSaved,
}: {
  target: GeneratedNoteTarget;
  open: boolean;
  onCancel: () => void;
  onSaved: (target: GeneratedNoteTarget, note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
}) {
  const [shouldRender, setShouldRender] = useState(open);
  const sessions = useMemo(
    () => [...(target.entry.metadata?.sessions ?? [])].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
    [target.entry.metadata?.sessions],
  );
  const initialSessionId = target.session?.id ?? sessions[0]?.id ?? "";
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId);

  useEffect(() => {
    if (!open) return;
    setSelectedSessionId(initialSessionId);
  }, [initialSessionId, open]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? target.session ?? sessions[0];
  const selectedTarget = selectedSession ? { entry: target.entry, session: selectedSession } : target;

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      return;
    }

    const timeoutId = window.setTimeout(() => setShouldRender(false), 180);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  if (!open && !shouldRender) return null;

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="relative pl-10">
          <CornerDownRight className="absolute left-0 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {target.entry.type === "reading_session" && (
            <SessionTargetSelector
              id={`note-session-${target.entry.id}`}
              sessions={sessions}
              selectedSessionId={selectedSession?.id ?? ""}
              onSelectedSessionIdChange={setSelectedSessionId}
            />
          )}
          <JournalEntryForm
            key={selectedSession?.id ?? target.entry.id}
            active={open}
            variant="inline"
            heading={<>Add <em>Note</em></>}
            initialBookId={selectedTarget.entry.entityId}
            entity={{ type: "Book", id: selectedTarget.entry.entityId }}
            initialEntry={null}
            initialPageStart={getGeneratedTargetPage(selectedTarget)}
            initialNoteDate={getGeneratedTargetDate(selectedTarget)}
            systemTags={getGeneratedTargetTags(selectedTarget)}
            hideEntitySelector
            onCancel={onCancel}
            onSaved={(note) => onSaved(selectedTarget, note)}
          />
        </div>
      </div>
    </div>
  );
}

function InlineEditReplyComposer({
  entry,
  generatedParentEntry,
  busy,
  onCancel,
  onDelete,
  onSaved,
}: {
  entry: ManualJournalTimelineEntry;
  generatedParentEntry?: GeneratedBookJournalEntry | null;
  busy: boolean;
  onCancel: () => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  onSaved: (entry: ManualJournalTimelineEntry, note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
}) {
  const entity = getManualEntryDialogEntity(entry);
  const initialBookId = isBookJournalEntryRecordEntry(entry) ? entry.bookJournalEntry.book_id : "";
  const sessions = useMemo(
    () => [...(generatedParentEntry?.metadata?.sessions ?? [])].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
    [generatedParentEntry?.metadata?.sessions],
  );
  const initialSessionId =
    getAttachedGeneratedNoteTags(entry)
      .map(getReadingLogSessionIdFromTag)
      .find((sessionId): sessionId is string => Boolean(sessionId)) ??
    sessions[0]?.id ??
    "";
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId);

  useEffect(() => {
    setSelectedSessionId(initialSessionId);
  }, [initialSessionId]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const selectedTarget = generatedParentEntry && selectedSession
    ? { entry: generatedParentEntry, session: selectedSession }
    : null;

  return (
    <div className="relative pl-8">
      <CornerDownRight className="absolute left-0 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      {generatedParentEntry?.type === "reading_session" && (
        <SessionTargetSelector
          id={`edit-note-session-${entry.id}`}
          sessions={sessions}
          selectedSessionId={selectedSession?.id ?? ""}
          onSelectedSessionIdChange={setSelectedSessionId}
        />
      )}
      <JournalEntryForm
        key={selectedSession?.id ?? entry.id}
        active
        variant="inline"
        heading={<><em>Edit</em> Note</>}
        initialBookId={initialBookId}
        entity={entity}
        initialEntry={getManualNote(entry)}
        initialPageStart={selectedTarget ? getGeneratedTargetPage(selectedTarget) : undefined}
        initialNoteDate={selectedTarget ? getGeneratedTargetDate(selectedTarget) : undefined}
        preferInitialPageAndDate={Boolean(selectedTarget)}
        systemTags={selectedTarget ? getGeneratedTargetTags(selectedTarget) : undefined}
        replaceSystemTagPrefixes={selectedTarget ? [READING_LOG_NOTE_TAG_PREFIX] : undefined}
        hideEntitySelector
        footerStart={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete note"
            title="Delete note"
            disabled={busy}
            onClick={() => onDelete(entry)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
        onCancel={onCancel}
        onSaved={(note) => onSaved(entry, note)}
      />
    </div>
  );
}

function TimelineInlineAddEntryComposerRow({
  parentEntry,
  open,
  onCancel,
  onSaved,
}: {
  parentEntry: ManualJournalTimelineEntry;
  open: boolean;
  onCancel: () => void;
  onSaved: (parentEntry: ManualJournalTimelineEntry, note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_5.5rem_minmax(0,1fr)] gap-3">
      <div aria-hidden="true" />
      <div aria-hidden="true" />
      <div>
        <InlineAddEntryComposer
          parentEntry={parentEntry}
          open={open}
          onCancel={onCancel}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}

function TimelineInlineGeneratedNoteComposerRow({
  target,
  open,
  onCancel,
  onSaved,
}: {
  target: GeneratedNoteTarget;
  open: boolean;
  onCancel: () => void;
  onSaved: (target: GeneratedNoteTarget, note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_5.5rem_minmax(0,1fr)] gap-3">
      <div aria-hidden="true" />
      <div aria-hidden="true" />
      <div>
        <InlineGeneratedNoteComposer
          target={target}
          open={open}
          onCancel={onCancel}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}

async function deleteManualEntry(entry: JournalTimelineEntry) {
  if (isBookJournalEntryRecordEntry(entry)) return deleteBookJournalEntryRecord(entry.bookJournalEntry.id);
  if (isSeriesJournalEntryRecordEntry(entry)) return deleteSeriesJournalEntryRecord(entry.seriesJournalEntry.id);
  if (isAuthorJournalEntryRecordEntry(entry)) return deleteAuthorJournalEntryRecord(entry.authorJournalEntry.id);
}

async function fetchRepliesForEntry(entry: ManualJournalTimelineEntry): Promise<ManualJournalTimelineEntry[]> {
  if (isBookJournalEntryRecordEntry(entry)) {
    return getBookJournalReplies(entry.bookJournalEntry.id).then((items) => items.map(bookJournalEntryToJournalEntry));
  }
  if (isSeriesJournalEntryRecordEntry(entry)) {
    return getSeriesJournalReplies(entry.seriesJournalEntry.id).then((items) => items.map(seriesJournalEntryToJournalEntry));
  }
  return getAuthorJournalReplies(entry.authorJournalEntry.id).then((items) => items.map(authorJournalEntryToJournalEntry));
}

export default function JournalTimeline({
  entries,
  generatedReferenceEntries = [],
  emptyMessage = "No journal entries yet.",
  className,
  layout = "timeline",
  sortMode = "entry-date",
  onEntryUpdated,
  onEntryEdit,
  onEntryCreated,
  onEntryDeleted,
}: JournalTimelineProps) {
  const { user } = useAuth();
  const [selectedEntry, setSelectedEntry] = useState<JournalTimelineEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [composerParentEntry, setComposerParentEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [generatedComposerTarget, setGeneratedComposerTarget] = useState<GeneratedNoteTarget | null>(null);
  const [optimisticUncompressedReadingLogIds, setOptimisticUncompressedReadingLogIds] = useState<Set<string>>(new Set());
  const [editingReplyEntry, setEditingReplyEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteTarget | null>(null);
  const [linkingEntry, setLinkingEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [linkingError, setLinkingError] = useState<string | null>(null);
  const [linkingBusyEntryId, setLinkingBusyEntryId] = useState<string | null>(null);
  const [relatedEntries, setRelatedEntries] = useState<ManualJournalTimelineEntry[]>([]);
  const [relatedEntriesLoading, setRelatedEntriesLoading] = useState(false);
  const [relatedEntriesRefreshKey, setRelatedEntriesRefreshKey] = useState(0);
  const [replyEntries, setReplyEntries] = useState<ManualJournalTimelineEntry[]>([]);
  const [timelineRepliesByParentId, setTimelineRepliesByParentId] = useState<Record<string, ManualJournalTimelineEntry[]>>({});
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [hiddenEntries, setHiddenEntries] = useState<Set<string>>(new Set());
  const [hiddenSectionOpen, setHiddenSectionOpen] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const visibleEntries = useMemo(() => entries, [entries]);
  const generatedPanelReferenceEntries = useMemo(() => {
    const generatedEntries = new Map<string, GeneratedBookJournalEntry>();

    [...generatedReferenceEntries, ...visibleEntries.filter(isGeneratedBookEntry)].forEach((entry) => {
      splitGeneratedReadingSessionEntry(entry, optimisticUncompressedReadingLogIds).forEach((splitEntry) => {
        generatedEntries.set(splitEntry.id, splitEntry);
      });
    });

    return sortJournalEntries([...generatedEntries.values()]);
  }, [generatedReferenceEntries, optimisticUncompressedReadingLogIds, visibleEntries]);
  const displayEntries = useMemo(() => {
    const expandedEntries: JournalTimelineEntry[] = [];
    visibleEntries.forEach((entry) => {
      if (isGeneratedBookEntry(entry)) {
        expandedEntries.push(...splitGeneratedReadingSessionEntry(entry, optimisticUncompressedReadingLogIds));
        return;
      }

      expandedEntries.push(entry);
    });

    return expandedEntries;
  }, [optimisticUncompressedReadingLogIds, visibleEntries]);
  const entity = entries[0] ? { type: entries[0].entityType, id: entries[0].entityId } : null;

  useEffect(() => {
    const parentEntries = visibleEntries.filter((entry): entry is ManualJournalTimelineEntry => (
      isManualEntry(entry) && !isReplyEntry(entry)
    ));

    if (parentEntries.length === 0) {
      setTimelineRepliesByParentId({});
      return;
    }

    let cancelled = false;
    Promise.all(parentEntries.map((entry) => fetchRepliesForEntry(entry).then((replies) => [entry.sourceId, replies] as const)))
      .then((results) => {
        if (cancelled) return;
        setTimelineRepliesByParentId(Object.fromEntries(results));
      })
      .catch(() => {
        if (!cancelled) setTimelineRepliesByParentId({});
      });

    return () => {
      cancelled = true;
    };
  }, [visibleEntries]);

  useEffect(() => {
    if (!entity) {
      setHiddenEntries(new Set());
      return;
    }

    let cancelled = false;
    fetchHiddenJournalEntries(entity.type, entity.id)
      .then((data) => {
        if (!cancelled) setHiddenEntries(getHiddenJournalEntryKeys(data));
      })
      .catch(() => {
        if (!cancelled) setHiddenEntries(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [entity?.id, entity?.type]);

  const generatedAttachmentTagsInTimeline = useMemo(() => {
    const tags = new Set<string>();
    displayEntries.forEach((entry) => {
      if (!isGeneratedBookEntry(entry)) return;
      getGeneratedEntryNoteTags(entry).forEach((tag) => tags.add(tag));
    });
    return tags;
  }, [displayEntries]);

  const splitEntries = useMemo(() => {
    const visible: JournalTimelineEntry[] = [];
    const hidden: JournalTimelineEntry[] = [];
    displayEntries.forEach((entry) => {
      if (sortMode === "entry-date" && isReplyEntry(entry)) return;
      if (isAttachedGeneratedNote(entry) && getAttachedGeneratedNoteTags(entry).some((tag) => generatedAttachmentTagsInTimeline.has(tag))) return;
      const key = getJournalVisibilityKey(getEntryVisibilityInput(entry));
      if (hiddenEntries.has(key)) hidden.push(entry);
      else visible.push(entry);
    });
    return { visible, hidden };
  }, [displayEntries, generatedAttachmentTagsInTimeline, hiddenEntries, sortMode]);
  const selectedEntryHidden = selectedEntry
    ? hiddenEntries.has(getJournalVisibilityKey(getEntryVisibilityInput(selectedEntry)))
    : false;
  const selectedEntryTags = selectedEntry ? visibleJournalTags(getJournalEntryTags(selectedEntry)) : [];
  const generatedAttachedNotesByTag = useMemo(() => {
    const groups = new Map<string, ManualJournalTimelineEntry[]>();

    visibleEntries.forEach((entry) => {
      if (!isAttachedGeneratedNote(entry)) return;
      getAttachedGeneratedNoteTags(entry).forEach((tag) => {
        groups.set(tag, [...(groups.get(tag) ?? []), entry]);
      });
    });

    return groups;
  }, [visibleEntries]);
  const selectedGeneratedAttachedNotes = selectedEntry && isGeneratedBookEntry(selectedEntry)
    ? getGeneratedEntryNoteTags(selectedEntry).flatMap((tag) => generatedAttachedNotesByTag.get(tag) ?? [])
    : [];
  const selectedGeneratedSessionTime = selectedEntry && isGeneratedBookEntry(selectedEntry)
    ? formatGeneratedSessionTime(selectedEntry)
    : null;
  const availableLinkTargets = useMemo(() => {
    if (!linkingEntry) return [];

    const entriesById = new Map<string, ManualJournalTimelineEntry>();
    displayEntries.forEach((entry) => {
      if (isManualEntry(entry)) entriesById.set(entry.id, entry);
    });
    Object.values(timelineRepliesByParentId).flat().forEach((entry) => {
      entriesById.set(entry.id, entry);
    });

    return [...entriesById.values()]
      .filter((entry) => entry.id !== linkingEntry.id && sameManualLinkTable(linkingEntry, entry))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }, [displayEntries, linkingEntry, timelineRepliesByParentId]);
  const parentContextLabelsByEntryId = useMemo(() => {
    const labels = new Map<string, string>();
    if (sortMode !== "date-added") return labels;

    const possibleParents = [...displayEntries, ...generatedPanelReferenceEntries];
    displayEntries.forEach((entry) => {
      if (isManualEntry(entry) && isReplyEntry(entry)) {
        const parentEntryId = getManualNote(entry).parent_entry_id;
        const parentEntry = possibleParents.find((item) => isManualEntry(item) && item.sourceId === parentEntryId);
        if (parentEntry) labels.set(entry.id, entryTitle(parentEntry));
      }

      if (isAttachedGeneratedNote(entry)) {
        const noteTags = new Set(getAttachedGeneratedNoteTags(entry));
        const generatedParent = possibleParents.find((item) => (
          isGeneratedBookEntry(item) && getGeneratedEntryNoteTags(item).some((tag) => noteTags.has(tag))
        ));
        if (generatedParent) labels.set(entry.id, entryTitle(generatedParent));
      }
    });

    return labels;
  }, [displayEntries, generatedPanelReferenceEntries, sortMode]);

  useEffect(() => {
    if (!selectedEntry || !isManualEntry(selectedEntry)) {
      setRelatedEntries([]);
      setRelatedEntriesLoading(false);
      return;
    }

    let cancelled = false;
    setRelatedEntriesLoading(true);
    fetchRelatedManualJournalEntries(selectedEntry)
      .then((entries) => {
        if (!cancelled) setRelatedEntries(entries);
      })
      .catch(() => {
        if (!cancelled) setRelatedEntries([]);
      })
      .finally(() => {
        if (!cancelled) setRelatedEntriesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [relatedEntriesRefreshKey, selectedEntry?.id]);

  useEffect(() => {
    if (!selectedEntry || !isManualEntry(selectedEntry)) {
      setEditingReplyEntry(null);
      setReplyEntries([]);
      return;
    }

    let cancelled = false;
    setRepliesLoading(true);
    fetchRepliesForEntry(selectedEntry)
      .then((replies) => {
        if (cancelled) return;
        setReplyEntries(replies);
      })
      .catch(() => {
        if (cancelled) return;
        setReplyEntries([]);
      })
      .finally(() => {
        if (!cancelled) setRepliesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEntry?.id]);

  async function handleHide(entry: JournalTimelineEntry) {
    if (!user) return;
    const input = getEntryVisibilityInput(entry);
    const key = getJournalVisibilityKey(input);
    setBusyEntryId(entry.id);
    try {
      await hideJournalEntry({ ...input, userId: user.id });
      setHiddenEntries((current) => new Set(current).add(key));
    } finally {
      setBusyEntryId(null);
    }
  }

  async function handleRestore(entry: JournalTimelineEntry) {
    const input = getEntryVisibilityInput(entry);
    const key = getJournalVisibilityKey(input);
    setBusyEntryId(entry.id);
    try {
      await restoreJournalEntry(input);
      setHiddenEntries((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    } finally {
      setBusyEntryId(null);
    }
  }

  function requestEntryDelete(entry: JournalTimelineEntry) {
    if (!isManualEntry(entry)) return;
    setPendingDelete({ type: "entry", entry });
  }

  async function performEntryDelete(entry: ManualJournalTimelineEntry) {
    setBusyEntryId(entry.id);
    try {
      await deleteManualEntry(entry);
      onEntryDeleted?.(entry);
      setSelectedEntry(null);
      setPendingDelete(null);
    } finally {
      setBusyEntryId(null);
    }
  }

  function getPanelTargetForEntry(entry: JournalTimelineEntry): JournalTimelineEntry {
    if (isAttachedGeneratedNote(entry)) {
      const noteTags = new Set(getAttachedGeneratedNoteTags(entry));
      const generatedParent = [...displayEntries, ...generatedPanelReferenceEntries].find((item) => (
        isGeneratedBookEntry(item) && getGeneratedEntryNoteTags(item).some((tag) => noteTags.has(tag))
      ));
      if (generatedParent) return generatedParent;
    }

    if (isManualEntry(entry) && isReplyEntry(entry)) {
      const parentEntryId = getManualNote(entry).parent_entry_id;
      const manualParent = displayEntries.find((item) => (
        isManualEntry(item) && item.sourceId === parentEntryId
      ));
      if (manualParent) return manualParent;
    }

    return entry;
  }

  function openEntry(entry: JournalTimelineEntry) {
    setSelectedEntry(getPanelTargetForEntry(entry));
    setComposerParentEntry(null);
    setGeneratedComposerTarget(null);
    setDetailsOpen(false);
  }

  function startEditing(entry: JournalTimelineEntry) {
    if (!isManualEntry(entry)) return;
    setEditingEntry(entry);
    setComposerParentEntry(null);
    setGeneratedComposerTarget(null);
    setEditingReplyEntry(null);
    setDetailsOpen(false);
  }

  function startReply(entry: JournalTimelineEntry) {
    if (isGeneratedAttachableEntry(entry)) {
      const sessions = entry.metadata?.sessions ?? [];
      setComposerParentEntry(null);
      setEditingEntry(null);
      setEditingReplyEntry(null);

      setGeneratedComposerTarget({ entry, session: sessions[0] });
      return;
    }

    if (!isManualEntry(entry) || isReplyEntry(entry) || isAttachedGeneratedNote(entry)) return;
    setComposerParentEntry(entry);
    setGeneratedComposerTarget(null);
    setEditingEntry(null);
    setEditingReplyEntry(null);
  }

  function startLinking(entry: ManualJournalTimelineEntry) {
    setLinkingEntry(entry);
    setLinkingError(null);
  }

  async function handleLinkTarget(target: ManualJournalTimelineEntry) {
    if (!linkingEntry) return;

    setLinkingBusyEntryId(target.id);
    setLinkingError(null);
    try {
      await linkManualJournalEntries(linkingEntry, target);
      setRelatedEntriesRefreshKey((current) => current + 1);
      setLinkingEntry(null);
    } catch (error) {
      setLinkingError(error instanceof Error ? error.message : "Could not link these entries.");
    } finally {
      setLinkingBusyEntryId(null);
    }
  }

  async function handleToggleSaved(entry: JournalTimelineEntry) {
    if (!isManualEntry(entry)) return;
    setBusyEntryId(entry.id);
    try {
      const note = getManualNote(entry);
      const nextFavorite = !note.is_favorite;
      let updatedNote: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord;

      if (isBookJournalEntryRecordEntry(entry)) {
        updatedNote = await updateBookJournalEntryRecord({
          noteId: entry.bookJournalEntry.id,
          label: entry.bookJournalEntry.label,
          title: entry.bookJournalEntry.title ?? undefined,
          quoteSpeaker: entry.bookJournalEntry.quote_speaker ?? undefined,
          content: entry.bookJournalEntry.content,
          tags: entry.bookJournalEntry.tags ?? undefined,
          pageStart: entry.bookJournalEntry.page_start ?? undefined,
          noteDate: entry.bookJournalEntry.entry_date,
          isFavorite: nextFavorite,
        });
      } else if (isSeriesJournalEntryRecordEntry(entry)) {
        updatedNote = await updateSeriesJournalEntryRecord({
          noteId: entry.seriesJournalEntry.id,
          label: entry.seriesJournalEntry.label,
          title: entry.seriesJournalEntry.title ?? undefined,
          quoteSpeaker: entry.seriesJournalEntry.quote_speaker ?? undefined,
          content: entry.seriesJournalEntry.content,
          tags: entry.seriesJournalEntry.tags ?? undefined,
          pageStart: entry.seriesJournalEntry.page_start ?? undefined,
          noteDate: entry.seriesJournalEntry.entry_date,
          isFavorite: nextFavorite,
        });
      } else {
        updatedNote = await updateAuthorJournalEntryRecord({
          noteId: entry.authorJournalEntry.id,
          label: entry.authorJournalEntry.label,
          title: entry.authorJournalEntry.title ?? undefined,
          quoteSpeaker: entry.authorJournalEntry.quote_speaker ?? undefined,
          content: entry.authorJournalEntry.content,
          tags: entry.authorJournalEntry.tags ?? undefined,
          pageStart: entry.authorJournalEntry.page_start ?? undefined,
          noteDate: entry.authorJournalEntry.entry_date,
          isFavorite: nextFavorite,
        });
      }

      const updatedEntry = replaceManualEntryRecord(entry, updatedNote);
      setSelectedEntry((current) => (current?.id === entry.id ? updatedEntry : current));
      const updatedManualEntry = updatedEntry as ManualJournalTimelineEntry;
      if (isReplyEntry(updatedManualEntry)) {
        const parentEntryId = getManualNote(updatedManualEntry).parent_entry_id;
        setReplyEntries((current) => current.map((item) => (item.id === entry.id ? updatedManualEntry : item)));
        if (parentEntryId) {
          setTimelineRepliesByParentId((current) => ({
            ...current,
            [parentEntryId]: (current[parentEntryId] ?? []).map((item) => (item.id === entry.id ? updatedManualEntry : item)),
          }));
        }
      }
      onEntryUpdated?.(updatedEntry);
    } finally {
      setBusyEntryId(null);
    }
  }

  function handleEditingEntrySaved(note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) {
    if (!editingEntry) return;
    const updatedEntry = replaceManualEntryRecord(editingEntry, note);
    setEditingEntry(null);
    setSelectedEntry(updatedEntry);
    onEntryUpdated?.(updatedEntry);
    onEntryEdit?.(updatedEntry);
  }

  function handleComposerEntrySaved(
    parentEntry: ManualJournalTimelineEntry,
    note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord,
  ) {
    const replyEntry = manualRecordToJournalEntry(note);
    setReplyEntries((current) => (
      selectedEntry?.id === parentEntry.id
        ? [...current, replyEntry]
        : current
    ));
    setTimelineRepliesByParentId((current) => ({
      ...current,
      [parentEntry.sourceId]: [...(current[parentEntry.sourceId] ?? []), replyEntry],
    }));
    setComposerParentEntry(null);
  }

  function handleGeneratedNoteSaved(
    target: GeneratedNoteTarget,
    note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord,
  ) {
    const createdEntry = manualRecordToJournalEntry(note);
    if (target.session) {
      setOptimisticUncompressedReadingLogIds((current) => new Set(current).add(target.session!.id));
    }
    setGeneratedComposerTarget(null);
    onEntryCreated?.(createdEntry);
    if (selectedEntry?.id === target.entry.id) {
      setSelectedEntry(target.session ? createGeneratedSessionEntryFromSessions(target.entry, [target.session]) : target.entry);
    }
  }

  function handleReplyEditSaved(
    entry: ManualJournalTimelineEntry,
    note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord,
  ) {
    const updatedEntry = replaceManualEntryRecord(entry, note) as ManualJournalTimelineEntry;
    const parentEntryId = getManualNote(updatedEntry).parent_entry_id;
    const previousReadingLogIds = getAttachedGeneratedNoteTags(entry)
      .map(getReadingLogSessionIdFromTag)
      .filter((sessionId): sessionId is string => Boolean(sessionId));
    const nextReadingLogIds = getAttachedGeneratedNoteTags(updatedEntry)
      .map(getReadingLogSessionIdFromTag)
      .filter((sessionId): sessionId is string => Boolean(sessionId));

    setReplyEntries((current) => current.map((item) => (item.id === entry.id ? updatedEntry : item)));
    if (parentEntryId) {
      setTimelineRepliesByParentId((current) => ({
        ...current,
        [parentEntryId]: (current[parentEntryId] ?? []).map((item) => (item.id === entry.id ? updatedEntry : item)),
      }));
    }
    if (previousReadingLogIds.length > 0 || nextReadingLogIds.length > 0) {
      setOptimisticUncompressedReadingLogIds((current) => {
        const next = new Set(current);
        nextReadingLogIds.forEach((sessionId) => next.add(sessionId));
        previousReadingLogIds.forEach((sessionId) => {
          if (nextReadingLogIds.includes(sessionId)) return;
          const hasAnotherNoteForSession = visibleEntries.some((item) => (
            item.id !== entry.id &&
            isAttachedGeneratedNote(item) &&
            getAttachedGeneratedNoteTags(item).includes(getReadingLogNoteTag(sessionId))
          ));
          if (!hasAnotherNoteForSession) next.delete(sessionId);
        });
        return next;
      });
    }
    setEditingReplyEntry(null);
    onEntryUpdated?.(updatedEntry);
  }

  function requestNoteDelete(entry: ManualJournalTimelineEntry) {
    setPendingDelete({ type: "note", entry });
  }

  async function performNoteDelete(entry: ManualJournalTimelineEntry) {
    setBusyEntryId(entry.id);
    try {
      await deleteManualEntry(entry);
      const parentEntryId = getManualNote(entry).parent_entry_id;
      setReplyEntries((current) => current.filter((item) => item.id !== entry.id));
      if (parentEntryId) {
        setTimelineRepliesByParentId((current) => ({
          ...current,
          [parentEntryId]: (current[parentEntryId] ?? []).filter((item) => item.id !== entry.id),
        }));
      }
      getAttachedGeneratedNoteTags(entry)
        .filter((tag) => tag.startsWith(READING_LOG_NOTE_TAG_PREFIX))
        .forEach((tag) => {
          const hasAnotherNoteForSession = visibleEntries.some((item) => (
            item.id !== entry.id && isAttachedGeneratedNote(item) && getAttachedGeneratedNoteTags(item).includes(tag)
          ));
          if (!hasAnotherNoteForSession) {
            setOptimisticUncompressedReadingLogIds((current) => {
              const next = new Set(current);
              next.delete(tag.slice(READING_LOG_NOTE_TAG_PREFIX.length));
              return next;
            });
          }
        });
      setEditingReplyEntry(null);
      onEntryDeleted?.(entry);
      setPendingDelete(null);
    } finally {
      setBusyEntryId(null);
    }
  }

  async function confirmPendingDelete() {
    if (!pendingDelete) return;

    if (pendingDelete.type === "entry") {
      await performEntryDelete(pendingDelete.entry);
      return;
    }

    await performNoteDelete(pendingDelete.entry);
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const editingEntryEntity = editingEntry ? getManualEntryDialogEntity(editingEntry) : undefined;
  const editingInitialBookId = editingEntry && isBookJournalEntryRecordEntry(editingEntry) ? editingEntry.bookJournalEntry.book_id : "";

  return (
    <>
      {splitEntries.visible.length > 0 ? (
        <div className={cn(layout === "cards" ? "grid gap-3 md:grid-cols-2" : "space-y-4", className)}>
          {splitEntries.visible.map((entry, index) => {
            const parentManualEntry = isManualEntry(entry) ? entry : null;
            const timelineReplies = parentManualEntry ? timelineRepliesByParentId[parentManualEntry.sourceId] ?? [] : [];
            const composerOpen = parentManualEntry !== null && composerParentEntry?.id === parentManualEntry.id && selectedEntry?.id !== parentManualEntry.id;
            const generatedAttachedNotes = isGeneratedBookEntry(entry)
              ? getGeneratedEntryNoteTags(entry).flatMap((tag) => generatedAttachedNotesByTag.get(tag) ?? [])
              : [];
            const generatedComposerOpen = isGeneratedBookEntry(entry) && generatedComposerTarget?.entry.id === entry.id && selectedEntry?.id !== entry.id;
            return layout === "cards" ? (
              <div key={entry.id} className="space-y-3">
                {parentContextLabelsByEntryId.has(entry.id) && (
                  <p className="text-xs text-muted-foreground">with {parentContextLabelsByEntryId.get(entry.id)}</p>
                )}
                <div
                  role="button"
                  tabIndex={0}
                  className="relative h-full cursor-pointer"
                  onClick={() => openEntry(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEntry(entry);
                    }
                  }}
                >
                  <JournalEntryCard
                    entry={entry}
                    busy={busyEntryId === entry.id}
                    onToggleSaved={(item) => void handleToggleSaved(item)}
                    onReply={startReply}
                    onLink={(item) => {
                      if (canLinkEntry(item)) startLinking(item);
                    }}
                  />
                </div>
                {isManualEntry(entry) && (
                  <InlineAddEntryComposer
                    parentEntry={entry}
                    open={composerOpen}
                    onCancel={() => setComposerParentEntry(null)}
                    onSaved={handleComposerEntrySaved}
                  />
                )}
                {isGeneratedBookEntry(entry) && generatedComposerTarget?.entry.id === entry.id && (
                  <InlineGeneratedNoteComposer
                    target={generatedComposerTarget}
                    open={generatedComposerOpen}
                    onCancel={() => setGeneratedComposerTarget(null)}
                    onSaved={handleGeneratedNoteSaved}
                  />
                )}
              </div>
            ) : (
              <div
                key={entry.id}
                className={cn(
                  "relative space-y-3",
                  index < splitEntries.visible.length - 1 &&
                    "before:absolute before:left-3 before:top-6 before:-bottom-4 before:w-px before:bg-border",
                )}
              >
                <TimelineRow
                  entry={entry}
                  index={index}
                  total={splitEntries.visible.length}
                  busy={busyEntryId === entry.id}
                  onOpen={openEntry}
                  onToggleSaved={(item) => void handleToggleSaved(item)}
                  onReply={startReply}
                  onLink={startLinking}
                  parentContextLabel={parentContextLabelsByEntryId.get(entry.id)}
                  showConnector={false}
                />
                {isManualEntry(entry) && (
                  <TimelineInlineAddEntryComposerRow
                    parentEntry={entry}
                    open={composerOpen}
                    onCancel={() => setComposerParentEntry(null)}
                    onSaved={handleComposerEntrySaved}
                  />
                )}
                {isGeneratedBookEntry(entry) && generatedComposerTarget?.entry.id === entry.id && (
                  <TimelineInlineGeneratedNoteComposerRow
                    target={generatedComposerTarget}
                    open={generatedComposerOpen}
                    onCancel={() => setGeneratedComposerTarget(null)}
                    onSaved={handleGeneratedNoteSaved}
                  />
                )}
                {parentManualEntry && timelineReplies.map((reply) => (
                  <TimelineReplyRow
                    key={reply.id}
                    entry={reply}
                    parentEntry={parentManualEntry}
                    busy={busyEntryId === reply.id}
                    onToggleSaved={(item) => void handleToggleSaved(item)}
                    onLink={startLinking}
                    onOpenParent={openEntry}
                  />
                ))}
                {isGeneratedBookEntry(entry) && generatedAttachedNotes.map((note) => (
                  <TimelineReplyRow
                    key={note.id}
                    entry={note}
                    parentEntry={entry}
                    busy={busyEntryId === note.id}
                    onToggleSaved={(item) => void handleToggleSaved(item)}
                    onLink={startLinking}
                    onOpenParent={openEntry}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          All entries are hidden.
        </div>
      )}

      {splitEntries.hidden.length > 0 && (
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" onClick={() => setHiddenSectionOpen((open) => !open)}>
            {hiddenSectionOpen ? "Hide hidden entries" : "Show hidden entries"}
          </Button>
          {hiddenSectionOpen && (
            <div className="mt-3 space-y-4 rounded-lg border border-dashed p-3">
              {splitEntries.hidden.map((entry, index) => (
                <TimelineRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  total={splitEntries.hidden.length}
                  busy={busyEntryId === entry.id}
                  onOpen={openEntry}
                  onToggleSaved={(item) => void handleToggleSaved(item)}
                  onReply={startReply}
                  onLink={startLinking}
                  parentContextLabel={parentContextLabelsByEntryId.get(entry.id)}
                  hideSaveButton
                  restoreButton={
                    <HiddenEntryRestoreButton
                      entry={entry}
                      busy={busyEntryId === entry.id}
                      onRestore={(item) => void handleRestore(item)}
                    />
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEntry(null);
            setEditingEntry(null);
            setComposerParentEntry(null);
            setGeneratedComposerTarget(null);
            setEditingReplyEntry(null);
            setLinkingEntry(null);
            setReplyEntries([]);
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-4xl" showCloseButton={false}>
          {selectedEntry && (
            <>
              <DialogTitle className="sr-only">{entryTitle(selectedEntry)}</DialogTitle>
              {editingEntry ? (
                <div className="max-h-[75vh] overflow-y-auto">
                  <JournalEntryForm
                    active
                    initialBookId={editingInitialBookId}
                    entity={editingEntryEntity}
                    initialEntry={getManualNote(editingEntry)}
                    onCancel={() => {
                      setEditingEntry(null);
                    }}
                    onSaved={handleEditingEntrySaved}
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    "grid max-h-[75vh] overflow-hidden transition-[grid-template-columns]",
                    detailsOpen ? "md:grid-cols-[minmax(0,1fr)_18rem]" : "md:grid-cols-1",
                  )}
                >
                  <div className="relative overflow-y-auto p-6 pb-20 pr-20 sm:p-8 sm:pb-20 sm:pr-24">
                    <div className="absolute right-3 top-7 z-10 flex items-center gap-2">
                      {isManualEntry(selectedEntry) && !selectedEntryHidden && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-primary"
                          aria-label={isSavedEntry(selectedEntry) ? "Unsave entry" : "Save entry"}
                          disabled={busyEntryId === selectedEntry.id}
                          onClick={() => void handleToggleSaved(selectedEntry)}
                        >
                          <Bookmark className={cn("h-4 w-4", isSavedEntry(selectedEntry) && "fill-primary text-primary")} />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Entry details"
                        onClick={() => setDetailsOpen((open) => !open)}
                      >
                        {detailsOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      </Button>
                    </div>
                    <JournalPanelEntryContent
                      entry={selectedEntry}
                      actions={(
                        <JournalPanelInlineActions>
                          {isManualEntry(selectedEntry) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Link entry"
                              title="Link entry"
                              onClick={() => startLinking(selectedEntry)}
                            >
                              <LinkIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {((isManualEntry(selectedEntry) && !isReplyEntry(selectedEntry)) || isGeneratedAttachableEntry(selectedEntry)) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Add note"
                              title="Add note"
                              onClick={() => startReply(selectedEntry)}
                            >
                              <Reply className="h-4 w-4" />
                            </Button>
                          )}
                        </JournalPanelInlineActions>
                      )}
                    />
                    {isManualEntry(selectedEntry) && !isReplyEntry(selectedEntry) && (
                      <div className="mt-6">
                        <InlineAddEntryComposer
                          parentEntry={selectedEntry}
                          open={composerParentEntry?.id === selectedEntry.id}
                          onCancel={() => setComposerParentEntry(null)}
                          onSaved={handleComposerEntrySaved}
                        />
                      </div>
                    )}
                    {isGeneratedBookEntry(selectedEntry) && generatedComposerTarget?.entry.id === selectedEntry.id && (
                      <div className="mt-6">
                        <InlineGeneratedNoteComposer
                          target={generatedComposerTarget}
                          open={generatedComposerTarget.entry.id === selectedEntry.id}
                          onCancel={() => setGeneratedComposerTarget(null)}
                          onSaved={handleGeneratedNoteSaved}
                        />
                      </div>
                    )}
                    {isManualEntry(selectedEntry) && (
                      <div className="mt-8 space-y-6">
                        {repliesLoading ? (
                          <p className="text-sm text-muted-foreground">Loading notes...</p>
                        ) : (
                          replyEntries.length > 0 && (
                            <div className="space-y-3">
                              {replyEntries.map((entry) => (
                                editingReplyEntry?.id === entry.id ? (
                                  <InlineEditReplyComposer
                                    key={entry.id}
                                    entry={entry}
                                    generatedParentEntry={null}
                                    busy={busyEntryId === entry.id}
                                    onCancel={() => setEditingReplyEntry(null)}
                                    onDelete={requestNoteDelete}
                                    onSaved={handleReplyEditSaved}
                                  />
                                ) : (
                                  <JournalPanelReplyPreview
                                    key={entry.id}
                                    entry={entry}
                                    busy={busyEntryId === entry.id}
                                    onToggleSaved={(item) => void handleToggleSaved(item)}
                                    onLink={startLinking}
                                    onEdit={(reply) => {
                                      setComposerParentEntry(null);
                                      setEditingReplyEntry(reply);
                                    }}
                                  />
                                )
                              ))}
                            </div>
                          )
                        )}
                      </div>
                    )}
                    {isGeneratedBookEntry(selectedEntry) && selectedGeneratedAttachedNotes.length > 0 && (
                      <div className="mt-8 space-y-3">
                        {selectedGeneratedAttachedNotes.map((entry) => (
                          editingReplyEntry?.id === entry.id ? (
                            <InlineEditReplyComposer
                              key={entry.id}
                              entry={entry}
                              generatedParentEntry={selectedEntry}
                              busy={busyEntryId === entry.id}
                              onCancel={() => setEditingReplyEntry(null)}
                              onDelete={requestNoteDelete}
                              onSaved={handleReplyEditSaved}
                            />
                          ) : (
                            <JournalPanelReplyPreview
                              key={entry.id}
                              entry={entry}
                              busy={busyEntryId === entry.id}
                              onToggleSaved={(item) => void handleToggleSaved(item)}
                              onLink={startLinking}
                              onEdit={(note) => {
                                setGeneratedComposerTarget(null);
                                setEditingReplyEntry(note);
                              }}
                            />
                          )
                        ))}
                      </div>
                    )}
                    {isManualEntry(selectedEntry) && !relatedEntriesLoading && relatedEntries.length > 0 && (
                      <section className="mt-8 space-y-3">
                        <h3 className="text-sm font-medium">Related entries</h3>
                        <div className="space-y-2">
                          {relatedEntries.map((entry) => (
                            <JournalPanelRelatedEntryPreview key={entry.id} entry={entry} onOpen={openEntry} />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                  {detailsOpen && (
                    <aside className="space-y-4 border-t bg-muted/30 p-4 md:border-l md:border-t-0">
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">Entry date</p>
                        <p className="text-sm">{formatJournalDate(entryDate(selectedEntry))}</p>
                      </div>
                      {selectedGeneratedSessionTime && (
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Time</p>
                          <p className="text-sm">{selectedGeneratedSessionTime}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">Added</p>
                        <p className="text-sm">{formatJournalDate(selectedEntry.updatedAt)}</p>
                      </div>
                      {entryPage(selectedEntry) && (
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Page</p>
                          <p className="text-sm">{entryPage(selectedEntry)}</p>
                        </div>
                      )}
                      {isBookJournalEntryRecordEntry(selectedEntry) && selectedEntry.relatedBookTitle && selectedEntry.relatedContext && (
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Book</p>
                          <p className="text-sm font-serif italic">{selectedEntry.relatedBookTitle}</p>
                        </div>
                      )}
                      {selectedEntryTags.length > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Tags</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {selectedEntryTags.map((tag) => (
                              <Badge key={tag} variant="outline">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">Type</p>
                        <p className="text-sm">
                          {isGeneratedBookEntry(selectedEntry)
                            ? "Automatic"
                            : selectedEntry.type === "passage"
                              ? "Quote"
                              : isThoughtJournalEntry(selectedEntry)
                                ? "Thought"
                                : selectedEntry.type}
                        </p>
                      </div>
                      {((isManualEntry(selectedEntry) && !isReplyEntry(selectedEntry)) || isGeneratedBookEntry(selectedEntry)) && (
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">Notes</p>
                          <p className="text-sm">
                            {isGeneratedBookEntry(selectedEntry) ? selectedGeneratedAttachedNotes.length : replyEntries.length}
                          </p>
                        </div>
                      )}
                      <div className="space-y-2 pt-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {!isGeneratedBookEntry(selectedEntry) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Edit"
                              onClick={() => startEditing(selectedEntry)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={selectedEntryHidden ? "Show entry" : "Hide entry"}
                            disabled={busyEntryId === selectedEntry.id}
                            onClick={() => void (selectedEntryHidden ? handleRestore(selectedEntry) : handleHide(selectedEntry))}
                          >
                            {selectedEntryHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          {!isGeneratedBookEntry(selectedEntry) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete"
                              className="text-destructive hover:text-destructive"
                              disabled={busyEntryId === selectedEntry.id}
                              onClick={() => requestEntryDelete(selectedEntry)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </aside>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(linkingEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setLinkingEntry(null);
            setLinkingError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Link related entry</DialogTitle>
          <DialogDescription>
            Choose another saved entry to connect with this one.
          </DialogDescription>
          <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
            {availableLinkTargets.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No other entries are available to link here.
              </p>
            ) : (
              availableLinkTargets.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/35 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={linkingBusyEntryId === entry.id}
                  onClick={() => void handleLinkTarget(entry)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{entryTitle(entry)}</p>
                    <p className="shrink-0 text-xs text-muted-foreground">{formatJournalDate(entryDate(entry))}</p>
                  </div>
                  <FormattedNoteContent markdown={getManualNote(entry).content} className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
          {linkingError && <p className="text-sm text-destructive">{linkingError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkingEntry(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>
            {pendingDelete?.type === "note" ? "Delete this note?" : "Delete this entry?"}
          </DialogTitle>
          <DialogDescription>
            {pendingDelete?.type === "note"
              ? "This will permanently delete this note. This cannot be undone."
              : "This will permanently delete this journal entry and any notes attached to it. This cannot be undone."}
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingDelete ? busyEntryId === pendingDelete.entry.id : false}
              onClick={() => void confirmPendingDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
