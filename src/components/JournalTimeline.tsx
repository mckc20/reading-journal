import {
  Bookmark,
  ChevronLeft,
  CheckCircle2,
  Clock,
  CornerDownRight,
  Eye,
  EyeOff,
  Flag,
  Info,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Quote,
  Reply,
  Share2,
  Star,
  StickyNote,
  StickyNoteOff,
  StickyNotePlus,
  StickyNotes,
  TrendingUp,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { JournalEntryForm } from "@/components/AddJournalEntryDialog";
import FormattedNoteContent from "@/components/FormattedNoteContent";
import JournalEntryMediaContent from "@/components/JournalEntryMediaContent";
import JournalEntryCard from "@/components/JournalEntryCard";
import BookView, { type BookViewEntry } from "@/components/journal-book/BookView";
import QuoteBlock from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import {
  deleteAuthorJournalEntryRecord,
  getAuthorJournalReplies,
  updateAuthorJournalEntryRecord,
} from "@/lib/authorJournal";
import {
  deleteBookJournalEntryRecord,
  getBookJournalReplies,
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
import type { JournalBookPaginatedItem } from "@/lib/journalBookPagination";
import {
  deleteSeriesJournalEntryRecord,
  getSeriesJournalReplies,
  updateSeriesJournalEntryRecord,
} from "@/lib/seriesJournal";
import { cn } from "@/lib/utils";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord, SeriesJournalEntryRecord } from "@/types";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

interface JournalTimelineProps {
  entries: JournalTimelineEntry[];
  generatedReferenceEntries?: GeneratedBookJournalEntry[];
  emptyMessage?: string;
  className?: string;
  layout?: "timeline" | "cards" | "pages" | "list";
  bookViewTitle?: string;
  bookViewSubtitle?: string;
  sortMode?: "entry-date" | "date-added" | "book-progress";
  selectedEntryId?: string | null;
  previewMode?: {
    getEntryHref: (entry: JournalTimelineEntry) => string;
  };
  inlineComposer?: {
    open: boolean;
    entity: { type: "Book"; id: string } | { type: "Series"; id: string } | { type: "Author"; id: string };
    initialBookId?: string;
    onOpenChange: (open: boolean) => void;
  };
  onEntryUpdated?: (entry: JournalTimelineEntry) => void;
  onEntryEdit?: (entry: JournalTimelineEntry) => void;
  onEntryCreated?: (entry: JournalTimelineEntry) => void;
  onEntryDeleted?: (entry: JournalTimelineEntry) => void;
}

type ManualJournalTimelineEntry = BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry;
type BookViewTimelineEntry = ManualJournalTimelineEntry & BookViewEntry & {
  startsDateGroup?: boolean;
};
type BookViewPaginatedTimelineEntry = JournalBookPaginatedItem<BookViewTimelineEntry>;
type GeneratedSession = NonNullable<NonNullable<GeneratedBookJournalEntry["metadata"]>["sessions"]>[number];
type GeneratedNoteTarget = {
  entry: GeneratedBookJournalEntry;
  session?: GeneratedSession;
};
type PendingDeleteTarget =
  | { type: "entry"; entry: ManualJournalTimelineEntry }
  | { type: "note"; entry: ManualJournalTimelineEntry };
type PendingRelationshipAction = { type: "unattach"; entry: ManualJournalTimelineEntry };

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

function getManualNoteMedia(
  entry: BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry,
) {
  return getManualNote(entry).media ?? [];
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

function sameManualJournalSource(left: ManualJournalTimelineEntry, right: ManualJournalTimelineEntry): boolean {
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
  if (isBookJournalEntryRecordEntry(entry) && entry.bookJournalEntry.label === "review") return true;
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

  return null;
}

function isSavedEntry(entry: JournalTimelineEntry): boolean {
  return isManualEntry(entry) ? Boolean(getManualNote(entry).is_favorite) : false;
}

function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[0.65rem] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

function entryTypeLabel(entry: JournalTimelineEntry): string {
  if (isGeneratedBookEntry(entry)) return "Automatic";
  if (entry.type === "passage") return "Quote";
  if (isThoughtJournalEntry(entry)) return "Thought";
  return entry.type;
}

function entryContentText(entry: JournalTimelineEntry): string {
  if (isGeneratedBookEntry(entry)) return [entry.label, entry.description].filter(Boolean).join("\n");
  return getManualNote(entry).content;
}

function getEntryAttribution(entry: JournalTimelineEntry): string | null {
  return isManualEntry(entry) ? getManualNote(entry).attribution ?? null : null;
}

function buildEntryShareText(entry: JournalTimelineEntry): string {
  const lines = [
    entryTitle(entry),
    entryContentText(entry),
    getEntryAttribution(entry) ? `Attribution: ${getEntryAttribution(entry)}` : null,
    entryPage(entry) ? `Page: ${entryPage(entry)}` : null,
    `Date: ${formatJournalDate(entryDate(entry))}`,
    `Type: ${entryTypeLabel(entry)}`,
    isBookJournalEntryRecordEntry(entry) && entry.relatedBookTitle ? `Related book: ${entry.relatedBookTitle}` : null,
    isGeneratedBookEntry(entry) && formatAutomaticEventDetails(entry) ? `Event details: ${formatAutomaticEventDetails(entry)}` : null,
    isGeneratedBookEntry(entry) && formatGeneratedSessionTime(entry) ? `Event time: ${formatGeneratedSessionTime(entry)}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n\n");
}

function JournalEntryActionsMenu({
  entry,
  busy,
  isHidden,
  attachedCount = 0,
  onToggleSaved,
  onReply,
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  allowAttach = true,
  className,
}: {
  entry: JournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  attachedCount?: number;
  onToggleSaved?: (entry: JournalTimelineEntry) => void;
  onReply?: (entry: JournalTimelineEntry) => void;
  onAttach?: (entry: ManualJournalTimelineEntry) => void;
  onUnattach?: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden?: (entry: JournalTimelineEntry) => void;
  onEdit?: (entry: ManualJournalTimelineEntry) => void;
  onDelete?: (entry: ManualJournalTimelineEntry) => void;
  allowAttach?: boolean;
  className?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"actions" | "info">("actions");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [menuPlacement, setMenuPlacement] = useState<"top" | "bottom">("bottom");
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const canReply = Boolean(onReply) && (
    isGeneratedAttachableEntry(entry) ||
    (isManualEntry(entry) && !isReplyEntry(entry) && !isAttachedGeneratedNote(entry))
  );
  const canAttach = allowAttach && isManualEntry(entry) && !isAttachedNote(entry) && Boolean(onAttach);
  const canUnattach = isAttachedNote(entry) && Boolean(onUnattach);
  const canSave = isManualEntry(entry) && Boolean(onToggleSaved);
  const canEdit = isManualEntry(entry) && Boolean(onEdit);
  const canDelete = isManualEntry(entry) && Boolean(onDelete);
  const hasActions = canReply || canSave || canAttach || canUnattach || Boolean(onToggleHidden) || canEdit || canDelete;
  const entryTags = visibleJournalTags(getJournalEntryTags(entry));
  const generatedSessionTime = isGeneratedBookEntry(entry) ? formatGeneratedSessionTime(entry) : null;

  useEffect(() => {
    if (!open) return;

    function updateMenuPlacement() {
      const button = buttonRef.current;
      if (!button) return;

      const buttonRect = button.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 360;
      const menuWidth = menuRef.current?.offsetWidth ?? 264;
      const viewportPadding = 12;
      let clippingTop = viewportPadding;
      let clippingBottom = window.innerHeight - viewportPadding;
      let ancestor = button.parentElement;

      while (ancestor) {
        const styles = window.getComputedStyle(ancestor);
        const clipsOverflow = /(auto|scroll|hidden)/.test(`${styles.overflow}${styles.overflowY}${styles.overflowX}`);

        if (clipsOverflow) {
          const ancestorRect = ancestor.getBoundingClientRect();
          clippingTop = Math.max(clippingTop, ancestorRect.top + viewportPadding);
          clippingBottom = Math.min(clippingBottom, ancestorRect.bottom - viewportPadding);
        }

        ancestor = ancestor.parentElement;
      }

      const spaceBelow = clippingBottom - buttonRect.bottom;
      const spaceAbove = buttonRect.top - clippingTop;
      const placement = spaceBelow < menuHeight && spaceAbove > spaceBelow ? "top" : "bottom";
      const left = Math.min(
        Math.max(viewportPadding, buttonRect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding,
      );
      const top = placement === "top"
        ? Math.max(clippingTop, buttonRect.top - menuHeight - 4)
        : Math.min(clippingBottom - menuHeight, buttonRect.bottom + 4);

      setMenuPlacement(placement);
      setMenuPosition({ left, top });
    }

    updateMenuPlacement();
    window.requestAnimationFrame(updateMenuPlacement);

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
    window.addEventListener("resize", updateMenuPlacement);
    window.addEventListener("scroll", updateMenuPlacement, true);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPlacement);
      window.removeEventListener("scroll", updateMenuPlacement, true);
    };
  }, [open, view]);

  if (!hasActions) return null;

  function runAction(action: () => void) {
    setOpen(false);
    setView("actions");
    action();
  }

  async function shareEntry() {
    try {
      await navigator.clipboard.writeText(buildEntryShareText(entry));
      setShareStatus("copied");
    } catch {
      setShareStatus("failed");
    }
  }

  function ActionTile({
    icon: Icon,
    label,
    disabled,
    active,
    onClick,
  }: {
    icon: LucideIcon;
    label: string;
    disabled?: boolean;
    active?: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[0.7rem] font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled}
        onClick={onClick}
      >
        <Icon className={cn("h-4 w-4", active && "fill-primary text-primary")} />
        <span>{label}</span>
      </button>
    );
  }

  function ActionRow({
    icon: Icon,
    label,
    destructive,
    disabled,
    onClick,
  }: {
    icon: LucideIcon;
    label: string;
    destructive?: boolean;
    disabled?: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        className={cn(
          "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
          destructive && "text-destructive hover:text-destructive",
        )}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className={cn("relative flex items-center gap-1", className)} onClick={(event) => event.stopPropagation()}>
      {isSavedEntry(entry) && (
        <Bookmark className="h-4 w-4 fill-primary text-primary" aria-label="Saved entry" />
      )}
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
          setOpen((current) => {
            if (current) return false;
            setView("actions");
            setShareStatus("idle");
            return true;
          });
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[2147483647] w-64 rounded-2xl border border-border/80 bg-popover p-2 text-popover-foreground shadow-xl"
          data-placement={menuPlacement}
          style={{
            left: menuPosition?.left ?? 0,
            top: menuPosition?.top ?? 0,
            visibility: menuPosition ? "visible" : "hidden",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {view === "info" ? (
            <div className="space-y-3 p-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium hover:bg-muted"
                onClick={() => setView("actions")}
              >
                <ChevronLeft className="h-4 w-4" />
                Info
              </button>
              <div className="space-y-3 px-2 pb-2">
                <InfoField label="Entry date" value={formatJournalDate(entryDate(entry))} />
                {generatedSessionTime && <InfoField label="Time" value={generatedSessionTime} />}
                <InfoField label="Added" value={formatJournalDate(entry.createdAt)} />
                <InfoField label="Updated" value={formatJournalDate(entry.updatedAt)} />
                {entryPage(entry) && <InfoField label="Page" value={entryPage(entry)} />}
                {isBookJournalEntryRecordEntry(entry) && entry.relatedBookTitle && (
                  <InfoField label="Book" value={entry.relatedBookTitle} />
                )}
                {entryTags.length > 0 && (
                  <div>
                    <p className="text-[0.65rem] font-medium uppercase text-muted-foreground">Tags</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entryTags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[0.68rem]">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <InfoField label="Type" value={entryTypeLabel(entry)} />
                {((isManualEntry(entry) && !isReplyEntry(entry)) || isGeneratedBookEntry(entry)) && (
                  <InfoField label="Attached notes" value={String(attachedCount)} />
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-0.5 border-b border-border/70 pb-2">
                <ActionTile
                  icon={StickyNotePlus}
                  label="Add note"
                  disabled={!canReply || busy}
                  onClick={() => onReply && runAction(() => onReply(entry))}
                />
                <ActionTile
                  icon={Bookmark}
                  label={isSavedEntry(entry) ? "Saved" : "Unsaved"}
                  active={isSavedEntry(entry)}
                  disabled={!canSave || busy}
                  onClick={() => onToggleSaved && runAction(() => onToggleSaved(entry))}
                />
                <ActionTile
                  icon={Share2}
                  label={shareStatus === "copied" ? "Copied" : shareStatus === "failed" ? "Failed" : "Share"}
                  onClick={() => void shareEntry()}
                />
              </div>
              <div className="pt-2">
                <ActionRow icon={Info} label="Info" onClick={() => setView("info")} />
                {canEdit && isManualEntry(entry) && onEdit && (
                  <ActionRow icon={Pencil} label="Edit" onClick={() => runAction(() => onEdit(entry))} />
                )}
                {canAttach && isManualEntry(entry) && onAttach && (
                  <ActionRow icon={StickyNotes} label="Attach" onClick={() => runAction(() => onAttach(entry))} />
                )}
                {canUnattach && isManualEntry(entry) && onUnattach && (
                  <ActionRow icon={StickyNoteOff} label="Unattach" onClick={() => runAction(() => onUnattach(entry))} />
                )}
                {onToggleHidden && (
                  <ActionRow
                    icon={isHidden ? Eye : EyeOff}
                    label={isHidden ? "Show" : "Hide"}
                    disabled={busy}
                    onClick={() => runAction(() => onToggleHidden(entry))}
                  />
                )}
                {canDelete && isManualEntry(entry) && onDelete && (
                  <>
                    <div className="my-2 border-t border-border/70" />
                    <ActionRow
                      icon={Trash2}
                      label="Delete"
                      destructive
                      disabled={busy}
                      onClick={() => runAction(() => onDelete(entry))}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

function TimelineTopActions({
  entry,
  busy,
  isHidden,
  attachedCount = 0,
  onToggleSaved,
  onReply,
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  allowAttach = true,
}: {
  entry: ManualJournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  attachedCount?: number;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply?: (entry: JournalTimelineEntry) => void;
  onAttach: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  allowAttach?: boolean;
}) {
  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
      <JournalEntryActionsMenu
        entry={entry}
        busy={busy}
        isHidden={isHidden}
        attachedCount={attachedCount}
        onToggleSaved={onToggleSaved}
        onReply={onReply}
        onAttach={onAttach}
        onUnattach={onUnattach}
        onToggleHidden={onToggleHidden}
        onEdit={onEdit}
        onDelete={onDelete}
        allowAttach={allowAttach}
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
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  allowReply,
  allowAttach = true,
  attachedCount = 0,
}: {
  entry: BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry;
  busy: boolean;
  isHidden: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onAttach: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  allowReply: boolean;
  allowAttach?: boolean;
  attachedCount?: number;
}) {
  const note = getManualNote(entry);

  return (
    <article className="relative pl-8">
      <div className={cn(
        "absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background",
        isRelatedBookEntry(entry) ? "text-muted-foreground" : "text-note",
      )}>
        <StickyNote className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className={cn(
        "relative rounded-lg border bg-background p-4 pr-24 dark:bg-card",
        isEntityOwnedEntry(entry) && "border-note/40",
        isRelatedBookEntry(entry) && "bg-muted/20 opacity-90",
      )}>
        <TimelineTopActions
          entry={entry}
          busy={busy}
          isHidden={isHidden}
          attachedCount={attachedCount}
          onToggleSaved={onToggleSaved}
          onReply={allowReply ? onReply : undefined}
          onAttach={onAttach}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
          allowAttach={allowAttach}
        />
        {displayEntryTitle(entry) && (
          <h3 className="mb-2 text-sm font-heading leading-snug font-medium">{displayEntryTitle(entry)}</h3>
        )}
        <JournalEntryMediaContent
          markdown={note.content}
          media={getManualNoteMedia(entry)}
          className="text-sm leading-6 text-foreground"
          imageClassName="h-32 max-h-32"
          thumbnail
        />
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
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
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  allowReply,
  allowAttach = true,
  attachedCount = 0,
}: {
  entry: BookJournalEntryRecordJournalEntry | SeriesJournalEntryRecordJournalEntry | AuthorJournalEntryRecordJournalEntry;
  busy: boolean;
  isHidden: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onAttach: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  allowReply: boolean;
  allowAttach?: boolean;
  attachedCount?: number;
}) {
  const note = getManualNote(entry);

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
        "relative rounded-lg border border-note/40 bg-background p-4 pr-24 dark:bg-card",
        isRelatedBookEntry(entry) && "border-border bg-muted/20 opacity-90",
      )}>
        <TimelineTopActions
          entry={entry}
          busy={busy}
          isHidden={isHidden}
          attachedCount={attachedCount}
          onToggleSaved={onToggleSaved}
          onReply={allowReply ? onReply : undefined}
          onAttach={onAttach}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
          allowAttach={allowAttach}
        />
        <QuoteBlock
          attribution={
            note.attribution ? (
              <span className="font-serif italic">- {note.attribution}</span>
            ) : null
          }
        >
          <JournalEntryMediaContent
            markdown={note.content}
            media={getManualNoteMedia(entry)}
            className="text-base leading-7 text-foreground"
            imageClassName="h-32 max-h-32"
            thumbnail
          />
        </QuoteBlock>
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
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
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  allowReply,
  allowAttach = true,
  attachedCount = 0,
}: {
  entry: BookJournalEntryRecordJournalEntry;
  busy: boolean;
  isHidden: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onAttach: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  allowReply: boolean;
  allowAttach?: boolean;
  attachedCount?: number;
}) {
  const note = entry.bookJournalEntry;

  return (
    <article className="relative pl-8">
      <div className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-insight">
        <MessageSquareText className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className={cn(
        "relative rounded-lg border bg-background p-4 pr-24 dark:bg-card",
        isRelatedBookEntry(entry) && "bg-muted/20 opacity-90",
      )}>
        <TimelineTopActions
          entry={entry}
          busy={busy}
          isHidden={isHidden}
          attachedCount={attachedCount}
          onToggleSaved={onToggleSaved}
          onReply={allowReply ? onReply : undefined}
          onAttach={onAttach}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
          allowAttach={allowAttach}
        />
        {displayEntryTitle(entry) && (
          <h3 className="mb-2 text-sm font-heading leading-snug font-medium">{displayEntryTitle(entry)}</h3>
        )}
        <JournalEntryMediaContent
          markdown={note.content}
          media={getManualNoteMedia(entry)}
          className="text-sm leading-6 text-foreground"
          imageClassName="h-32 max-h-32"
          thumbnail
        />
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
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
  attachedCount = 0,
  onReply,
  onToggleHidden,
  allowReply = true,
}: {
  entry: GeneratedBookJournalEntry;
  busy: boolean;
  isHidden: boolean;
  attachedCount?: number;
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
            attachedCount={attachedCount}
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
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  attachedCount = 0,
  allowReply = true,
  allowAttach = true,
}: {
  entry: JournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onAttach: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  attachedCount?: number;
  allowReply?: boolean;
  allowAttach?: boolean;
}) {
  if (isGeneratedBookEntry(entry)) return <GeneratedBookEventEntry entry={entry} busy={busy} isHidden={isHidden} attachedCount={attachedCount} onReply={onReply} onToggleHidden={onToggleHidden} allowReply={allowReply} />;
  if (entry.type === "passage" && (isBookJournalEntryRecordEntry(entry) || isSeriesJournalEntryRecordEntry(entry) || isAuthorJournalEntryRecordEntry(entry))) {
    return <JournalPassageEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onAttach={onAttach} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} allowAttach={allowAttach} attachedCount={attachedCount} />;
  }
  if (isSeriesJournalEntryRecordEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onAttach={onAttach} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} allowAttach={allowAttach} attachedCount={attachedCount} />;
  if (isAuthorJournalEntryRecordEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onAttach={onAttach} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} allowAttach={allowAttach} attachedCount={attachedCount} />;
  if (!isBookJournalEntryRecordEntry(entry)) return null;
  if (entry.type === "review") return <JournalReviewEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onAttach={onAttach} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} allowAttach={allowAttach} attachedCount={attachedCount} />;
  if (isThoughtJournalEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} isHidden={isHidden} onToggleSaved={onToggleSaved} onReply={onReply} onAttach={onAttach} onUnattach={onUnattach} onToggleHidden={onToggleHidden} onEdit={onEdit} onDelete={onDelete} allowReply={allowReply} allowAttach={allowAttach} attachedCount={attachedCount} />;
  return null;
}

function TimelineRow({
  entry,
  index,
  total,
  busy,
  isHidden,
  attachedCount = 0,
  onToggleSaved,
  onReply,
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  parentContextLabel,
  allowAttach = true,
  showConnector = true,
}: {
  entry: JournalTimelineEntry;
  index: number;
  total: number;
  busy: boolean;
  isHidden: boolean;
  attachedCount?: number;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply: (entry: JournalTimelineEntry) => void;
  onAttach: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  parentContextLabel?: string | null;
  allowAttach?: boolean;
  showConnector?: boolean;
}) {
  const MarkerIcon = getTimelineMarkerIcon(entry);

  return (
    <div className="grid grid-cols-[1.5rem_5.5rem_minmax(0,1fr)] gap-3">
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
          attachedCount={attachedCount}
          onToggleSaved={onToggleSaved}
          onReply={onReply}
          onAttach={onAttach}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
          allowAttach={allowAttach}
        />
      </div>
    </div>
  );
}

function TimelineReplyRow({
  entry,
  busy,
  isHidden,
  onToggleSaved,
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
}: {
  entry: ManualJournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onAttach: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_5.5rem_minmax(0,1fr)] gap-3">
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
          onAttach={onAttach}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
          allowReply={false}
        />
      </div>
    </div>
  );
}

function BookViewEntryContent({ entry }: { entry: BookViewPaginatedTimelineEntry }) {
  const note = getManualNote(entry);
  const title = displayEntryTitle(entry);
  const isFinalSegment = entry.segmentIndex === entry.segmentCount - 1;
  const displayContent = getBookViewSegmentMarkdown(entry);

  if (entry.type === "passage") {
    return (
      <QuoteBlock
        attribution={
          note.attribution && isFinalSegment ? (
            <span className="font-serif italic">- {note.attribution}</span>
          ) : null
        }
        className="gap-x-2"
        markClassName="text-muted-foreground/40"
      >
        <JournalEntryMediaContent
          markdown={displayContent}
          media={isFinalSegment ? getManualNoteMedia(entry) : []}
          className="text-base leading-8 text-foreground"
          imageClassName="max-h-72"
        />
      </QuoteBlock>
    );
  }

  return (
    <div className="space-y-3">
      {title && !entry.isContinuation && <h3 className="font-heading text-xl font-medium leading-snug">{title}</h3>}
      <JournalEntryMediaContent
        markdown={displayContent}
        media={isFinalSegment ? getManualNoteMedia(entry) : []}
        className="text-base leading-8 text-foreground"
        imageClassName="max-h-72"
      />
    </div>
  );
}

function isInsideMarkdownBlockquote(markdown: string, offset: number): boolean {
  if (offset <= 0) return false;

  const beforeSegment = markdown.slice(0, offset);
  const blockStart = beforeSegment.lastIndexOf("\n\n") + 2;
  const lineStart = beforeSegment.lastIndexOf("\n") + 1;
  const currentLinePrefix = markdown.slice(lineStart, offset);

  if (/^\s*>\s?/.test(currentLinePrefix)) return true;

  const previousLinesInBlock = markdown.slice(blockStart, offset).split("\n").filter((line) => line.trim().length > 0);
  return previousLinesInBlock.some((line) => /^\s*>\s?/.test(line));
}

function getBookViewSegmentMarkdown(entry: BookViewPaginatedTimelineEntry): string {
  const repairedContent = repairSplitInlineMarkdown(entry);
  if (!entry.isContinuation || /^\s*>/.test(repairedContent)) return repairedContent;

  const originalContent = getManualNote(entry).content;
  const sourceStart = entry.sourceStart ?? 0;
  if (!isInsideMarkdownBlockquote(originalContent, sourceStart)) return repairedContent;

  return `> ${repairedContent}`;
}

function isEscapedMarkdownCharacter(markdown: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && markdown[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function hasOpenInlineDelimiterBefore(markdown: string, offset: number, delimiter: "*" | "_" | "**" | "__"): boolean {
  const delimiterCharacter = delimiter[0];
  const delimiterLength = delimiter.length;
  let count = 0;

  for (let index = 0; index < offset;) {
    if (markdown[index] !== delimiterCharacter || isEscapedMarkdownCharacter(markdown, index)) {
      index += 1;
      continue;
    }

    let runLength = 0;
    while (index + runLength < offset && markdown[index + runLength] === delimiterCharacter) {
      runLength += 1;
    }

    count += delimiterLength === 1 ? runLength % 2 : Math.floor(runLength / delimiterLength);
    index += runLength;
  }

  return count % 2 === 1;
}

function repairSplitInlineMarkdown(entry: BookViewPaginatedTimelineEntry): string {
  const originalContent = getManualNote(entry).content;
  const sourceStart = entry.sourceStart ?? 0;
  const sourceEnd = entry.sourceEnd ?? sourceStart + entry.content.length;
  let content = entry.content;

  (["**", "__", "*", "_"] as const).forEach((delimiter) => {
    const startsInsideDelimiter = sourceStart > 0 && hasOpenInlineDelimiterBefore(originalContent, sourceStart, delimiter);
    const endsInsideDelimiter = sourceEnd < originalContent.length && hasOpenInlineDelimiterBefore(originalContent, sourceEnd, delimiter);

    if (startsInsideDelimiter) content = `${delimiter}${content}`;
    if (endsInsideDelimiter) content = `${content}${delimiter}`;
  });

  return content;
}

function BookViewEntryMeta({ entry, parentContextLabel }: { entry: BookViewPaginatedTimelineEntry; parentContextLabel?: string | null }) {
  if (entry.segmentIndex !== entry.segmentCount - 1) return null;

  const note = getManualNote(entry);
  const details = [
    entryPage(entry),
    parentContextLabel ? `with ${parentContextLabel}` : null,
    isBookJournalEntryRecordEntry(entry) && entry.relatedBookTitle && entry.relatedContext ? entry.relatedBookTitle : null,
  ].filter((detail): detail is string => Boolean(detail));
  const tags = visibleJournalTags(normalizeJournalTags(note.tags));

  if (details.length === 0 && tags.length === 0) return null;

  return (
    <EntryMetadataLine details={details} tags={tags} />
  );
}

function BookViewJournalEntry({
  entry,
  busy,
  isHidden,
  attachedCount = 0,
  onToggleSaved,
  onReply,
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  parentContextLabel,
  allowAttach = true,
  indented = false,
}: {
  entry: BookViewPaginatedTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  attachedCount?: number;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply?: (entry: JournalTimelineEntry) => void;
  onAttach: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  parentContextLabel?: string | null;
  allowAttach?: boolean;
  indented?: boolean;
}) {
  return (
    <>
      {entry.startsDateGroup && !entry.isContinuation && (
        <header className="border-b border-border/70 pb-3 pt-1">
          <h2 className="font-heading text-2xl font-medium leading-tight">
            {formatJournalDate(entry.date)}
          </h2>
        </header>
      )}
      <article
        className={cn(
          "group/notebook relative border-b border-border/60 py-6 last:border-b-0",
          indented && "ml-6 border-l border-border/60 pl-5",
        )}
      >
        <div className="absolute right-0 top-5 z-10 flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover/notebook:opacity-100 sm:group-focus-within/notebook:opacity-100">
          <TimelineTopActions
            entry={entry}
            busy={busy}
            isHidden={isHidden}
            attachedCount={attachedCount}
            onToggleSaved={onToggleSaved}
            onReply={onReply}
            onAttach={onAttach}
            onUnattach={onUnattach}
            onToggleHidden={onToggleHidden}
            onEdit={onEdit}
            onDelete={onDelete}
            allowAttach={allowAttach}
          />
        </div>
        <div className="pr-16">
          <BookViewEntryContent entry={entry} />
          <BookViewEntryMeta entry={entry} parentContextLabel={parentContextLabel} />
        </div>
      </article>
    </>
  );
}

function ListJournalEntry({
  entry,
  busy,
  isHidden,
  attachedCount = 0,
  onToggleSaved,
  onReply,
  onAttach,
  onUnattach,
  onToggleHidden,
  onEdit,
  onDelete,
  parentContextLabel,
  allowAttach = true,
  indented = false,
}: {
  entry: ManualJournalTimelineEntry;
  busy: boolean;
  isHidden: boolean;
  attachedCount?: number;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  onReply?: (entry: JournalTimelineEntry) => void;
  onAttach: (entry: ManualJournalTimelineEntry) => void;
  onUnattach: (entry: ManualJournalTimelineEntry) => void;
  onToggleHidden: (entry: JournalTimelineEntry) => void;
  onEdit: (entry: ManualJournalTimelineEntry) => void;
  onDelete: (entry: ManualJournalTimelineEntry) => void;
  parentContextLabel?: string | null;
  allowAttach?: boolean;
  indented?: boolean;
}) {
  return (
    <article
      className={cn(
        "group/notebook relative border-b border-border/60 py-6 last:border-b-0",
        indented && "ml-6 border-l border-border/60 pl-5",
      )}
    >
      <div className="absolute right-0 top-5 z-10 flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover/notebook:opacity-100 sm:group-focus-within/notebook:opacity-100">
        <TimelineTopActions
          entry={entry}
          busy={busy}
          isHidden={isHidden}
          attachedCount={attachedCount}
          onToggleSaved={onToggleSaved}
          onReply={onReply}
          onAttach={onAttach}
          onUnattach={onUnattach}
          onToggleHidden={onToggleHidden}
          onEdit={onEdit}
          onDelete={onDelete}
          allowAttach={allowAttach}
        />
      </div>
      <div className="pr-16">
        <NotebookEntryContent entry={entry} />
        <NotebookEntryMeta entry={entry} parentContextLabel={parentContextLabel} />
      </div>
    </article>
  );
}

function NotebookEntryContent({ entry }: { entry: ManualJournalTimelineEntry }) {
  const note = getManualNote(entry);
  const title = displayEntryTitle(entry);

  if (entry.type === "passage") {
    return (
      <QuoteBlock
        attribution={
          note.attribution ? (
            <span className="font-serif italic">- {note.attribution}</span>
          ) : null
        }
        className="gap-x-2"
        markClassName="text-muted-foreground/40"
      >
        <JournalEntryMediaContent
          markdown={note.content}
          media={getManualNoteMedia(entry)}
          className="text-base leading-8 text-foreground"
          imageClassName="max-h-96"
        />
      </QuoteBlock>
    );
  }

  return (
    <div className="space-y-3">
      {title && <h3 className="font-heading text-xl font-medium leading-snug">{title}</h3>}
      <JournalEntryMediaContent
        markdown={note.content}
        media={getManualNoteMedia(entry)}
        className="text-base leading-8 text-foreground"
        imageClassName="max-h-96"
      />
    </div>
  );
}

function NotebookEntryMeta({ entry, parentContextLabel }: { entry: JournalTimelineEntry; parentContextLabel?: string | null }) {
  const note = isManualEntry(entry) ? getManualNote(entry) : null;
  const details = [
    entryPage(entry),
    parentContextLabel ? `with ${parentContextLabel}` : null,
    isBookJournalEntryRecordEntry(entry) && entry.relatedBookTitle && entry.relatedContext ? entry.relatedBookTitle : null,
  ].filter((detail): detail is string => Boolean(detail));
  const tags = note ? visibleJournalTags(normalizeJournalTags(note.tags)) : [];

  if (details.length === 0 && tags.length === 0) return null;

  return <EntryMetadataLine details={details} tags={tags} />;
}

function EntryMetadataLine({ details, tags }: { details: string[]; tags: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
      {details.length > 0 && <span>{details.join(" · ")}</span>}
      {tags.map((tag) => (
        <span key={tag}>#{tag}</span>
      ))}
    </div>
  );
}

function groupJournalEntriesByDate(entries: JournalTimelineEntry[]): Array<{ dateKey: string; entries: JournalTimelineEntry[] }> {
  const groups = new Map<string, JournalTimelineEntry[]>();

  entries.forEach((entry) => {
    const dateKey = entryDate(entry).slice(0, 10);
    groups.set(dateKey, [...(groups.get(dateKey) ?? []), entry]);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, groupedEntries]) => ({ dateKey, entries: groupedEntries }));
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
    return "Thought";
  }
  if (isSeriesJournalEntryRecordEntry(entry)) return "Thought";
  if (isAuthorJournalEntryRecordEntry(entry)) return "Thought";
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

function journalEntryElementId(entryId: string): string {
  return `journal-entry-${entryId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
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
            autoFocus
            autoSave
            initialBookId={initialBookId}
            entity={entity}
            initialEntry={null}
            parentEntryId={parentEntry.sourceId}
            hideEntitySelector
            onCancel={onCancel}
            onEditorBlur={(note) => {
              if (note) onSaved(parentEntry, note);
              onCancel();
            }}
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
            autoFocus
            autoSave
            initialBookId={selectedTarget.entry.entityId}
            entity={{ type: "Book", id: selectedTarget.entry.entityId }}
            initialEntry={null}
            initialPageStart={getGeneratedTargetPage(selectedTarget)}
            initialNoteDate={getGeneratedTargetDate(selectedTarget)}
            systemTags={getGeneratedTargetTags(selectedTarget)}
            hideEntitySelector
            onCancel={onCancel}
            onEditorBlur={(note) => {
              if (note) onSaved(selectedTarget, note);
              onCancel();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function InlineEditReplyComposer({
  entry,
  generatedParentEntry,
  onCancel,
  onSaved,
}: {
  entry: ManualJournalTimelineEntry;
  generatedParentEntry?: GeneratedBookJournalEntry | null;
  onCancel: () => void;
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
        autoFocus
        autoSave
        initialBookId={initialBookId}
        entity={entity}
        initialEntry={getManualNote(entry)}
        initialPageStart={selectedTarget ? getGeneratedTargetPage(selectedTarget) : undefined}
        initialNoteDate={selectedTarget ? getGeneratedTargetDate(selectedTarget) : undefined}
        preferInitialPageAndDate={Boolean(selectedTarget)}
        systemTags={selectedTarget ? getGeneratedTargetTags(selectedTarget) : undefined}
        replaceSystemTagPrefixes={selectedTarget ? [READING_LOG_NOTE_TAG_PREFIX] : undefined}
        hideEntitySelector
        onCancel={onCancel}
        onEditorBlur={(note) => {
          if (note) onSaved(entry, note);
          onCancel();
        }}
      />
    </div>
  );
}

function InlineJournalEntryComposer({
  open,
  entity,
  initialBookId = "",
  onCancel,
  onSaved,
}: {
  open: boolean;
  entity: { type: "Book"; id: string } | { type: "Series"; id: string } | { type: "Author"; id: string };
  initialBookId?: string;
  onCancel: () => void;
  onSaved: (note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
}) {
  const [shouldRender, setShouldRender] = useState(open);

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
        <JournalEntryForm
          active={open}
          variant="inline"
          autoFocus
          autoSave
          initialBookId={initialBookId}
          entity={entity}
          initialEntry={null}
          hideEntitySelector
          onCancel={onCancel}
          onSaved={(note) => {
            onSaved(note);
          }}
          onSubmitSaved={(note) => {
            onSaved(note);
            onCancel();
          }}
          onEditorBlur={(note) => {
            if (note) onSaved(note);
            onCancel();
          }}
        />
      </div>
    </div>
  );
}

function InlineEditEntryComposer({
  entry,
  onCancel,
  onSaved,
}: {
  entry: ManualJournalTimelineEntry;
  onCancel: () => void;
  onSaved: (
    entry: ManualJournalTimelineEntry,
    note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord,
    options?: { close?: boolean },
  ) => void;
}) {
  const entity = getManualEntryDialogEntity(entry);
  const initialBookId = isBookJournalEntryRecordEntry(entry) ? entry.bookJournalEntry.book_id : "";

  return (
    <JournalEntryForm
      active
      variant="inline"
      autoFocus
      autoSave
      initialBookId={initialBookId}
      entity={entity}
      initialEntry={getManualNote(entry)}
      hideEntitySelector
      onCancel={onCancel}
      onSaved={(note) => {
        onSaved(entry, note, { close: false });
      }}
      onSubmitSaved={(note) => {
        onSaved(entry, note, { close: true });
      }}
      onEditorBlur={(note) => {
        if (note) onSaved(entry, note, { close: false });
      }}
    />
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

function TimelineInlineEditReplyComposerRow({
  entry,
  generatedParentEntry,
  onCancel,
  onSaved,
}: {
  entry: ManualJournalTimelineEntry;
  generatedParentEntry?: GeneratedBookJournalEntry | null;
  onCancel: () => void;
  onSaved: (entry: ManualJournalTimelineEntry, note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_5.5rem_minmax(0,1fr)] gap-3">
      <div aria-hidden="true" />
      <div aria-hidden="true" />
      <div>
        <InlineEditReplyComposer
          entry={entry}
          generatedParentEntry={generatedParentEntry}
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

function manualEntryToBookViewEntry(
  entry: ManualJournalTimelineEntry,
  options: { childCount?: number } = {},
): BookViewTimelineEntry {
  const note = getManualNote(entry);
  const tags = visibleJournalTags(normalizeJournalTags(note.tags));

  return {
    ...entry,
    content: note.content,
    date: entryDate(entry),
    label: entryTypeLabel(entry),
    tags,
    tagCount: tags.length,
    hasAttribution: Boolean(note.attribution),
    childCount: options.childCount ?? 0,
  };
}

function manualEntryToSingleBookViewSegment(entry: ManualJournalTimelineEntry): BookViewPaginatedTimelineEntry {
  return {
    ...manualEntryToBookViewEntry(entry),
    originalId: entry.id,
    segmentIndex: 0,
    segmentCount: 1,
    isContinuation: false,
  };
}

export default function JournalTimeline({
  entries,
  generatedReferenceEntries = [],
  emptyMessage = "No journal entries yet.",
  className,
  layout = "timeline",
  bookViewTitle = "Journal",
  bookViewSubtitle = "Reading Journal",
  sortMode = "entry-date",
  selectedEntryId = null,
  previewMode,
  inlineComposer,
  onEntryUpdated,
  onEntryEdit,
  onEntryCreated,
  onEntryDeleted,
}: JournalTimelineProps) {
  const { user } = useAuth();
  const [editingEntry, setEditingEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [composerParentEntry, setComposerParentEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [generatedComposerTarget, setGeneratedComposerTarget] = useState<GeneratedNoteTarget | null>(null);
  const [optimisticUncompressedReadingLogIds, setOptimisticUncompressedReadingLogIds] = useState<Set<string>>(new Set());
  const [editingReplyEntry, setEditingReplyEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteTarget | null>(null);
  const [pendingRelationshipAction, setPendingRelationshipAction] = useState<PendingRelationshipAction | null>(null);
  const [attachingEntry, setAttachingEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [attachingError, setAttachingError] = useState<string | null>(null);
  const [attachingBusyEntryId, setAttachingBusyEntryId] = useState<string | null>(null);
  const [timelineRepliesByParentId, setTimelineRepliesByParentId] = useState<Record<string, ManualJournalTimelineEntry[]>>({});
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
  function isEntryHidden(entry: JournalTimelineEntry): boolean {
    return hiddenEntries.has(getJournalVisibilityKey(getEntryVisibilityInput(entry)));
  }
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
  const availableAttachTargets = useMemo(() => {
    if (!attachingEntry) return [];

    const entriesById = new Map<string, ManualJournalTimelineEntry>();
    displayEntries.forEach((entry) => {
      if (isManualEntry(entry)) entriesById.set(entry.id, entry);
    });
    Object.values(timelineRepliesByParentId).flat().forEach((entry) => {
      entriesById.set(entry.id, entry);
    });

    const currentParentId = getManualNote(attachingEntry).parent_entry_id;

    return [...entriesById.values()]
      .filter((entry) => {
        const note = getManualNote(entry);
        return (
          entry.id !== attachingEntry.id &&
          entry.sourceId !== currentParentId &&
          sameManualJournalSource(attachingEntry, entry) &&
          !note.parent_entry_id &&
          getAttachedGeneratedNoteTags(entry).length === 0
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }, [attachingEntry, displayEntries, timelineRepliesByParentId]);
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
    if (!selectedEntryId) return;
    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById(journalEntryElementId(selectedEntryId));
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus({ preventScroll: true });
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [selectedEntryId, splitEntries.visible]);

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

  function requestTimelineDelete(entry: ManualJournalTimelineEntry) {
    setPendingDelete({ type: isAttachedNote(entry) ? "note" : "entry", entry });
  }

  async function performEntryDelete(entry: ManualJournalTimelineEntry) {
    setBusyEntryId(entry.id);
    try {
      await deleteManualEntry(entry);
      onEntryDeleted?.(entry);
      setPendingDelete(null);
    } finally {
      setBusyEntryId(null);
    }
  }

  function startEditing(entry: JournalTimelineEntry) {
    if (!isManualEntry(entry)) return;
    setComposerParentEntry(null);
    setGeneratedComposerTarget(null);
    const editableId = "originalId" in entry && typeof entry.originalId === "string"
      ? entry.originalId
      : entry.id;
    const editableEntry: ManualJournalTimelineEntry = { ...entry, id: editableId } as ManualJournalTimelineEntry;

    if (isAttachedNote(editableEntry)) {
      setEditingEntry(null);
      setEditingReplyEntry(editableEntry);
      return;
    }

    setEditingEntry(editableEntry);
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

  function startAttaching(entry: ManualJournalTimelineEntry) {
    setAttachingEntry(entry);
    setAttachingError(null);
  }

  async function updateManualEntryParent(
    entry: ManualJournalTimelineEntry,
    parentEntryId: string | null,
  ): Promise<BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord> {
    const note = getManualNote(entry);
    const tags = normalizeJournalTags(note.tags).filter(
      (tag) => parentEntryId
        ? !tag.startsWith(GENERATED_EVENT_NOTE_TAG_PREFIX) && !tag.startsWith(READING_LOG_NOTE_TAG_PREFIX)
        : true,
    );

    if (isBookJournalEntryRecordEntry(entry)) {
      return updateBookJournalEntryRecord({
        noteId: entry.bookJournalEntry.id,
        label: entry.bookJournalEntry.label,
        attribution: entry.bookJournalEntry.attribution ?? undefined,
        content: entry.bookJournalEntry.content,
        tags,
        pageStart: entry.bookJournalEntry.page_start ?? undefined,
        noteDate: entry.bookJournalEntry.entry_date,
        isFavorite: entry.bookJournalEntry.is_favorite,
        parentEntryId,
      });
    }

    if (isSeriesJournalEntryRecordEntry(entry)) {
      return updateSeriesJournalEntryRecord({
        noteId: entry.seriesJournalEntry.id,
        label: entry.seriesJournalEntry.label,
        attribution: entry.seriesJournalEntry.attribution ?? undefined,
        content: entry.seriesJournalEntry.content,
        tags,
        pageStart: entry.seriesJournalEntry.page_start ?? undefined,
        noteDate: entry.seriesJournalEntry.entry_date,
        isFavorite: entry.seriesJournalEntry.is_favorite,
        parentEntryId,
      });
    }

    return updateAuthorJournalEntryRecord({
      noteId: entry.authorJournalEntry.id,
      label: entry.authorJournalEntry.label,
      attribution: entry.authorJournalEntry.attribution ?? undefined,
      content: entry.authorJournalEntry.content,
      tags,
      pageStart: entry.authorJournalEntry.page_start ?? undefined,
      noteDate: entry.authorJournalEntry.entry_date,
      isFavorite: entry.authorJournalEntry.is_favorite,
      parentEntryId,
    });
  }

  async function handleAttachTarget(target: ManualJournalTimelineEntry) {
    if (!attachingEntry) return;

    setBusyEntryId(attachingEntry.id);
    setAttachingBusyEntryId(target.id);
    setAttachingError(null);
    try {
      const previousParentEntryId = getManualNote(attachingEntry).parent_entry_id;
      const updatedNote = await updateManualEntryParent(attachingEntry, target.sourceId);
      const updatedEntry = replaceManualEntryRecord(attachingEntry, updatedNote) as ManualJournalTimelineEntry;

      setTimelineRepliesByParentId((current) => {
        const next = { ...current };
        if (previousParentEntryId) {
          next[previousParentEntryId] = (next[previousParentEntryId] ?? []).filter((item) => item.id !== attachingEntry.id);
        }
        next[target.sourceId] = [
          ...(next[target.sourceId] ?? []).filter((item) => item.id !== attachingEntry.id),
          updatedEntry,
        ];
        return next;
      });
      if (isAttachedGeneratedNote(attachingEntry)) {
        updateOptimisticReadingSessionSplitsAfterUnattach(attachingEntry);
      }
      setEditingReplyEntry((current) => (current?.id === attachingEntry.id ? null : current));
      setAttachingEntry(null);
      onEntryUpdated?.(updatedEntry);
    } catch (error) {
      setAttachingError(error instanceof Error ? error.message : "Could not attach this entry.");
    } finally {
      setBusyEntryId(null);
      setAttachingBusyEntryId(null);
    }
  }

  function requestUnattachNote(entry: ManualJournalTimelineEntry) {
    setPendingRelationshipAction({ type: "unattach", entry });
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
          attribution: entry.bookJournalEntry.attribution ?? undefined,
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
          attribution: entry.seriesJournalEntry.attribution ?? undefined,
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
          attribution: entry.authorJournalEntry.attribution ?? undefined,
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
      if (parentEntryId) {
        setTimelineRepliesByParentId((current) => ({
          ...current,
          [parentEntryId]: (current[parentEntryId] ?? []).filter((item) => item.id !== entry.id),
        }));
      }
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
          attribution: entry.bookJournalEntry.attribution ?? undefined,
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
          attribution: entry.seriesJournalEntry.attribution ?? undefined,
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
          attribution: entry.authorJournalEntry.attribution ?? undefined,
          content: entry.authorJournalEntry.content,
          tags: entry.authorJournalEntry.tags ?? undefined,
          pageStart: entry.authorJournalEntry.page_start ?? undefined,
          noteDate: entry.authorJournalEntry.entry_date,
          isFavorite: nextFavorite,
        });
      }

      const updatedEntry = replaceManualEntryRecord(entry, updatedNote);
      const updatedManualEntry = updatedEntry as ManualJournalTimelineEntry;
      if (isReplyEntry(updatedManualEntry)) {
        const parentEntryId = getManualNote(updatedManualEntry).parent_entry_id;
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

  function handleEditingEntrySaved(
    note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord,
    options: { close?: boolean } = { close: true },
  ) {
    if (!editingEntry) return;
    const updatedEntry = replaceManualEntryRecord(editingEntry, note);
    if (options.close) {
      setEditingEntry(null);
    }
    onEntryUpdated?.(updatedEntry);
    onEntryEdit?.(updatedEntry);
  }

  function handleComposerEntrySaved(
    parentEntry: ManualJournalTimelineEntry,
    note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord,
  ) {
    const replyEntry = manualRecordToJournalEntry(note);
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

  function handleInlineComposerSaved(note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) {
    onEntryCreated?.(manualRecordToJournalEntry(note));
  }

  if (entries.length === 0 && !inlineComposer?.open) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  if (entries.length === 0 && inlineComposer?.open) {
    return (
      <div className={cn("mr-auto max-w-5xl", className)}>
        <InlineJournalEntryComposer
          open={inlineComposer.open}
          entity={inlineComposer.entity}
          initialBookId={inlineComposer.initialBookId}
          onCancel={() => inlineComposer.onOpenChange(false)}
          onSaved={handleInlineComposerSaved}
        />
      </div>
    );
  }

  function attachedCountForEntry(entry: JournalTimelineEntry): number {
    if (isGeneratedBookEntry(entry)) {
      return getGeneratedEntryNoteTags(entry).flatMap((tag) => generatedAttachedNotesByTag.get(tag) ?? []).length;
    }
    if (isManualEntry(entry) && !isReplyEntry(entry)) {
      return timelineRepliesByParentId[entry.sourceId]?.length ?? 0;
    }
    return 0;
  }

  const bookViewEntries: BookViewTimelineEntry[] = layout === "pages"
    ? splitEntries.visible.filter(isManualEntry).map((entry, index, manualEntries) => {
      const previousEntry = manualEntries[index - 1];
      const startsDateGroup = !previousEntry || entryDate(previousEntry).slice(0, 10) !== entryDate(entry).slice(0, 10);

      return {
        ...manualEntryToBookViewEntry(entry, { childCount: attachedCountForEntry(entry) }),
        startsDateGroup,
        headingWeight: startsDateGroup ? 3 : 0,
        forceNewPage: startsDateGroup,
      };
    })
    : [];
  const journalListGroups = layout === "list" ? groupJournalEntriesByDate(splitEntries.visible) : [];

  return (
    <>
      {layout === "list" && splitEntries.visible.length > 0 ? (
        <div className={cn("mr-auto max-w-5xl space-y-12", className)}>
          {inlineComposer && (
            <InlineJournalEntryComposer
              open={inlineComposer.open}
              entity={inlineComposer.entity}
              initialBookId={inlineComposer.initialBookId}
              onCancel={() => inlineComposer.onOpenChange(false)}
              onSaved={handleInlineComposerSaved}
            />
          )}
          {journalListGroups.map((group) => (
            <section key={group.dateKey} className="space-y-2">
              <header className="border-b border-border/70 pb-3">
                <h2 className="font-heading text-3xl font-medium leading-tight">
                  {formatJournalDate(group.dateKey)}
                </h2>
              </header>
              <div>
                {group.entries.map((entry) => {
                  if (!isManualEntry(entry)) return null;

                  const timelineReplies = timelineRepliesByParentId[entry.sourceId] ?? [];
                  const composerOpen = composerParentEntry?.id === entry.id;

                  return (
                    <div
                      key={entry.id}
                      id={journalEntryElementId(entry.sourceId)}
                      tabIndex={-1}
                      className={cn(
                        "scroll-mt-24 rounded-sm outline-none",
                        selectedEntryId === entry.sourceId && "ring-2 ring-primary/25 ring-offset-4 ring-offset-background",
                      )}
                    >
                      {editingEntry?.sourceId === entry.sourceId ? (
                        <InlineEditEntryComposer
                          entry={entry}
                          onCancel={() => setEditingEntry(null)}
                          onSaved={(_editedEntry, note, options) => {
                            handleEditingEntrySaved(note, options);
                          }}
                        />
                      ) : (
                        <ListJournalEntry
                          entry={entry}
                          busy={busyEntryId === entry.id}
                          isHidden={isEntryHidden(entry)}
                          attachedCount={attachedCountForEntry(entry)}
                          onToggleSaved={(item) => void handleToggleSaved(item)}
                          onReply={startReply}
                          onAttach={startAttaching}
                          onUnattach={requestUnattachNote}
                          onToggleHidden={toggleEntryHidden}
                          onEdit={startEditing}
                          onDelete={requestTimelineDelete}
                          parentContextLabel={parentContextLabelsByEntryId.get(entry.id)}
                          allowAttach={(timelineRepliesByParentId[entry.sourceId]?.length ?? 0) === 0}
                        />
                      )}
                      <InlineAddEntryComposer
                        parentEntry={entry}
                        open={composerOpen}
                        onCancel={() => setComposerParentEntry(null)}
                        onSaved={handleComposerEntrySaved}
                      />
                      {timelineReplies.map((reply) => (
                        editingReplyEntry?.id === reply.id ? (
                          <InlineEditReplyComposer
                            key={reply.id}
                            entry={reply}
                            generatedParentEntry={null}
                            onCancel={() => setEditingReplyEntry(null)}
                            onSaved={handleReplyEditSaved}
                          />
                        ) : (
                          <ListJournalEntry
                            key={reply.id}
                            entry={reply}
                            busy={busyEntryId === reply.id}
                            isHidden={isEntryHidden(reply)}
                            onToggleSaved={(item) => void handleToggleSaved(item)}
                            onAttach={startAttaching}
                            onUnattach={requestUnattachNote}
                            onToggleHidden={toggleEntryHidden}
                            onEdit={startEditing}
                            onDelete={requestNoteDelete}
                            allowAttach
                            indented
                          />
                        )
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : layout === "pages" && bookViewEntries.length > 0 ? (
        <BookView
          title={bookViewTitle}
          subtitle={bookViewSubtitle}
          entries={bookViewEntries}
          className={className}
          renderComposer={() => (
            <>
              {editingEntry && (
                <div className="mx-auto w-full max-w-5xl">
                  <InlineEditEntryComposer
                    entry={editingEntry}
                    onCancel={() => setEditingEntry(null)}
                    onSaved={(_editedEntry, note, options) => {
                      handleEditingEntrySaved(note, options);
                    }}
                  />
                </div>
              )}
              {editingReplyEntry && (
                <div className="mx-auto w-full max-w-5xl">
                  <InlineEditReplyComposer
                    entry={editingReplyEntry}
                    generatedParentEntry={null}
                    onCancel={() => setEditingReplyEntry(null)}
                    onSaved={handleReplyEditSaved}
                  />
                </div>
              )}
              {inlineComposer && (
                <InlineJournalEntryComposer
                  open={inlineComposer.open}
                  entity={inlineComposer.entity}
                  initialBookId={inlineComposer.initialBookId}
                  onCancel={() => inlineComposer.onOpenChange(false)}
                  onSaved={handleInlineComposerSaved}
                />
              )}
            </>
          )}
          renderEntry={(entry) => {
            const timelineReplies = timelineRepliesByParentId[entry.sourceId] ?? [];
            const isFinalEntrySegment = entry.segmentIndex === entry.segmentCount - 1;
            const composerOpen = isFinalEntrySegment && composerParentEntry?.sourceId === entry.sourceId;

            return (
              <div
                id={entry.isContinuation ? `${journalEntryElementId(entry.sourceId)}-part-${entry.segmentIndex + 1}` : journalEntryElementId(entry.sourceId)}
                tabIndex={-1}
                className={cn(
                  "scroll-mt-24 space-y-4 rounded-sm outline-none",
                  selectedEntryId === entry.sourceId && "ring-2 ring-primary/25 ring-offset-4 ring-offset-background",
                )}
              >
                <BookViewJournalEntry
                  entry={entry}
                  busy={busyEntryId === entry.id}
                  isHidden={isEntryHidden(entry)}
                  attachedCount={attachedCountForEntry(entry)}
                  onToggleSaved={(item) => void handleToggleSaved(item)}
                  onReply={startReply}
                  onAttach={startAttaching}
                  onUnattach={requestUnattachNote}
                  onToggleHidden={toggleEntryHidden}
                  onEdit={startEditing}
                  onDelete={requestTimelineDelete}
                  parentContextLabel={parentContextLabelsByEntryId.get(entry.id)}
                  allowAttach={(timelineRepliesByParentId[entry.sourceId]?.length ?? 0) === 0}
                />
                {isFinalEntrySegment && (
                  <InlineAddEntryComposer
                    parentEntry={entry}
                    open={composerOpen}
                    onCancel={() => setComposerParentEntry(null)}
                    onSaved={handleComposerEntrySaved}
                  />
                )}
                {isFinalEntrySegment && timelineReplies.map((reply) => (
                  <BookViewJournalEntry
                    key={reply.id}
                    entry={manualEntryToSingleBookViewSegment(reply)}
                    busy={busyEntryId === reply.id}
                    isHidden={isEntryHidden(reply)}
                    onToggleSaved={(item) => void handleToggleSaved(item)}
                    onAttach={startAttaching}
                    onUnattach={requestUnattachNote}
                    onToggleHidden={toggleEntryHidden}
                    onEdit={startEditing}
                    onDelete={requestNoteDelete}
                    allowAttach
                    indented
                  />
                ))}
              </div>
            );
          }}
        />
      ) : splitEntries.visible.length > 0 ? (
        <div className={cn(layout === "cards" ? "grid gap-3 md:grid-cols-2" : "space-y-4", className)}>
          {inlineComposer && layout !== "cards" && (
            <InlineJournalEntryComposer
              open={inlineComposer.open}
              entity={inlineComposer.entity}
              initialBookId={inlineComposer.initialBookId}
              onCancel={() => inlineComposer.onOpenChange(false)}
              onSaved={handleInlineComposerSaved}
            />
          )}
          {splitEntries.visible.map((entry, index) => {
            const parentManualEntry = isManualEntry(entry) ? entry : null;
            const timelineReplies = parentManualEntry ? timelineRepliesByParentId[parentManualEntry.sourceId] ?? [] : [];
            const composerOpen = parentManualEntry !== null && composerParentEntry?.id === parentManualEntry.id;
            const generatedAttachedNotes = isGeneratedBookEntry(entry)
              ? getGeneratedEntryNoteTags(entry).flatMap((tag) => generatedAttachedNotesByTag.get(tag) ?? [])
              : [];
            const generatedComposerOpen = isGeneratedBookEntry(entry) && generatedComposerTarget?.entry.id === entry.id;
            return layout === "cards" ? (
              <div
                key={entry.id}
                id={journalEntryElementId(entry.sourceId)}
                tabIndex={-1}
                className={cn(
                  "space-y-3 scroll-mt-24 rounded-sm outline-none",
                  selectedEntryId === entry.sourceId && "ring-2 ring-primary/25 ring-offset-4 ring-offset-background",
                )}
              >
                {parentContextLabelsByEntryId.has(entry.id) && (
                  <p className="text-xs text-muted-foreground">with {parentContextLabelsByEntryId.get(entry.id)}</p>
                )}
                {isManualEntry(entry) && editingEntry?.sourceId === entry.sourceId ? (
                  <InlineEditEntryComposer
                    entry={entry}
                    onCancel={() => setEditingEntry(null)}
                    onSaved={(_editedEntry, note, options) => {
                      handleEditingEntrySaved(note, options);
                    }}
                  />
                ) : previewMode ? (
                  <Link
                    to={previewMode.getEntryHref(entry)}
                    className="block h-full rounded-lg outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <JournalEntryCard entry={entry} showTags={false} />
                  </Link>
                ) : (
                  <div className="relative h-full">
                    <JournalEntryCard
                      entry={entry}
                      showTags
                      actions={
                        <JournalEntryActionsMenu
                          entry={entry}
                          busy={busyEntryId === entry.id}
                          isHidden={isEntryHidden(entry)}
                          attachedCount={attachedCountForEntry(entry)}
                          onToggleSaved={(item) => void handleToggleSaved(item)}
                          onReply={startReply}
                          onAttach={startAttaching}
                          onUnattach={requestUnattachNote}
                          onToggleHidden={toggleEntryHidden}
                          onEdit={startEditing}
                          onDelete={requestTimelineDelete}
                          allowAttach={!(isManualEntry(entry) && timelineReplies.length > 0)}
                        />
                      }
                    />
                  </div>
                )}
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
                id={journalEntryElementId(entry.sourceId)}
                tabIndex={-1}
                className={cn(
                  "relative space-y-3 scroll-mt-24 rounded-sm outline-none",
                  selectedEntryId === entry.sourceId && "ring-2 ring-primary/25 ring-offset-4 ring-offset-background",
                  index < splitEntries.visible.length - 1 &&
                    "before:absolute before:left-3 before:top-6 before:-bottom-4 before:w-px before:bg-border",
                )}
              >
                {isManualEntry(entry) && editingEntry?.sourceId === entry.sourceId ? (
                  <TimelineInlineEditReplyComposerRow
                    entry={entry}
                    generatedParentEntry={null}
                    onCancel={() => setEditingEntry(null)}
                    onSaved={(editedEntry, note) => {
                      handleEditingEntrySaved(note);
                      setEditingEntry((current) => (current?.sourceId === editedEntry.sourceId ? null : current));
                    }}
                  />
                ) : (
                  <TimelineRow
                    entry={entry}
                    index={index}
                    total={splitEntries.visible.length}
                    busy={busyEntryId === entry.id}
                    isHidden={isEntryHidden(entry)}
                    attachedCount={attachedCountForEntry(entry)}
                    onToggleSaved={(item) => void handleToggleSaved(item)}
                    onReply={startReply}
                    onAttach={startAttaching}
                    onUnattach={requestUnattachNote}
                    onToggleHidden={toggleEntryHidden}
                    onEdit={startEditing}
                    onDelete={requestTimelineDelete}
                    parentContextLabel={parentContextLabelsByEntryId.get(entry.id)}
                    allowAttach={!(isManualEntry(entry) && (timelineRepliesByParentId[entry.sourceId]?.length ?? 0) > 0)}
                    showConnector={false}
                  />
                )}
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
                  editingReplyEntry?.id === reply.id ? (
                    <TimelineInlineEditReplyComposerRow
                      key={reply.id}
                      entry={reply}
                      generatedParentEntry={null}
                      onCancel={() => setEditingReplyEntry(null)}
                      onSaved={handleReplyEditSaved}
                    />
                  ) : (
                    <TimelineReplyRow
                      key={reply.id}
                      entry={reply}
                      busy={busyEntryId === reply.id}
                      isHidden={isEntryHidden(reply)}
                      onToggleSaved={(item) => void handleToggleSaved(item)}
                      onAttach={startAttaching}
                      onUnattach={requestUnattachNote}
                      onToggleHidden={toggleEntryHidden}
                      onEdit={startEditing}
                      onDelete={requestNoteDelete}
                    />
                  )
                ))}
                {isGeneratedBookEntry(entry) && generatedAttachedNotes.map((note) => (
                  editingReplyEntry?.id === note.id ? (
                    <TimelineInlineEditReplyComposerRow
                      key={note.id}
                      entry={note}
                      generatedParentEntry={entry}
                      onCancel={() => setEditingReplyEntry(null)}
                      onSaved={handleReplyEditSaved}
                    />
                  ) : (
                    <TimelineReplyRow
                      key={note.id}
                      entry={note}
                      busy={busyEntryId === note.id}
                      isHidden={isEntryHidden(note)}
                      onToggleSaved={(item) => void handleToggleSaved(item)}
                      onAttach={startAttaching}
                      onUnattach={requestUnattachNote}
                      onToggleHidden={toggleEntryHidden}
                      onEdit={startEditing}
                      onDelete={requestNoteDelete}
                    />
                  )
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cn("mr-auto max-w-5xl space-y-4", className)}>
          {inlineComposer && (
            <InlineJournalEntryComposer
              open={inlineComposer.open}
              entity={inlineComposer.entity}
              initialBookId={inlineComposer.initialBookId}
              onCancel={() => inlineComposer.onOpenChange(false)}
              onSaved={handleInlineComposerSaved}
            />
          )}
          {!inlineComposer?.open && (
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              {entries.length === 0 ? emptyMessage : "All entries are hidden."}
            </div>
          )}
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
                  isHidden={isEntryHidden(entry)}
                  attachedCount={attachedCountForEntry(entry)}
                  onToggleSaved={(item) => void handleToggleSaved(item)}
                  onReply={startReply}
                  onAttach={startAttaching}
                  onUnattach={requestUnattachNote}
                  onToggleHidden={toggleEntryHidden}
                  onEdit={startEditing}
                  onDelete={requestTimelineDelete}
                  parentContextLabel={parentContextLabelsByEntryId.get(entry.id)}
                  allowAttach={!(isManualEntry(entry) && (timelineRepliesByParentId[entry.sourceId]?.length ?? 0) > 0)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={Boolean(attachingEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setAttachingEntry(null);
            setAttachingError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Attach to entry</DialogTitle>
          <DialogDescription>
            Choose the entry this should become attached to.
          </DialogDescription>
          <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
            {availableAttachTargets.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No compatible parent entries are available.
              </p>
            ) : (
              availableAttachTargets.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/35 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={attachingBusyEntryId === entry.id}
                  onClick={() => void handleAttachTarget(entry)}
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
          {attachingError && <p className="text-sm text-destructive">{attachingError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAttachingEntry(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingRelationshipAction)} onOpenChange={(open) => !open && setPendingRelationshipAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Unattach this note?</DialogTitle>
          <DialogDescription>
            This will remove the note from its parent entry and turn it into a normal journal entry.
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingRelationshipAction(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pendingRelationshipAction ? busyEntryId === pendingRelationshipAction.entry.id : false}
              onClick={() => void confirmPendingRelationshipAction()}
            >
              Unattach
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
