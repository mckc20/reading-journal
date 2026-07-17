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
  MoreVertical,
  Pencil,
  Quote,
  Reply,
  Star,
  StickyNote,
  StickyNoteOff,
  StickyNotePlus,
  TrendingUp,
  Trash2,
  Unlink,
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
  unlinkAuthorJournalEntries,
  updateAuthorJournalEntryRecord,
} from "@/lib/authorJournal";
import {
  deleteBookJournalEntryRecord,
  getBookJournalReplies,
  getRelatedBookJournalEntries,
  linkBookJournalEntries,
  unlinkBookJournalEntries,
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
  unlinkSeriesJournalEntries,
  updateSeriesJournalEntryRecord,
} from "@/lib/seriesJournal";
import { cn } from "@/lib/utils";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord, SeriesJournalEntryRecord } from "@/types";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
type PendingRelationshipAction =
  | { type: "unlink"; source: ManualJournalTimelineEntry; target: ManualJournalTimelineEntry }
  | { type: "unattach"; entry: ManualJournalTimelineEntry };

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

function isAttachedNote(entry: JournalTimelineEntry): entry is ManualJournalTimelineEntry {
  return isManualEntry(entry) && (isReplyEntry(entry) || isAttachedGeneratedNote(entry));
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

function linkedEntryCountLabel(count: number): string {
  return `Linked to ${count} ${count === 1 ? "entry" : "entries"}`;
}

function LinkedEntryCountText({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute bottom-3 right-3 z-10 text-xs text-muted-foreground">
      {linkedEntryCountLabel(count)}
    </span>
  );
}

function JournalEntryActionsMenu({
  entry,
  busy,
  isHidden,
  onReply,
  onLink,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  className,
}: {
  entry: JournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  onReply?: (entry: JournalTimelineEntry) => void;
  onLink?: (entry: ManualJournalTimelineEntry) => void;
  onUnattach?: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden?: (entry: JournalTimelineEntry) => void;
  onEdit?: (entry: ManualJournalTimelineEntry) => void;
  onDelete?: (entry: ManualJournalTimelineEntry) => void;
  className?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const canReply = Boolean(onReply) && (
    isGeneratedAttachableEntry(entry) ||
    (isManualEntry(entry) && !isReplyEntry(entry) && !isAttachedGeneratedNote(entry))
  );
  const canLink = isManualEntry(entry) && Boolean(onLink);
  const canUnattach = isAttachedNote(entry) && Boolean(onUnattach);
  const canEdit = isManualEntry(entry) && Boolean(onEdit);
  const canDelete = isManualEntry(entry) && Boolean(onDelete);
  const hasActions = canReply || canLink || canUnattach || Boolean(onToggleHidden) || canEdit || canDelete;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: Event) {
      const target = event.target as Node | null;
      if (target && (buttonRef.current?.contains(target) || menuRef.current?.contains(target))) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!hasActions) return null;

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className={cn("relative", className)} onClick={(event) => event.stopPropagation()}>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 text-muted-foreground hover:text-primary"
        aria-label="Entry actions"
        aria-expanded={open}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]"
        >
          {canReply && onReply && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => runAction(() => onReply(entry))}
            >
              <StickyNotePlus className="h-4 w-4" />
              Add Note
            </button>
          )}
          {canLink && isManualEntry(entry) && onLink && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => runAction(() => onLink(entry))}
            >
              <LinkIcon className="h-4 w-4" />
              Link
            </button>
          )}
          {canUnattach && isManualEntry(entry) && onUnattach && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => runAction(() => onUnattach(entry))}
            >
              <StickyNoteOff className="h-4 w-4" />
              Unattach
            </button>
          )}
          {onToggleHidden && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => runAction(() => onToggleHidden(entry))}
            >
              {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {isHidden ? "Show" : "Hide"}
            </button>
          )}
          {canEdit && isManualEntry(entry) && onEdit && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => runAction(() => onEdit(entry))}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {canDelete && isManualEntry(entry) && onDelete && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
              onClick={() => runAction(() => onDelete(entry))}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineTopActions({
  entry,
  busy,
  isHidden,
  showSave = true,
  onToggleSaved,
  onReply,
  onLink,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
}: {
  entry: ManualJournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  showSave?: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply?: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
}) {
  const saved = isSavedEntry(entry);

  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
      {showSave && (
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
      <JournalEntryActionsMenu
        entry={entry}
        busy={busy}
        isHidden={isHidden}
        onReply={onReply}
        onLink={onLink}
        onUnattach={onUnattach}
        onToggleHidden={onToggleHidden}
        onEdit={onEdit}
        onDelete={onDelete}
      />
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

function JournalNoteEntry({
  entry,
  busy,
  isHidden,
  onToggleSaved,
  onReply,
  onLink,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  allowReply,
  linkedEntryCount,
  hideSaveButton = false,
}: {
  entry: BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry;
  busy: boolean;
  isHidden: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  allowReply: boolean;
  linkedEntryCount: number;
  hideSaveButton?: boolean;
}) {
  const note = getManualNote(entry);
  const actionPadding = linkedEntryCount > 0 ? "pr-56" : "pr-24";
  const linkedPadding = linkedEntryCount > 0 ? "pb-9" : "";

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
        actionPadding,
        linkedPadding,
        isEntityOwnedEntry(entry) && "border-note/40",
        isRelatedBookEntry(entry) && "bg-muted/20 opacity-90",
      )}>
        <TimelineTopActions
          entry={entry}
          busy={busy}
          isHidden={isHidden}
          showSave={!hideSaveButton}
          onToggleSaved={onToggleSaved}
          onReply={allowReply ? onReply : undefined}
          onLink={onLink}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
        />
        {displayEntryTitle(entry) && (
          <h3 className="mb-2 text-sm font-heading leading-snug font-medium">{displayEntryTitle(entry)}</h3>
        )}
        <FormattedNoteContent markdown={note.content} className="text-sm leading-6 text-foreground" />
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
        <LinkedEntryCountText count={linkedEntryCount} />
      </div>
    </article>
  );
}

function JournalPassageEntry({
  entry,
  busy,
  isHidden,
  onToggleSaved,
  onReply,
  onLink,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  allowReply,
  linkedEntryCount,
  hideSaveButton = false,
}: {
  entry: BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry;
  busy: boolean;
  isHidden: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  allowReply: boolean;
  linkedEntryCount: number;
  hideSaveButton?: boolean;
}) {
  const note = getManualNote(entry);
  const actionPadding = linkedEntryCount > 0 ? "pr-56" : "pr-24";
  const linkedPadding = linkedEntryCount > 0 ? "pb-9" : "";

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
        actionPadding,
        linkedPadding,
        isRelatedBookEntry(entry) && "border-border bg-muted/20 opacity-90",
      )}>
        <TimelineTopActions
          entry={entry}
          busy={busy}
          isHidden={isHidden}
          showSave={!hideSaveButton}
          onToggleSaved={onToggleSaved}
          onReply={allowReply ? onReply : undefined}
          onLink={onLink}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
        />
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
        <LinkedEntryCountText count={linkedEntryCount} />
      </div>
    </article>
  );
}

function JournalReviewEntry({
  entry,
  busy,
  isHidden,
  onToggleSaved,
  onReply,
  onLink,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  allowReply,
  linkedEntryCount,
  hideSaveButton = false,
}: {
  entry: BookJournalEntryRecordJournalEntry;
  busy: boolean;
  isHidden: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  allowReply: boolean;
  linkedEntryCount: number;
  hideSaveButton?: boolean;
}) {
  const note = entry.bookJournalEntry;
  const actionPadding = linkedEntryCount > 0 ? "pr-56" : "pr-24";
  const linkedPadding = linkedEntryCount > 0 ? "pb-9" : "";

  return (
    <article className="relative pl-8">
      <div className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-insight">
        <MessageSquareText className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className={cn(
        "relative rounded-lg border bg-background p-4 dark:bg-card",
        actionPadding,
        linkedPadding,
        isRelatedBookEntry(entry) && "bg-muted/20 opacity-90",
      )}>
        <TimelineTopActions
          entry={entry}
          busy={busy}
          isHidden={isHidden}
          showSave={!hideSaveButton}
          onToggleSaved={onToggleSaved}
          onReply={allowReply ? onReply : undefined}
          onLink={onLink}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
        />
        {displayEntryTitle(entry) && (
          <h3 className="mb-2 text-sm font-heading leading-snug font-medium">{displayEntryTitle(entry)}</h3>
        )}
        <FormattedNoteContent markdown={note.content} className="text-sm leading-6 text-foreground" />
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
        <LinkedEntryCountText count={linkedEntryCount} />
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
  busy,
  isHidden,
  onReply,
  onToggleHidden,
  allowReply = true,
}: {
  entry: GeneratedBookJournalEntry;
  busy: boolean;
  isHidden: boolean;
  onReply: (entry: JournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
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
      <div className="relative rounded-lg border border-dashed bg-muted/25 p-4 pr-14">
        <div className="absolute right-3 top-3 z-10">
          <JournalEntryActionsMenu
            entry={entry}
            busy={busy}
            isHidden={isHidden}
            onReply={allowReply ? onReply : undefined}
            onToggleHidden={onToggleHidden}
          />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-sm font-heading leading-snug font-medium">{entry.label}</h3>
            {typeof rating === "number" && <RatingStars rating={rating} />}
            {details && <p className="text-sm text-muted-foreground">{details}</p>}
          </div>
        </div>
      </div>
    </article>
  );
}

function JournalTimelineItem({
  entry,
  busy,
  isHidden,
  onToggleSaved,
  onReply,
  onLink,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  hideSaveButton = false,
  allowReply = true,
  linkedEntryCount = 0,
}: {
  entry: JournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  hideSaveButton?: boolean;
  allowReply?: boolean;
  linkedEntryCount?: number;
}) {
  if (isGeneratedBookEntry(entry)) return <GeneratedBookEventEntry entry={entry} busy={busy} isHidden={isHidden} onReply={onReply} onToggleHidden={onToggleHidden} allowReply={allowReply} />;
  if (entry.type === "passage" && (isBookJournalEntryRecordEntry(entry) || isSeriesJournalEntryRecordEntry(entry) || isAuthorJournalEntryRecordEntry(entry))) {
    return <JournalPassageEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} linkedEntryCount={linkedEntryCount} hideSaveButton={hideSaveButton} />;
  }
  if (isSeriesJournalEntryRecordEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} linkedEntryCount={linkedEntryCount} hideSaveButton={hideSaveButton} />;
  if (isAuthorJournalEntryRecordEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} linkedEntryCount={linkedEntryCount} hideSaveButton={hideSaveButton} />;
  if (!isBookJournalEntryRecordEntry(entry)) return null;
  if (entry.type === "review") return <JournalReviewEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} linkedEntryCount={linkedEntryCount} hideSaveButton={hideSaveButton} />;
  if (isThoughtJournalEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onLink={onLink} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} linkedEntryCount={linkedEntryCount} hideSaveButton={hideSaveButton} />;
  return null;
}

function TimelineRow({
  entry,
  index,
  total,
  busy,
  isHidden,
  onOpen,
  onToggleSaved,
  onReply,
  onLink,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  parentContextLabel,
  linkedEntryCount = 0,
  hideSaveButton = false,
  showConnector = true,
}: {
  entry: JournalTimelineEntry;
  index: number;
  total: number;
  busy: boolean;
  isHidden: boolean;
  onOpen: (entry: JournalTimelineEntry) => void;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  parentContextLabel?: string | null;
  linkedEntryCount?: number;
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
        {parentContextLabel && (
          <p className="mb-2 text-xs text-muted-foreground">with {parentContextLabel}</p>
        )}
        <JournalTimelineItem
          entry={entry}
          busy={busy}
          isHidden={isHidden}
          onToggleSaved={onToggleSaved}
          onReply={onReply}
          onLink={onLink}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
          hideSaveButton={hideSaveButton}
          linkedEntryCount={linkedEntryCount}
        />
      </div>
    </div>
  );
}

function TimelineReplyRow({
  entry,
  parentEntry,
  busy,
  isHidden,
  linkedEntryCount = 0,
  onToggleSaved,
  onLink,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  onOpenParent,
}: {
  entry: ManualJournalTimelineEntry;
  parentEntry: JournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  linkedEntryCount?: number;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
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
          isHidden={isHidden}
          onToggleSaved={onToggleSaved}
          onReply={() => undefined}
          onLink={onLink}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
          allowReply={false}
          linkedEntryCount={linkedEntryCount}
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

function JournalPanelReplyPreview({
  entry,
  busy,
  isHidden,
  linkedEntryCount,
  relatedEntries,
  relatedBusyEntryId,
  onToggleSaved,
  onLink,
  onEdit,
  onUnattach,
  onToggleHidden,
  onDelete,
  onOpenRelated,
  onUnlinkRelated,
}: {
  entry: ManualJournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  linkedEntryCount: number;
  relatedEntries: ManualJournalTimelineEntry[];
  relatedBusyEntryId: string | null;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onLink: (entry: ManualJournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  onOpenRelated: (entry: JournalTimelineEntry) => void;
  onUnlinkRelated: (source: ManualJournalTimelineEntry, target: ManualJournalTimelineEntry) => void;
}) {
  const note = getManualNote(entry);
  const saved = isSavedEntry(entry);

  return (
    <article className="group/reply relative pl-8">
      <CornerDownRight className="absolute left-0 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <div className={cn(
        "relative rounded-lg border bg-background p-4 pr-20 dark:bg-card",
        linkedEntryCount > 0 && "pb-9",
      )}>
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
          <JournalEntryActionsMenu
            entry={entry}
            busy={busy}
            isHidden={isHidden}
            onLink={onLink}
            onUnattach={onUnattach}
            onToggleHidden={onToggleHidden}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
        <FormattedNoteContent markdown={note.content} className="text-sm leading-6 text-foreground" />
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
        <LinkedEntryCountText count={linkedEntryCount} />
        {relatedEntries.length > 0 && (
          <section className="mt-4 space-y-2 border-t pt-3">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">Related entries</h4>
            <div className="space-y-2">
              {relatedEntries.map((relatedEntry) => (
                <JournalPanelRelatedEntryPreview
                  key={relatedEntry.id}
                  sourceEntry={entry}
                  entry={relatedEntry}
                  busy={relatedBusyEntryId === relatedEntry.id}
                  onOpen={onOpenRelated}
                  onUnlink={onUnlinkRelated}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}

function JournalPanelRelatedEntryPreview({
  sourceEntry,
  entry,
  busy,
  onOpen,
  onUnlink,
}: {
  sourceEntry: ManualJournalTimelineEntry;
  entry: ManualJournalTimelineEntry;
  busy: boolean;
  onOpen: (entry: JournalTimelineEntry) => void;
  onUnlink: (source: ManualJournalTimelineEntry, target: ManualJournalTimelineEntry) => void;
}) {
  const note = getManualNote(entry);

  return (
    <div
      role="button"
      tabIndex={0}
      className="group/related relative w-full cursor-pointer rounded-lg border bg-background p-3 pb-10 text-left transition-colors hover:border-primary/35 hover:bg-surface-hover"
      onClick={() => onOpen(entry)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(entry);
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium">{entryTitle(entry)}</p>
        <p className="shrink-0 text-xs text-muted-foreground">{formatJournalDate(entryDate(entry))}</p>
      </div>
      <FormattedNoteContent markdown={note.content} className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute bottom-2 right-2 h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/related:opacity-100 focus-visible:opacity-100"
        aria-label="Unlink entry"
        title="Unlink entry"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onUnlink(sourceEntry, entry);
        }}
      >
        <Unlink className="h-4 w-4" />
      </Button>
    </div>
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

async function unlinkManualJournalEntries(source: ManualJournalTimelineEntry, target: ManualJournalTimelineEntry): Promise<void> {
  if (!sameManualLinkTable(source, target)) {
    throw new Error("Entries can only be unlinked within the same journal source.");
  }

  if (isBookJournalEntryRecordEntry(source) && isBookJournalEntryRecordEntry(target)) {
    await unlinkBookJournalEntries(source.bookJournalEntry.id, target.bookJournalEntry.id);
    return;
  }

  if (isSeriesJournalEntryRecordEntry(source) && isSeriesJournalEntryRecordEntry(target)) {
    await unlinkSeriesJournalEntries(source.seriesJournalEntry.id, target.seriesJournalEntry.id);
    return;
  }

  if (isAuthorJournalEntryRecordEntry(source) && isAuthorJournalEntryRecordEntry(target)) {
    await unlinkAuthorJournalEntries(source.authorJournalEntry.id, target.authorJournalEntry.id);
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
  const [pendingRelationshipAction, setPendingRelationshipAction] = useState<PendingRelationshipAction | null>(null);
  const [linkingEntry, setLinkingEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [linkingError, setLinkingError] = useState<string | null>(null);
  const [linkingBusyEntryId, setLinkingBusyEntryId] = useState<string | null>(null);
  const [unlinkingEntryId, setUnlinkingEntryId] = useState<string | null>(null);
  const [relatedEntries, setRelatedEntries] = useState<ManualJournalTimelineEntry[]>([]);
  const [relatedEntriesLoading, setRelatedEntriesLoading] = useState(false);
  const [relatedEntriesRefreshKey, setRelatedEntriesRefreshKey] = useState(0);
  const [attachedRelatedEntriesById, setAttachedRelatedEntriesById] = useState<Record<string, ManualJournalTimelineEntry[]>>({});
  const [linkedEntryCountsById, setLinkedEntryCountsById] = useState<Record<string, number>>({});
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
  function isEntryHidden(entry: JournalTimelineEntry): boolean {
    return hiddenEntries.has(getJournalVisibilityKey(getEntryVisibilityInput(entry)));
  }
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
  const panelAttachedNoteEntries = selectedEntry && isGeneratedBookEntry(selectedEntry)
    ? selectedGeneratedAttachedNotes
    : selectedEntry && isManualEntry(selectedEntry)
      ? replyEntries
      : [];
  const panelAttachedNoteEntryKey = panelAttachedNoteEntries.map((entry) => entry.id).join("|");
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
  const timelineLinkedCountEntries = useMemo(() => {
    const entriesById = new Map<string, ManualJournalTimelineEntry>();
    displayEntries.forEach((entry) => {
      if (isManualEntry(entry)) entriesById.set(entry.id, entry);
    });
    Object.values(timelineRepliesByParentId).flat().forEach((entry) => {
      entriesById.set(entry.id, entry);
    });

    return [...entriesById.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [displayEntries, timelineRepliesByParentId]);
  const timelineLinkedCountEntryKey = timelineLinkedCountEntries.map((entry) => entry.id).join("|");
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
    if (timelineLinkedCountEntries.length === 0) {
      setLinkedEntryCountsById({});
      return;
    }

    let cancelled = false;
    const entriesToLoad = timelineLinkedCountEntries;
    Promise.all(
      entriesToLoad.map((entry) => (
        fetchRelatedManualJournalEntries(entry)
          .then((entries) => [entry.id, entries.length] as const)
          .catch(() => [entry.id, 0] as const)
      )),
    ).then((pairs) => {
      if (cancelled) return;
      setLinkedEntryCountsById(Object.fromEntries(pairs.filter(([, count]) => count > 0)));
    });

    return () => {
      cancelled = true;
    };
  }, [relatedEntriesRefreshKey, timelineLinkedCountEntryKey]);

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
    if (panelAttachedNoteEntries.length === 0) {
      setAttachedRelatedEntriesById({});
      return;
    }

    let cancelled = false;
    const entriesToLoad = panelAttachedNoteEntries;

    Promise.all(
      entriesToLoad.map((entry) => (
        fetchRelatedManualJournalEntries(entry)
          .then((entries) => [entry.id, entries] as const)
          .catch(() => [entry.id, []] as const)
      )),
    ).then((pairs) => {
      if (cancelled) return;

      setAttachedRelatedEntriesById(
        Object.fromEntries(pairs.filter(([, entries]) => entries.length > 0)),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [panelAttachedNoteEntryKey, relatedEntriesRefreshKey]);

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
    setComposerParentEntry(null);
    setGeneratedComposerTarget(null);
    setDetailsOpen(false);

    if (isAttachedNote(entry)) {
      setSelectedEntry(getPanelTargetForEntry(entry));
      setEditingEntry(null);
      setEditingReplyEntry(entry);
      return;
    }

    setSelectedEntry(entry);
    setEditingEntry(entry);
    setEditingReplyEntry(null);
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

  function requestUnlinkRelatedEntry(source: ManualJournalTimelineEntry, target: ManualJournalTimelineEntry) {
    setPendingRelationshipAction({ type: "unlink", source, target });
  }

  function requestUnattachNote(entry: ManualJournalTimelineEntry) {
    setPendingRelationshipAction({ type: "unattach", entry });
  }

  async function performUnlinkRelatedEntry(source: ManualJournalTimelineEntry, target: ManualJournalTimelineEntry) {
    setUnlinkingEntryId(target.id);
    try {
      await unlinkManualJournalEntries(source, target);
      setRelatedEntriesRefreshKey((current) => current + 1);
      setPendingRelationshipAction(null);
    } finally {
      setUnlinkingEntryId(null);
    }
  }

  function updateOptimisticReadingSessionSplitsAfterUnattach(entry: ManualJournalTimelineEntry) {
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
  }

  async function performUnattachNote(entry: ManualJournalTimelineEntry) {
    setBusyEntryId(entry.id);
    try {
      const note = getManualNote(entry);
      const tags = normalizeJournalTags(note.tags).filter(
        (tag) => !tag.startsWith(GENERATED_EVENT_NOTE_TAG_PREFIX) && !tag.startsWith(READING_LOG_NOTE_TAG_PREFIX),
      );
      let updatedNote: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord;

      if (isBookJournalEntryRecordEntry(entry)) {
        updatedNote = await updateBookJournalEntryRecord({
          noteId: entry.bookJournalEntry.id,
          label: entry.bookJournalEntry.label,
          title: entry.bookJournalEntry.title ?? undefined,
          quoteSpeaker: entry.bookJournalEntry.quote_speaker ?? undefined,
          content: entry.bookJournalEntry.content,
          tags,
          pageStart: entry.bookJournalEntry.page_start ?? undefined,
          noteDate: entry.bookJournalEntry.entry_date,
          isFavorite: entry.bookJournalEntry.is_favorite,
          parentEntryId: null,
        });
      } else if (isSeriesJournalEntryRecordEntry(entry)) {
        updatedNote = await updateSeriesJournalEntryRecord({
          noteId: entry.seriesJournalEntry.id,
          label: entry.seriesJournalEntry.label,
          title: entry.seriesJournalEntry.title ?? undefined,
          quoteSpeaker: entry.seriesJournalEntry.quote_speaker ?? undefined,
          content: entry.seriesJournalEntry.content,
          tags,
          pageStart: entry.seriesJournalEntry.page_start ?? undefined,
          noteDate: entry.seriesJournalEntry.entry_date,
          isFavorite: entry.seriesJournalEntry.is_favorite,
          parentEntryId: null,
        });
      } else {
        updatedNote = await updateAuthorJournalEntryRecord({
          noteId: entry.authorJournalEntry.id,
          label: entry.authorJournalEntry.label,
          title: entry.authorJournalEntry.title ?? undefined,
          quoteSpeaker: entry.authorJournalEntry.quote_speaker ?? undefined,
          content: entry.authorJournalEntry.content,
          tags,
          pageStart: entry.authorJournalEntry.page_start ?? undefined,
          noteDate: entry.authorJournalEntry.entry_date,
          isFavorite: entry.authorJournalEntry.is_favorite,
          parentEntryId: null,
        });
      }

      const updatedEntry = replaceManualEntryRecord(entry, updatedNote) as ManualJournalTimelineEntry;
      const parentEntryId = note.parent_entry_id;
      setReplyEntries((current) => current.filter((item) => item.id !== entry.id));
      if (parentEntryId) {
        setTimelineRepliesByParentId((current) => ({
          ...current,
          [parentEntryId]: (current[parentEntryId] ?? []).filter((item) => item.id !== entry.id),
        }));
      }
      setAttachedRelatedEntriesById((current) => {
        const { [entry.id]: _removed, ...next } = current;
        return next;
      });
      updateOptimisticReadingSessionSplitsAfterUnattach(entry);
      setEditingReplyEntry(null);
      setPendingRelationshipAction(null);
      onEntryUpdated?.(updatedEntry);
    } finally {
      setBusyEntryId(null);
    }
  }

  async function confirmPendingRelationshipAction() {
    if (!pendingRelationshipAction) return;

    if (pendingRelationshipAction.type === "unlink") {
      await performUnlinkRelatedEntry(pendingRelationshipAction.source, pendingRelationshipAction.target);
      return;
    }

    await performUnattachNote(pendingRelationshipAction.entry);
  }

  function toggleEntryHidden(entry: JournalTimelineEntry) {
    void (isEntryHidden(entry) ? handleRestore(entry) : handleHide(entry));
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
                    linkedEntryCount={linkedEntryCountsById[entry.id] ?? 0}
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
                  busy={busyEntryId === entry.id || unlinkingEntryId === entry.id}
                  isHidden={isEntryHidden(entry)}
                  onOpen={openEntry}
                  onToggleSaved={(item) => void handleToggleSaved(item)}
                  onReply={startReply}
                  onLink={startLinking}
                  onUnattach={requestUnattachNote}
                  onToggleHidden={toggleEntryHidden}
                  onEdit={startEditing}
                  onDelete={requestEntryDelete}
                  parentContextLabel={parentContextLabelsByEntryId.get(entry.id)}
                  linkedEntryCount={linkedEntryCountsById[entry.id] ?? 0}
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
                    busy={busyEntryId === reply.id || unlinkingEntryId === reply.id}
                    isHidden={isEntryHidden(reply)}
                    linkedEntryCount={linkedEntryCountsById[reply.id] ?? 0}
                    onToggleSaved={(item) => void handleToggleSaved(item)}
                    onLink={startLinking}
                    onUnattach={requestUnattachNote}
                    onToggleHidden={toggleEntryHidden}
                    onEdit={startEditing}
                    onDelete={requestNoteDelete}
                    onOpenParent={openEntry}
                  />
                ))}
                {isGeneratedBookEntry(entry) && generatedAttachedNotes.map((note) => (
                  <TimelineReplyRow
                    key={note.id}
                    entry={note}
                    parentEntry={entry}
                    busy={busyEntryId === note.id || unlinkingEntryId === note.id}
                    isHidden={isEntryHidden(note)}
                    linkedEntryCount={linkedEntryCountsById[note.id] ?? 0}
                    onToggleSaved={(item) => void handleToggleSaved(item)}
                    onLink={startLinking}
                    onUnattach={requestUnattachNote}
                    onToggleHidden={toggleEntryHidden}
                    onEdit={startEditing}
                    onDelete={requestNoteDelete}
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
                  busy={busyEntryId === entry.id || unlinkingEntryId === entry.id}
                  isHidden={isEntryHidden(entry)}
                  onOpen={openEntry}
                  onToggleSaved={(item) => void handleToggleSaved(item)}
                  onReply={startReply}
                  onLink={startLinking}
                  onUnattach={requestUnattachNote}
                  onToggleHidden={toggleEntryHidden}
                  onEdit={startEditing}
                  onDelete={requestEntryDelete}
                  parentContextLabel={parentContextLabelsByEntryId.get(entry.id)}
                  linkedEntryCount={linkedEntryCountsById[entry.id] ?? 0}
                  hideSaveButton
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
                    <JournalPanelEntryContent entry={selectedEntry} />
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
                                    busy={busyEntryId === entry.id || unlinkingEntryId === entry.id}
                                    onCancel={() => setEditingReplyEntry(null)}
                                    onDelete={requestNoteDelete}
                                    onSaved={handleReplyEditSaved}
                                  />
                                ) : (
                                  <JournalPanelReplyPreview
                                    key={entry.id}
                                    entry={entry}
                                    busy={busyEntryId === entry.id}
                                    isHidden={isEntryHidden(entry)}
                                    linkedEntryCount={linkedEntryCountsById[entry.id] ?? 0}
                                    relatedEntries={attachedRelatedEntriesById[entry.id] ?? []}
                                    relatedBusyEntryId={unlinkingEntryId}
                                    onToggleSaved={(item) => void handleToggleSaved(item)}
                                    onLink={startLinking}
                                    onEdit={(reply) => {
                                      setComposerParentEntry(null);
                                      setEditingReplyEntry(reply);
                                    }}
                                    onUnattach={requestUnattachNote}
                                    onToggleHidden={toggleEntryHidden}
                                    onDelete={requestNoteDelete}
                                    onOpenRelated={openEntry}
                                    onUnlinkRelated={requestUnlinkRelatedEntry}
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
                              busy={busyEntryId === entry.id || unlinkingEntryId === entry.id}
                              onCancel={() => setEditingReplyEntry(null)}
                              onDelete={requestNoteDelete}
                              onSaved={handleReplyEditSaved}
                            />
                          ) : (
                            <JournalPanelReplyPreview
                              key={entry.id}
                              entry={entry}
                              busy={busyEntryId === entry.id}
                              isHidden={isEntryHidden(entry)}
                              linkedEntryCount={linkedEntryCountsById[entry.id] ?? 0}
                              relatedEntries={attachedRelatedEntriesById[entry.id] ?? []}
                              relatedBusyEntryId={unlinkingEntryId}
                              onToggleSaved={(item) => void handleToggleSaved(item)}
                              onLink={startLinking}
                              onEdit={(note) => {
                                setGeneratedComposerTarget(null);
                                setEditingReplyEntry(note);
                              }}
                              onUnattach={requestUnattachNote}
                              onToggleHidden={toggleEntryHidden}
                              onDelete={requestNoteDelete}
                              onOpenRelated={openEntry}
                              onUnlinkRelated={requestUnlinkRelatedEntry}
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
                            <JournalPanelRelatedEntryPreview
                              key={entry.id}
                              sourceEntry={selectedEntry}
                              entry={entry}
                              busy={unlinkingEntryId === entry.id}
                              onOpen={openEntry}
                              onUnlink={requestUnlinkRelatedEntry}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                  {detailsOpen && (
                    <aside className="space-y-4 border-t bg-muted/30 p-4 md:border-l md:border-t-0">
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">Actions</p>
                        <div className="mt-2 space-y-1">
                          {((isManualEntry(selectedEntry) && !isReplyEntry(selectedEntry)) || isGeneratedAttachableEntry(selectedEntry)) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => startReply(selectedEntry)}
                            >
                              <StickyNotePlus className="mr-2 h-4 w-4" />
                              Add Note
                            </Button>
                          )}
                          {isManualEntry(selectedEntry) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => startLinking(selectedEntry)}
                            >
                              <LinkIcon className="mr-2 h-4 w-4" />
                              Link
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            disabled={busyEntryId === selectedEntry.id}
                            onClick={() => toggleEntryHidden(selectedEntry)}
                          >
                            {selectedEntryHidden ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                            {selectedEntryHidden ? "Show" : "Hide"}
                          </Button>
                          {isManualEntry(selectedEntry) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => startEditing(selectedEntry)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          )}
                          {isManualEntry(selectedEntry) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-destructive hover:text-destructive"
                              disabled={busyEntryId === selectedEntry.id}
                              onClick={() => requestEntryDelete(selectedEntry)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
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

      <Dialog open={Boolean(pendingRelationshipAction)} onOpenChange={(open) => !open && setPendingRelationshipAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>
            {pendingRelationshipAction?.type === "unattach" ? "Unattach this note?" : "Unlink entries?"}
          </DialogTitle>
          <DialogDescription>
            {pendingRelationshipAction?.type === "unlink"
              ? "This will remove the relationship between these entries. The entries themselves will stay in your journal."
              : "This will remove the note from its parent entry and turn it into a normal journal entry."}
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingRelationshipAction(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                pendingRelationshipAction?.type === "unlink"
                  ? unlinkingEntryId === pendingRelationshipAction.target.id
                  : pendingRelationshipAction?.type === "unattach"
                    ? busyEntryId === pendingRelationshipAction.entry.id
                    : false
              }
              onClick={() => void confirmPendingRelationshipAction()}
            >
              {pendingRelationshipAction?.type === "unattach" ? "Unattach" : "Unlink"}
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
