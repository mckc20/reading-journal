import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Flag,
  MessageSquareText,
  Pencil,
  Quote,
  Star,
  StickyNote,
  TrendingUp,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { JournalEntryForm } from "@/components/AddNoteDialog";
import FormattedNoteContent from "@/components/FormattedNoteContent";
import JournalEntryCard from "@/components/JournalEntryCard";
import QuoteBlock from "@/components/QuoteBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { deleteAuthorNote, updateAuthorNote } from "@/lib/authorNotes";
import { deleteBookNote, updateBookNote } from "@/lib/bookNotes";
import { normalizeJournalTags } from "@/lib/journalTags";
import {
  fetchHiddenJournalEntries,
  getHiddenJournalEntryKeys,
  getJournalVisibilityKey,
  hideJournalEntry,
  restoreJournalEntry,
} from "@/lib/journalVisibility";
import {
  getJournalEntryTags,
  isThoughtJournalEntry,
  sortJournalEntries,
  type AuthorNoteJournalEntry,
  type BookNoteJournalEntry,
  type GeneratedBookJournalEntry,
  type JournalTimelineEntry,
  type SeriesNoteJournalEntry,
} from "@/lib/journal";
import { deleteSeriesNote, updateSeriesNote } from "@/lib/seriesNotes";
import { cn } from "@/lib/utils";
import type { AuthorNote, BookNote, SeriesNote } from "@/types";
import { useEffect, useMemo, useState, type ReactNode } from "react";

interface JournalTimelineProps {
  entries: JournalTimelineEntry[];
  emptyMessage?: string;
  className?: string;
  layout?: "timeline" | "cards";
  onEntryUpdated?: (entry: JournalTimelineEntry) => void;
  onEntryEdit?: (entry: JournalTimelineEntry) => void;
  onEntryDeleted?: (entry: JournalTimelineEntry) => void;
}

type ManualJournalTimelineEntry = BookNoteJournalEntry | SeriesNoteJournalEntry | AuthorNoteJournalEntry;

function formatJournalDate(value: string): string {
  const dateValue = value.includes("T") ? value : `${value}T00:00:00`;

  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function isBookNoteEntry(entry: JournalTimelineEntry): entry is BookNoteJournalEntry {
  return entry.source === "book_note";
}

function isSeriesNoteEntry(entry: JournalTimelineEntry): entry is SeriesNoteJournalEntry {
  return entry.source === "series_note";
}

function isAuthorNoteEntry(entry: JournalTimelineEntry): entry is AuthorNoteJournalEntry {
  return entry.source === "author_note";
}

function isGeneratedBookEntry(entry: JournalTimelineEntry): entry is GeneratedBookJournalEntry {
  return entry.source === "generated_book_event";
}

function getManualNote(
  entry: BookNoteJournalEntry | SeriesNoteJournalEntry | AuthorNoteJournalEntry,
): BookNote | SeriesNote | AuthorNote {
  if (isBookNoteEntry(entry)) return entry.bookNote;
  if (isSeriesNoteEntry(entry)) return entry.seriesNote;
  return entry.authorNote;
}

function isManualEntry(
  entry: JournalTimelineEntry,
): entry is ManualJournalTimelineEntry {
  return isBookNoteEntry(entry) || isSeriesNoteEntry(entry) || isAuthorNoteEntry(entry);
}

function formatManualPage(note: BookNote | SeriesNote | AuthorNote): string | null {
  return note.page_start ? `p. ${note.page_start}` : null;
}

function TimelineTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {tags.map((tag) => (
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
  return isBookNoteEntry(entry) ? entry.relatedBookTitle ?? null : null;
}

function isRelatedBookEntry(entry: JournalTimelineEntry): boolean {
  return isBookNoteEntry(entry) && Boolean(entry.relatedContext);
}

function isEntityOwnedEntry(entry: JournalTimelineEntry): boolean {
  return isSeriesNoteEntry(entry) || isAuthorNoteEntry(entry);
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

  if (isBookNoteEntry(entry)) return entry.bookNote.title || null;
  if (isSeriesNoteEntry(entry)) return entry.seriesNote.title || null;
  if (isAuthorNoteEntry(entry)) return entry.authorNote.title || null;
  return null;
}

function isSavedEntry(entry: JournalTimelineEntry): boolean {
  return isManualEntry(entry) ? Boolean(getManualNote(entry).is_favorite) : false;
}

function TimelineTopMeta({
  entry,
  busy,
  onToggleSaved,
}: {
  entry: JournalTimelineEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
}) {
  const saved = isSavedEntry(entry);
  if (!isManualEntry(entry)) return null;

  return (
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
  hideSaveButton = false,
}: {
  entry: BookNoteJournalEntry | SeriesNoteJournalEntry | AuthorNoteJournalEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  hideSaveButton?: boolean;
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
        "relative rounded-lg border bg-background p-4 pr-12 dark:bg-card",
        isEntityOwnedEntry(entry) && "border-note/40",
        isRelatedBookEntry(entry) && "bg-muted/20 opacity-90",
      )}>
        {!hideSaveButton && <TimelineTopMeta entry={entry} busy={busy} onToggleSaved={onToggleSaved} />}
        {displayEntryTitle(entry) && (
          <h3 className="mb-2 text-sm font-heading leading-snug font-medium">{displayEntryTitle(entry)}</h3>
        )}
        <FormattedNoteContent markdown={note.content} className="text-sm leading-6 text-foreground" />
        <TimelineTags tags={normalizeJournalTags(note.tags)} />
      </div>
    </article>
  );
}

function JournalPassageEntry({
  entry,
  busy,
  onToggleSaved,
  hideSaveButton = false,
}: {
  entry: BookNoteJournalEntry | SeriesNoteJournalEntry | AuthorNoteJournalEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  hideSaveButton?: boolean;
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
        "relative rounded-lg border border-note/40 bg-background p-4 pr-12 dark:bg-card",
        isRelatedBookEntry(entry) && "border-border bg-muted/20 opacity-90",
      )}>
        {!hideSaveButton && <TimelineTopMeta entry={entry} busy={busy} onToggleSaved={onToggleSaved} />}
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
      </div>
    </article>
  );
}

function JournalReviewEntry({
  entry,
  busy,
  onToggleSaved,
  hideSaveButton = false,
}: {
  entry: BookNoteJournalEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  hideSaveButton?: boolean;
}) {
  const note = entry.bookNote;

  return (
    <article className="relative pl-8">
      <div className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-insight">
        <MessageSquareText className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className={cn("relative rounded-lg border bg-background p-4 pr-12 dark:bg-card", isRelatedBookEntry(entry) && "bg-muted/20 opacity-90")}>
        {!hideSaveButton && <TimelineTopMeta entry={entry} busy={busy} onToggleSaved={onToggleSaved} />}
        {displayEntryTitle(entry) && (
          <h3 className="mb-2 text-sm font-heading leading-snug font-medium">{displayEntryTitle(entry)}</h3>
        )}
        <FormattedNoteContent markdown={note.content} className="text-sm leading-6 text-foreground" />
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
  if (isGeneratedBookEntry(entry)) return getAutomaticEventIcon(entry);
  if (entry.type === "passage") return Quote;
  if (entry.type === "review") return MessageSquareText;
  return StickyNote;
}

function getTimelineMarkerClassName(entry: JournalTimelineEntry): string {
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

function GeneratedBookEventEntry({ entry }: { entry: GeneratedBookJournalEntry }) {
  const Icon = getAutomaticEventIcon(entry);
  const details = formatAutomaticEventDetails(entry);
  const rating = entry.type === "rating_added" ? entry.metadata?.rating : undefined;

  return (
    <article className="relative pl-8">
      <div className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/30 bg-muted text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className="rounded-lg border border-dashed bg-muted/25 p-4">
        <TimelineTopMeta entry={entry} busy={false} onToggleSaved={() => undefined} />
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
  onToggleSaved,
  hideSaveButton = false,
}: {
  entry: JournalTimelineEntry;
  busy: boolean;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  hideSaveButton?: boolean;
}) {
  if (isGeneratedBookEntry(entry)) return <GeneratedBookEventEntry entry={entry} />;
  if (entry.type === "passage" && (isBookNoteEntry(entry) || isSeriesNoteEntry(entry) || isAuthorNoteEntry(entry))) {
    return <JournalPassageEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} hideSaveButton={hideSaveButton} />;
  }
  if (isSeriesNoteEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} hideSaveButton={hideSaveButton} />;
  if (isAuthorNoteEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} hideSaveButton={hideSaveButton} />;
  if (!isBookNoteEntry(entry)) return null;
  if (entry.type === "review") return <JournalReviewEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} hideSaveButton={hideSaveButton} />;
  if (isThoughtJournalEntry(entry)) return <JournalNoteEntry entry={entry} busy={busy} onToggleSaved={onToggleSaved} hideSaveButton={hideSaveButton} />;
  return null;
}

function TimelineRow({
  entry,
  index,
  total,
  busy,
  onOpen,
  onToggleSaved,
  restoreButton,
  hideSaveButton = false,
}: {
  entry: JournalTimelineEntry;
  index: number;
  total: number;
  busy: boolean;
  onOpen: (entry: JournalTimelineEntry) => void;
  onToggleSaved: (entry: JournalTimelineEntry) => void;
  restoreButton?: ReactNode;
  hideSaveButton?: boolean;
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
          index < total - 1 &&
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
        <JournalTimelineItem
          entry={entry}
          busy={busy}
          onToggleSaved={onToggleSaved}
          hideSaveButton={hideSaveButton}
        />
      </div>
    </div>
  );
}

function replaceManualEntryRecord(
  entry: JournalTimelineEntry,
  note: BookNote | SeriesNote | AuthorNote,
): JournalTimelineEntry {
  if (isBookNoteEntry(entry) && "book_id" in note) {
    return {
      ...entry,
      type: note.label === "quote" ? "passage" : "thought",
      createdAt: note.note_date ?? note.created_at,
      updatedAt: note.updated_at,
      bookNote: note,
    };
  }

  if (isSeriesNoteEntry(entry) && "series_id" in note) {
    return {
      ...entry,
      type: note.label === "quote" ? "passage" : "thought",
      createdAt: note.note_date ?? note.created_at,
      updatedAt: note.updated_at,
      seriesNote: note,
    };
  }

  if (isAuthorNoteEntry(entry) && "author_id" in note) {
    return {
      ...entry,
      type: note.label === "quote" ? "passage" : "thought",
      createdAt: note.note_date ?? note.created_at,
      updatedAt: note.updated_at,
      authorNote: note,
    };
  }

  return entry;
}

function entryTitle(entry: JournalTimelineEntry): string {
  if (isGeneratedBookEntry(entry)) return entry.label;
  if (isBookNoteEntry(entry)) {
    if (entry.bookNote.label === "quote") return "Quote";
    return entry.bookNote.title || "Thought";
  }
  if (isSeriesNoteEntry(entry)) return entry.seriesNote.title || "Thought";
  if (isAuthorNoteEntry(entry)) return entry.authorNote.title || "Thought";
  return "Journal entry";
}

function entryDate(entry: JournalTimelineEntry): string {
  if (isBookNoteEntry(entry)) return entry.bookNote.note_date;
  if (isSeriesNoteEntry(entry)) return entry.seriesNote.note_date;
  if (isAuthorNoteEntry(entry)) return entry.authorNote.note_date;
  return entry.createdAt;
}

function entryPage(entry: JournalTimelineEntry): string | null {
  if (isBookNoteEntry(entry)) return formatManualPage(entry.bookNote);
  if (isSeriesNoteEntry(entry)) return formatManualPage(entry.seriesNote);
  if (isAuthorNoteEntry(entry)) return formatManualPage(entry.authorNote);
  if (isGeneratedBookEntry(entry) && typeof entry.metadata?.currentPage === "number") {
    return entry.metadata.totalPages
      ? `page ${entry.metadata.currentPage} of ${entry.metadata.totalPages}`
      : `page ${entry.metadata.currentPage}`;
  }
  return null;
}

function JournalPanelEntryContent({ entry }: { entry: JournalTimelineEntry }) {
  if (isGeneratedBookEntry(entry)) {
    const details = formatAutomaticEventDetails(entry);
    const rating = entry.type === "rating_added" ? entry.metadata?.rating : undefined;
    const sessions = entry.metadata?.sessions ?? [];
    const sessionGroups = groupGeneratedSessionsByDay(sessions);

    return (
      <article className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h3 className="font-heading text-xl font-medium leading-snug">{entry.label}</h3>
            {typeof rating === "number" && <RatingStars rating={rating} />}
            {details && <p className="text-sm text-muted-foreground">{details}</p>}
          </div>
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
                          {session.readingMinutes ? `${session.readingMinutes} min` : "Session"}
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

  if (entry.type === "passage" && (isBookNoteEntry(entry) || isSeriesNoteEntry(entry) || isAuthorNoteEntry(entry))) {
    const note = getManualNote(entry);

  return (
    <article className="space-y-4">
        <QuoteBlock
          attribution={
            note.quote_speaker ? (
              <span className="font-serif italic">- {note.quote_speaker}</span>
            ) : null
          }
        >
          <FormattedNoteContent markdown={note.content} className="text-lg leading-8 text-foreground [&_em]:not-italic" />
        </QuoteBlock>
      </article>
    );
  }

  const note = isBookNoteEntry(entry)
    ? entry.bookNote
    : isSeriesNoteEntry(entry)
      ? entry.seriesNote
      : isAuthorNoteEntry(entry)
        ? entry.authorNote
        : null;

  if (!note) return null;

  return (
    <article className="space-y-4">
      {displayEntryTitle(entry) && (
        <h3 className="font-heading text-xl font-medium leading-snug">{displayEntryTitle(entry)}</h3>
      )}
      <FormattedNoteContent markdown={note.content} className="text-base leading-7 text-foreground" />
    </article>
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
  if (isBookNoteEntry(entry)) return { type: "Book", id: entry.bookNote.book_id };
  if (isSeriesNoteEntry(entry)) return { type: "Series", id: entry.seriesNote.series_id };
  return { type: "Author", id: entry.authorNote.author_id };
}

async function deleteManualEntry(entry: JournalTimelineEntry) {
  if (isBookNoteEntry(entry)) return deleteBookNote(entry.bookNote.id);
  if (isSeriesNoteEntry(entry)) return deleteSeriesNote(entry.seriesNote.id);
  if (isAuthorNoteEntry(entry)) return deleteAuthorNote(entry.authorNote.id);
}

export default function JournalTimeline({
  entries,
  emptyMessage = "No journal entries yet.",
  className,
  layout = "timeline",
  onEntryUpdated,
  onEntryEdit,
  onEntryDeleted,
}: JournalTimelineProps) {
  const { user } = useAuth();
  const [selectedEntry, setSelectedEntry] = useState<JournalTimelineEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<ManualJournalTimelineEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [hiddenEntries, setHiddenEntries] = useState<Set<string>>(new Set());
  const [hiddenSectionOpen, setHiddenSectionOpen] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const visibleEntries = sortJournalEntries(entries);
  const entity = entries[0] ? { type: entries[0].entityType, id: entries[0].entityId } : null;

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

  const splitEntries = useMemo(() => {
    const visible: JournalTimelineEntry[] = [];
    const hidden: JournalTimelineEntry[] = [];
    visibleEntries.forEach((entry) => {
      const key = getJournalVisibilityKey(getEntryVisibilityInput(entry));
      if (hiddenEntries.has(key)) hidden.push(entry);
      else visible.push(entry);
    });
    return { visible, hidden };
  }, [hiddenEntries, visibleEntries]);
  const selectedEntryHidden = selectedEntry
    ? hiddenEntries.has(getJournalVisibilityKey(getEntryVisibilityInput(selectedEntry)))
    : false;
  const selectedEntryTags = selectedEntry ? normalizeJournalTags(getJournalEntryTags(selectedEntry)) : [];

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

  async function handleDelete(entry: JournalTimelineEntry) {
    if (isGeneratedBookEntry(entry)) return;
    const confirmed = window.confirm("Delete this journal entry? This cannot be undone.");
    if (!confirmed) return;
    setBusyEntryId(entry.id);
    try {
      await deleteManualEntry(entry);
      onEntryDeleted?.(entry);
      setSelectedEntry(null);
    } finally {
      setBusyEntryId(null);
    }
  }

  function openEntry(entry: JournalTimelineEntry) {
    setSelectedEntry(entry);
    setDetailsOpen(false);
  }

  function startEditing(entry: JournalTimelineEntry) {
    if (!isManualEntry(entry)) return;
    setEditingEntry(entry);
    setDetailsOpen(false);
  }

  async function handleToggleSaved(entry: JournalTimelineEntry) {
    if (!isManualEntry(entry)) return;
    setBusyEntryId(entry.id);
    try {
      const note = getManualNote(entry);
      const nextFavorite = !note.is_favorite;
      let updatedNote: BookNote | SeriesNote | AuthorNote;

      if (isBookNoteEntry(entry)) {
        updatedNote = await updateBookNote({
          noteId: entry.bookNote.id,
          label: entry.bookNote.label,
          title: entry.bookNote.title ?? undefined,
          quoteSpeaker: entry.bookNote.quote_speaker ?? undefined,
          content: entry.bookNote.content,
          tags: entry.bookNote.tags ?? undefined,
          pageStart: entry.bookNote.page_start ?? undefined,
          noteDate: entry.bookNote.note_date,
          isFavorite: nextFavorite,
        });
      } else if (isSeriesNoteEntry(entry)) {
        updatedNote = await updateSeriesNote({
          noteId: entry.seriesNote.id,
          label: entry.seriesNote.label,
          title: entry.seriesNote.title ?? undefined,
          quoteSpeaker: entry.seriesNote.quote_speaker ?? undefined,
          content: entry.seriesNote.content,
          tags: entry.seriesNote.tags ?? undefined,
          pageStart: entry.seriesNote.page_start ?? undefined,
          noteDate: entry.seriesNote.note_date,
          isFavorite: nextFavorite,
        });
      } else {
        updatedNote = await updateAuthorNote({
          noteId: entry.authorNote.id,
          label: entry.authorNote.label,
          title: entry.authorNote.title ?? undefined,
          quoteSpeaker: entry.authorNote.quote_speaker ?? undefined,
          content: entry.authorNote.content,
          tags: entry.authorNote.tags ?? undefined,
          pageStart: entry.authorNote.page_start ?? undefined,
          noteDate: entry.authorNote.note_date,
          isFavorite: nextFavorite,
        });
      }

      const updatedEntry = replaceManualEntryRecord(entry, updatedNote);
      setSelectedEntry((current) => (current?.id === entry.id ? updatedEntry : current));
      onEntryUpdated?.(updatedEntry);
    } finally {
      setBusyEntryId(null);
    }
  }

  function handleEditingEntrySaved(note: BookNote | SeriesNote | AuthorNote) {
    if (!editingEntry) return;
    const updatedEntry = replaceManualEntryRecord(editingEntry, note);
    setEditingEntry(null);
    setSelectedEntry(updatedEntry);
    onEntryUpdated?.(updatedEntry);
    onEntryEdit?.(updatedEntry);
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const editingEntryEntity = editingEntry ? getManualEntryDialogEntity(editingEntry) : undefined;
  const editingInitialBookId = editingEntry && isBookNoteEntry(editingEntry) ? editingEntry.bookNote.book_id : "";

  return (
    <>
      {splitEntries.visible.length > 0 ? (
        <div className={cn(layout === "cards" ? "grid gap-3 md:grid-cols-2" : "space-y-4", className)}>
          {splitEntries.visible.map((entry, index) => (
            layout === "cards" ? (
              <div
                key={entry.id}
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
                />
              </div>
            ) : (
              <TimelineRow
                key={entry.id}
                entry={entry}
                index={index}
                total={splitEntries.visible.length}
                busy={busyEntryId === entry.id}
                onOpen={openEntry}
                onToggleSaved={(item) => void handleToggleSaved(item)}
              />
            )
          ))}
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
                    onCancel={() => setEditingEntry(null)}
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
                  <div className="relative overflow-y-auto p-6 pr-20 sm:p-8 sm:pr-24">
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
                        {detailsOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </div>
                    <JournalPanelEntryContent entry={selectedEntry} />
                  </div>
                  {detailsOpen && (
                    <aside className="space-y-4 border-t bg-muted/30 p-4 md:border-l md:border-t-0">
                      <div>
                        <p className="text-xs font-medium uppercase text-muted-foreground">Entry date</p>
                        <p className="text-sm">{formatJournalDate(entryDate(selectedEntry))}</p>
                      </div>
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
                      {isBookNoteEntry(selectedEntry) && selectedEntry.relatedBookTitle && selectedEntry.relatedContext && (
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
                      <div className="flex flex-wrap items-center gap-2 pt-2">
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
                            onClick={() => void handleDelete(selectedEntry)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </aside>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
