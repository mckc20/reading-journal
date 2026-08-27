import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CircleCheck,
  CirclePlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSearchCorner,
  LibraryBig,
  MessageCircle,
  MessageCirclePlus,
  Pencil,
  Plus,
  Reply,
  Send,
  Settings,
  Sticker,
  StickyNote,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AppHeading, HeadingDescription } from "@/components/design";
import AddChatDialog from "@/components/AddChatDialog";
import BookCard from "@/components/BookCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import {
  attachmentTitle,
  bookSnapshotToAddBookPayload,
  buildAuthorAttachment,
  buildBookAttachment,
  buildNoteAttachment,
  buildSeriesAttachment,
  noteSnapshotToCreateInput,
} from "@/lib/chatAttachments";
import {
  addGroupMemberByUsername,
  changeGroupMemberRole,
  copyChatAttachmentImage,
  deleteChatMessage,
  editChatMessage,
  buildReplySnapshot,
  getChatAttachmentSaveReceipts,
  getChatMembers,
  getChatMessages,
  getChatNotificationPreferences,
  getSavedChatAttachmentMessageIds,
  getChatThreads,
  getMessagePreview,
  markChatRead,
  removeChatMember,
  sendChatMessage,
  saveChatAttachment,
  setChatNotificationPreferences,
  toChatErrorMessage,
  type ChatAttachmentSaveReceipt,
  type ChatMember,
  type ChatThread,
} from "@/lib/chat";
import { supabase } from "@/lib/supabase";
import { buildAuthorSummaries } from "@/lib/authorShelf";
import { createBookJournalEntryRecord, fetchAllBookJournalEntryRecords } from "@/lib/bookJournal";
import { createSeriesJournalEntryRecord, fetchAllSeriesJournalEntryRecords } from "@/lib/seriesJournal";
import { createAuthorJournalEntryRecord, fetchAllAuthorJournalEntryRecords } from "@/lib/authorJournal";
import { useSeries } from "@/hooks/useSeries";
import { cn } from "@/lib/utils";
import type {
  Book,
  AuthorJournalEntryRecord,
  BookJournalEntryRecord,
  ChatAttachmentPayload,
  ChatReplySnapshot,
  ChatSharedBookSnapshot,
  ChatSharedNoteSnapshot,
  GroupMessage,
  PublicProfile,
  GroupMembershipRole,
  Series,
  SeriesJournalEntryRecord,
} from "@/types";

type AttachmentPickerMode = "book" | "note" | "author" | "series";
type JournalTargetKind = "book" | "series" | "author";

type SwipeReplyGesture = {
  messageId: string;
  startX: number;
  startY: number;
  direction: "pending" | "horizontal" | "vertical";
};

const SWIPE_REPLY_TRIGGER_DISTANCE = 80;
const SWIPE_REPLY_MAX_DISTANCE = 104;
const SWIPE_DIRECTION_LOCK_DISTANCE = 10;

type JournalAttachmentPickerItem = {
  sourceType: JournalTargetKind;
  sourceId: string;
  sourceTitle: string;
  sourceAuthors: string[];
  sourceImageUrl: string | null;
  entry: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord;
};

type OpenAttachmentState =
  | { type: "book"; bookId: string }
  | { type: "author"; authorName: string }
  | { type: "series"; seriesId: string };

type ConfirmAction =
  | { type: "message"; messageId: string }
  | { type: "member"; userId: string }
  | { type: "leave"; userId: string };

type MessageActionMenu = {
  messageId: string;
  x: number;
  y: number;
};

type AttachmentPreviewState = {
  message: GroupMessage;
  attachment: ChatAttachmentPayload;
};

type AttachmentSaveFeedback = {
  description: string;
  libraryHref: string;
};

type ChatPanelWidths = {
  chats: number;
  details: number;
};

type ChatSettingsMenuPosition = {
  top: number;
  right: number;
};

const CHAT_PANEL_WIDTHS_STORAGE_KEY = "reading-journal:messages-panel-widths";
const DEFAULT_CHAT_PANEL_WIDTHS: ChatPanelWidths = { chats: 352, details: 304 };
const CHAT_LIST_MIN_WIDTH = 256;
const CHAT_DETAILS_MIN_WIDTH = 288;
const CHAT_PANEL_MAX_WIDTH = 480;
const CHAT_CONVERSATION_MIN_WIDTH = 360;
const PANEL_RESIZE_HANDLE_WIDTH = 6;

function getStoredChatPanelWidths(): ChatPanelWidths {
  if (typeof window === "undefined") return DEFAULT_CHAT_PANEL_WIDTHS;

  try {
    const stored = JSON.parse(window.localStorage.getItem(CHAT_PANEL_WIDTHS_STORAGE_KEY) ?? "null") as Partial<ChatPanelWidths> | null;
    return {
      chats: typeof stored?.chats === "number" ? stored.chats : DEFAULT_CHAT_PANEL_WIDTHS.chats,
      details: typeof stored?.details === "number" ? stored.details : DEFAULT_CHAT_PANEL_WIDTHS.details,
    };
  } catch {
    return DEFAULT_CHAT_PANEL_WIDTHS;
  }
}

function getChatPanelWidthBounds({
  panel,
  containerWidth,
  widths,
  detailsVisible,
}: {
  panel: keyof ChatPanelWidths;
  containerWidth: number;
  widths: ChatPanelWidths;
  detailsVisible: boolean;
}): { min: number; max: number } {
  const min = panel === "chats" ? CHAT_LIST_MIN_WIDTH : CHAT_DETAILS_MIN_WIDTH;
  const otherPanelWidth = panel === "chats" && detailsVisible
    ? widths.details
    : panel === "details"
      ? widths.chats
      : 0;
  const handleCount = detailsVisible ? 2 : 1;
  const availableMax = containerWidth - otherPanelWidth - CHAT_CONVERSATION_MIN_WIDTH - handleCount * PANEL_RESIZE_HANDLE_WIDTH;

  return {
    min,
    max: Math.max(min, Math.min(CHAT_PANEL_MAX_WIDTH, availableMax)),
  };
}

function ChatSettingToggle({
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className={cn("flex items-start gap-3 py-2", disabled && "opacity-55")}>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
          checked ? "bg-primary" : "bg-muted-foreground/35",
        )}
        onClick={() => onCheckedChange?.(!checked)}
      >
        <span
          className={cn(
            "absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-5">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMessageDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function messageDayKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function profileLabel(profile?: PublicProfile): string {
  if (!profile) return "Unknown user";
  return profile.display_name?.trim() || profile.username?.trim() || "Unknown user";
}

function profileSubLabel(profile?: PublicProfile): string {
  if (profile?.username) return `@${profile.username}`;
  return "No username";
}

function initialsFor(profile?: PublicProfile, fallback = "?"): string {
  const label = profileLabel(profile);
  if (label !== "Unknown user") return label.trim().charAt(0).toUpperCase();
  return fallback.trim().charAt(0).toUpperCase() || "?";
}

function MessageAvatar({ profile, fallback }: { profile?: PublicProfile; fallback?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = profile?.avatar_url?.trim() || "";

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-muted-foreground">
      {avatarUrl && !imageFailed ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
      ) : (
        <span aria-hidden="true">{initialsFor(profile, fallback)}</span>
      )}
    </span>
  );
}

function messageFromPayload(payload: unknown): GroupMessage {
  const row = payload as GroupMessage;
  return {
    id: row.id,
    group_id: row.group_id,
    sender_id: row.sender_id,
    content: row.content,
    attachment_type: row.attachment_type ?? null,
    attachment_payload: row.attachment_payload ?? null,
    reply_to_message_id: row.reply_to_message_id ?? null,
    reply_snapshot: row.reply_snapshot ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    edited_at: row.edited_at ?? null,
    deleted_at: row.deleted_at ?? null,
  };
}

function upsertMessage(messages: GroupMessage[], nextMessage: GroupMessage): GroupMessage[] {
  const withoutExisting = messages.filter((message) => message.id !== nextMessage.id);
  return [...withoutExisting, nextMessage].sort(
    (first, second) =>
      new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
  );
}

function noteLabel(label: ChatSharedNoteSnapshot["label"]): string {
  if (label === "quote") return "Quote";
  if (label === "review") return "Review";
  return "Note";
}

function attachmentTypeLabel(attachment: ChatAttachmentPayload): string {
  if (attachment.type === "book") return "Book";
  if (attachment.type === "note") return noteLabel(attachment.note.label);
  if (attachment.type === "author") return "Author";
  return "Series";
}

function attachmentHref(attachment: ChatAttachmentPayload): string | null {
  if (attachment.type === "book") return attachment.book.id ? `/books/${attachment.book.id}` : null;
  if (attachment.type === "note") {
    if (!attachment.note.book_id) return null;
    return `/books/${attachment.note.book_id}/journal`;
  }
  if (attachment.type === "author") {
    return `/authors/${encodeURIComponent(attachment.author.id ?? attachment.author.name)}`;
  }
  if (attachment.series.id) return `/series/${attachment.series.id}`;
  return null;
}

function sortSeriesByName(series: Series[]): Series[] {
  return [...series].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: "base", numeric: true }),
  );
}

function sortBooksByTitle(books: Book[]): Book[] {
  return [...books].sort((first, second) =>
    first.title.localeCompare(second.title, undefined, { sensitivity: "base", numeric: true }),
  );
}

function AttachmentSummary({ attachment }: { attachment: ChatAttachmentPayload }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/35 px-3 py-2 text-sm">
      <Badge variant="outline">{attachmentTypeLabel(attachment)}</Badge>
      <span className="min-w-0 flex-1 truncate">{attachmentTitle(attachment)}</span>
    </div>
  );
}

function ReplyPreview({
  reply,
  compact = false,
  onCancel,
}: {
  reply: ChatReplySnapshot;
  compact?: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className={cn("flex gap-2 rounded-md border-l-4 border-primary/70 bg-background/70 px-3 py-2", compact && "py-1.5")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-primary">Reply to {reply.sender_name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {reply.attachment_title ? `${reply.attachment_title}: ` : ""}
          {reply.text}
        </p>
      </div>
      {onCancel && (
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function imageCopyErrorMessage(error: unknown): string {
  return toChatErrorMessage(error, "The image-copy function failed.");
}

function importPayloadForBookSnapshot(
  book: ChatSharedBookSnapshot,
  seriesId?: string,
) {
  const { cover_url: _sharedCoverUrl, ...payload } = bookSnapshotToAddBookPayload(
    book,
    seriesId ? { series_id: seriesId } : undefined,
  );
  return payload;
}

async function importAuthorPhotosForBookSnapshot({
  messageId,
  attachmentType,
  book,
  sourceBookId,
  addAuthor,
  editAuthor,
}: {
  messageId: string;
  attachmentType: "book" | "series";
  book: ChatSharedBookSnapshot;
  sourceBookId?: string;
  addAuthor: ReturnType<typeof useAuthorsContext>["addAuthor"];
  editAuthor: ReturnType<typeof useAuthorsContext>["editAuthor"];
}): Promise<string | null> {
  let imageCopyError: string | null = null;

  for (const authorSnapshot of book.author_profiles ?? []) {
    if (!authorSnapshot.photo_url) continue;

    try {
      const savedAuthor = await addAuthor({ name: authorSnapshot.name });
      if (savedAuthor.photo_url) continue;

      const photoUrl = await copyChatAttachmentImage(
        messageId,
        "author",
        savedAuthor.id,
        attachmentType === "series" ? sourceBookId : undefined,
        authorSnapshot.name,
      );
      await editAuthor(savedAuthor.id, {
        name: savedAuthor.name,
        bio: savedAuthor.bio ?? null,
        is_favorite: savedAuthor.is_favorite,
        photo_url: photoUrl,
      });
    } catch (copyError) {
      imageCopyError ??= imageCopyErrorMessage(copyError);
    }
  }

  return imageCopyError;
}

function attachmentImage(attachment: ChatAttachmentPayload): string | null {
  if (attachment.type === "book") return attachment.book.cover_url ?? null;
  if (attachment.type === "author") return attachment.author.photo_url ?? null;
  if (attachment.type === "series") return attachment.series.cover_url ?? attachment.series.books[0]?.cover_url ?? null;
  return null;
}

function attachmentSecondaryInfo(attachment: ChatAttachmentPayload): string | null {
  if (attachment.type === "book") return attachment.book.authors.join(", ") || null;
  if (attachment.type === "author") return null;
  if (attachment.type === "series") return attachment.series.authors?.join(", ") || attachment.series.books.flatMap((book) => book.authors).find(Boolean) || null;
  return null;
}

function AttachmentThumbnail({ attachment }: { attachment: ChatAttachmentPayload }) {
  const image = attachmentImage(attachment);
  const Icon = attachment.type === "author" ? UserRound : attachment.type === "note" ? StickyNote : BookOpen;
  const isAuthor = attachment.type === "author";

  return image ? (
    <img src={image} alt="" className={cn("shrink-0 object-cover", isAuthor ? "h-16 w-16 rounded-full" : "h-16 w-11 rounded-md")} />
  ) : (
    <div className={cn("flex shrink-0 items-center justify-center bg-muted", isAuthor ? "h-16 w-16 rounded-full" : "h-16 w-11 rounded-md")}>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function AttachmentCardImage({ attachment }: { attachment: ChatAttachmentPayload }) {
  const image = attachmentImage(attachment);
  const Icon = attachment.type === "author" ? UserRound : BookOpen;
  const isAuthor = attachment.type === "author";

  return image ? (
    <img
      src={image}
      alt=""
      className={cn(
        "object-cover",
        isAuthor ? "mx-auto h-24 w-24 rounded-full" : "h-36 w-full rounded-md bg-muted object-contain",
      )}
    />
  ) : (
    <div className={cn(
      "flex items-center justify-center bg-muted",
      isAuthor ? "mx-auto h-24 w-24 rounded-full" : "h-36 w-full rounded-md",
    )}>
      <Icon className="h-7 w-7 text-muted-foreground" />
    </div>
  );
}

function sharedSnapshotToBook(book: ChatSharedBookSnapshot): Book {
  return {
    id: book.id ?? `shared-${book.title}`,
    title: book.title,
    authors: book.authors,
    genres: book.genres ?? [],
    status: "To Read",
    cover_url: book.cover_url ?? undefined,
    rating: null,
    is_favorite: false,
    total_pages: book.total_pages ?? undefined,
    language: book.language ?? undefined,
    format: book.format ?? undefined,
    isbn: book.isbn ?? undefined,
    publication_date: book.publication_date ?? null,
    description: book.description ?? null,
    metadata_source: book.metadata_source ?? null,
    metadata_source_url: book.metadata_source_url ?? null,
    volume_number: book.volume_number ?? undefined,
    user_id: "",
    created_at: "",
  };
}

function AttachmentPreviewContent({
  attachment,
  onAddAuthorBookToLibrary,
  isBookSaved,
}: {
  attachment: ChatAttachmentPayload;
  onAddAuthorBookToLibrary?: (book: ChatSharedBookSnapshot) => void;
  isBookSaved?: (book: ChatSharedBookSnapshot) => boolean;
}) {
  const title = attachmentTitle(attachment);
  const secondaryInfo = attachmentSecondaryInfo(attachment);

  return (
    <div className="space-y-5">
      {attachment.type !== "note" && (
        <div className="flex gap-4">
          <AttachmentThumbnail attachment={attachment} />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">{attachmentTypeLabel(attachment)}</p>
            <h3 className="mt-1 text-lg font-semibold leading-snug">{title}</h3>
            {secondaryInfo && <p className="mt-1 text-sm text-muted-foreground">{secondaryInfo}</p>}
          </div>
        </div>
      )}

      {attachment.type === "book" && (
        <div className="space-y-3 text-sm">
          {attachment.book.description && <p className="whitespace-pre-wrap text-muted-foreground">{attachment.book.description}</p>}
          <p className="text-muted-foreground">
            {[attachment.book.language, attachment.book.format, attachment.book.total_pages ? `${attachment.book.total_pages} pages` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {attachment.book.included_journalEntries?.map((note, index) => (
            <div key={`${note.id ?? index}-${note.content}`} className="rounded-md border bg-muted/25 p-3">
              <p className="text-xs font-medium text-muted-foreground">{noteLabel(note.label)}</p>
              <p className="mt-1 whitespace-pre-wrap">{note.content}</p>
              {note.attribution && <p className="mt-1 text-xs text-muted-foreground">- {note.attribution}</p>}
            </div>
          ))}
        </div>
      )}

      {attachment.type === "note" && (
        <div className="rounded-md border bg-muted/25 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">{noteLabel(attachment.note.label)}</p>
          <p className="mt-1 whitespace-pre-wrap">{attachment.note.content}</p>
          {attachment.note.attribution && <p className="mt-2 text-xs text-muted-foreground">- {attachment.note.attribution}</p>}
          {attachment.note.source_title && <p className="mt-3 text-xs text-muted-foreground">From {attachment.note.source_title}</p>}
        </div>
      )}

      {attachment.type === "author" && (
        <div className="space-y-3 text-sm">
          {attachment.author.bio && <p className="whitespace-pre-wrap text-muted-foreground">{attachment.author.bio}</p>}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {attachment.author.books.map((book, index) => (
              <BookCard
                key={`${book.id ?? book.title}-${index}`}
                book={sharedSnapshotToBook(book)}
                showAuthor={false}
                footer={onAddAuthorBookToLibrary && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={isBookSaved?.(book)}
                    onClick={() => onAddAuthorBookToLibrary(book)}
                  >
                    {isBookSaved?.(book) ? "Added" : "Add to Library"}
                  </Button>
                )}
              />
            ))}
          </div>
        </div>
      )}

      {attachment.type === "series" && (
        <div className="space-y-3 text-sm">
          {attachment.series.description && <p className="whitespace-pre-wrap text-muted-foreground">{attachment.series.description}</p>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {attachment.series.books.map((book, index) => (
              <BookCard key={`${book.id ?? book.title}-${index}`} book={sharedSnapshotToBook(book)} showAuthor={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentCard({
  message,
  mine,
  saved,
  savingToLibrary,
  onOpenDetails,
  onAddToLibrary,
}: {
  message: GroupMessage;
  mine: boolean;
  saved: boolean;
  savingToLibrary: boolean;
  onOpenDetails: (preview: AttachmentPreviewState) => void;
  onAddToLibrary: () => void;
}) {
  if (!message.attachment_payload) return null;
  const attachment = message.attachment_payload as ChatAttachmentPayload;

  const secondaryInfo = attachmentSecondaryInfo(attachment);
  const actions = (
    <div className={cn("flex shrink-0 flex-col gap-1", mine ? "items-end" : "items-start")}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn("h-8 gap-1.5 px-2 text-xs", mine && "flex-row-reverse")}
        onClick={() => onOpenDetails({ message, attachment })}
      >
        <FileSearchCorner className="h-3.5 w-3.5" />
        See details
      </Button>
      {!mine && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={saved || savingToLibrary}
        className="h-8 gap-1.5 px-2 text-xs"
        onClick={onAddToLibrary}
      >
          {saved ? <CircleCheck className="h-3.5 w-3.5 text-emerald-700" /> : <CirclePlus className="h-3.5 w-3.5" />}
          Save to library
        </Button>
      )}
    </div>
  );

  return (
    <div className="mt-2 flex items-center gap-2">
      {mine && actions}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border bg-background p-2 text-left text-foreground shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onOpenDetails({ message, attachment })}
        aria-label={`View ${attachmentTitle(attachment)} details`}
      >
        {attachment.type === "note" ? (
          <div className="min-w-0 py-1 text-sm">
            <p className="text-xs font-medium text-muted-foreground">{noteLabel(attachment.note.label)}</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{attachment.note.content}</p>
          </div>
        ) : (
          <div className="min-w-0 flex-1 space-y-2">
            <AttachmentCardImage attachment={attachment} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{attachmentTitle(attachment)}</p>
              {secondaryInfo && <p className="truncate text-xs text-muted-foreground">{secondaryInfo}</p>}
            </div>
          </div>
        )}
      </button>
      {!mine && actions}
    </div>
  );
}

function formatAttachmentSaveReceipt(receipts: ChatAttachmentSaveReceipt[]): string | null {
  if (receipts.length === 0) return null;

  const names = receipts.map((receipt) => receipt.displayName);
  if (names.length === 1) return `${names[0]} saved this attachment to their library.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} saved this attachment to their library.`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} saved this attachment to their library.`;
}

export function GroupsManager() {
  const { user } = useAuth();
  const { authors: authorRecords, addAuthor, editAuthor } = useAuthorsContext();
  const { books, addBook, updateBook } = useBooksContext();
  const { series: librarySeries, addSeries, editSeries } = useSeries();
  const navigate = useNavigate();
  const location = useLocation();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [savedAttachmentMessageIds, setSavedAttachmentMessageIds] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [journalEntries, setJournalEntries] = useState<BookJournalEntryRecord[]>([]);
  const [seriesJournalEntries, setSeriesJournalEntries] = useState<SeriesJournalEntryRecord[]>([]);
  const [authorJournalEntries, setAuthorJournalEntries] = useState<AuthorJournalEntryRecord[]>([]);
  const [memberUsername, setMemberUsername] = useState("");
  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatSettingsMenuOpen, setChatSettingsMenuOpen] = useState(false);
  const [chatSettingsMenuPosition, setChatSettingsMenuPosition] = useState<ChatSettingsMenuPosition | null>(null);
  const [chatMuted, setChatMuted] = useState(false);
  const [chatSaveReceipts, setChatSaveReceipts] = useState(true);
  const [savingChatPreference, setSavingChatPreference] = useState(false);
  const [panelWidths, setPanelWidths] = useState<ChatPanelWidths>(getStoredChatPanelWidths);
  const [savingAttachmentMessageIds, setSavingAttachmentMessageIds] = useState<Set<string>>(new Set());
  const [addChatOpen, setAddChatOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [attachmentPicker, setAttachmentPicker] = useState<AttachmentPickerMode | null>(null);
  const [attachmentSearch, setAttachmentSearch] = useState("");
  const [attachmentPickerHeight, setAttachmentPickerHeight] = useState(360);
  const [selectedAttachment, setSelectedAttachment] = useState<ChatAttachmentPayload | null>(null);
  const [selectedReply, setSelectedReply] = useState<ChatReplySnapshot | null>(null);
  const [messageActionMenu, setMessageActionMenu] = useState<MessageActionMenu | null>(null);
  const [swipeReplyMessageId, setSwipeReplyMessageId] = useState<string | null>(null);
  const [swipeReplyOffset, setSwipeReplyOffset] = useState(0);
  const [attachmentSaveReceipts, setAttachmentSaveReceipts] = useState<ChatAttachmentSaveReceipt[]>([]);
  const [attachmentSaveReceiptsLoading, setAttachmentSaveReceiptsLoading] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreviewState | null>(null);
  const [attachmentSaveFeedback, setAttachmentSaveFeedback] = useState<AttachmentSaveFeedback | null>(null);
  const [noteImportMessage, setNoteImportMessage] = useState<GroupMessage | null>(null);
  const [noteImportTargetKind, setNoteImportTargetKind] = useState<JournalTargetKind>("book");
  const [noteImportTargetId, setNoteImportTargetId] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const shouldScrollToLatestRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const swipeReplyGestureRef = useRef<SwipeReplyGesture | null>(null);
  const attachmentPickerRef = useRef<HTMLDivElement>(null);
  const attachmentAddButtonRef = useRef<HTMLButtonElement>(null);
  const messagesLayoutRef = useRef<HTMLDivElement>(null);
  const attachmentSaveInFlightRef = useRef(new Set<string>());
  const attachmentSaveReceiptRequestRef = useRef(0);
  const chatSettingsMenuRef = useRef<HTMLDivElement>(null);
  const chatSettingsTriggerRef = useRef<HTMLButtonElement>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.group.id === selectedGroupId) ?? null,
    [threads, selectedGroupId],
  );

  const directChatProfile = useMemo(
    () => members.find((member) => member.user_id !== user?.id)?.profile,
    [members, user?.id],
  );

  const sharedAttachments = useMemo(
    () => messages.flatMap((message) => message.attachment_payload ? [{ id: message.id, attachment: message.attachment_payload }] : []),
    [messages],
  );

  const memberProfiles = useMemo(
    () =>
      new Map(
        members.map((member) => [member.user_id, member.profile]).filter((entry): entry is [string, PublicProfile] =>
          Boolean(entry[1]),
        ),
      ),
    [members],
  );

  const canManageSelectedGroup =
    selectedThread?.group.kind === "group" &&
    ["owner", "admin"].includes(selectedThread.currentMembership.role);

  const booksById = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books],
  );

  const authorSummaries = useMemo(
    () => buildAuthorSummaries(authorRecords, books, journalEntries),
    [authorRecords, books, journalEntries],
  );
  const seriesBooksById = useMemo(() => {
    const map = new Map<string, Book[]>();
    books.forEach((book) => {
      if (!book.series_id) return;
      map.set(book.series_id, [...(map.get(book.series_id) ?? []), book]);
    });
    return map;
  }, [books]);

  const filteredBooks = useMemo(() => {
    const query = attachmentSearch.trim().toLowerCase();
    const sorted = sortBooksByTitle(books);
    if (!query) return sorted;
    return sorted.filter((book) =>
      [book.title, ...book.authors].some((value) => value.toLowerCase().includes(query)),
    );
  }, [attachmentSearch, books]);

  const filteredJournalEntries = useMemo(() => {
    const query = attachmentSearch.trim().toLowerCase();
    const sorted: JournalAttachmentPickerItem[] = [
      ...journalEntries.map((entry) => {
        const book = booksById.get(entry.book_id);
        return {
          sourceType: "book" as const,
          sourceId: entry.book_id,
          sourceTitle: book?.title ?? "Unknown book",
          sourceAuthors: book?.authors ?? [],
          sourceImageUrl: book?.cover_url ?? null,
          entry,
        };
      }),
      ...seriesJournalEntries.map((entry) => {
        const series = librarySeries.find((item) => item.id === entry.series_id);
        const seriesBooks = seriesBooksById.get(entry.series_id) ?? [];
        return {
          sourceType: "series" as const,
          sourceId: entry.series_id,
          sourceTitle: series?.name ?? "Unknown series",
          sourceAuthors: Array.from(new Set(seriesBooks.flatMap((book) => book.authors))),
          sourceImageUrl: series?.cover_url ?? seriesBooks[0]?.cover_url ?? null,
          entry,
        };
      }),
      ...authorJournalEntries.map((entry) => {
        const author = authorRecords.find((item) => item.id === entry.author_id);
        return {
          sourceType: "author" as const,
          sourceId: entry.author_id,
          sourceTitle: author?.name ?? "Unknown author",
          sourceAuthors: [],
          sourceImageUrl: author?.photo_url ?? null,
          entry,
        };
      }),
    ].sort((first, second) => {
      const firstDate = first.entry.entry_date ?? first.entry.created_at;
      const secondDate = second.entry.entry_date ?? second.entry.created_at;
      return secondDate.localeCompare(firstDate) || second.entry.created_at.localeCompare(first.entry.created_at);
    });
    if (!query) return sorted;
    return sorted.filter((item) => {
      const note = item.entry;
      return [note.content, note.attribution, item.sourceTitle, ...item.sourceAuthors]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [attachmentSearch, authorJournalEntries, authorRecords, booksById, journalEntries, librarySeries, seriesBooksById, seriesJournalEntries]);

  const filteredAuthors = useMemo(() => {
    const query = attachmentSearch.trim().toLowerCase();
    if (!query) return authorSummaries;
    return authorSummaries.filter((author) => author.name.toLowerCase().includes(query));
  }, [attachmentSearch, authorSummaries]);

  const filteredSeries = useMemo(() => {
    const query = attachmentSearch.trim().toLowerCase();
    const sorted = sortSeriesByName(librarySeries);
    if (!query) return sorted;
    return sorted.filter((item) => item.name.toLowerCase().includes(query));
  }, [attachmentSearch, librarySeries]);

  const noteImportTargets = useMemo(() => {
    if (noteImportTargetKind === "book") {
      return sortBooksByTitle(books).map((book) => ({ id: book.id, label: book.title }));
    }
    if (noteImportTargetKind === "series") {
      return sortSeriesByName(librarySeries).map((series) => ({ id: series.id, label: series.name }));
    }
    return [...authorRecords]
      .sort((first, second) => first.name.localeCompare(second.name))
      .map((author) => ({ id: author.id, label: author.name }));
  }, [authorRecords, books, librarySeries, noteImportTargetKind]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchAllBookJournalEntryRecords(),
      fetchAllSeriesJournalEntryRecords(),
      fetchAllAuthorJournalEntryRecords(),
    ])
      .then(([nextBookEntries, nextSeriesEntries, nextAuthorEntries]) => {
        if (cancelled) return;
        setJournalEntries(nextBookEntries);
        setSeriesJournalEntries(nextSeriesEntries);
        setAuthorJournalEntries(nextAuthorEntries);
      })
      .catch(() => {
        if (cancelled) return;
        setJournalEntries([]);
        setSeriesJournalEntries([]);
        setAuthorJournalEntries([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const state = location.state as { openAttachmentPicker?: OpenAttachmentState } | null;
    const launch = state?.openAttachmentPicker;
    if (!launch) return;

    setAttachmentPicker(launch.type);
    setAttachmentSearch("");

    navigate(location.pathname + location.search, { replace: true });
  }, [location.key, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const state = location.state as { preferredGroupId?: string } | null;
    if (!state?.preferredGroupId) return;

    void loadThreads(state.preferredGroupId);
    setMobileThreadOpen(true);
    navigate(location.pathname + location.search, { replace: true });
  }, [location.key, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!attachmentPicker) return;

    function closeAttachmentPicker(event: PointerEvent) {
      const target = event.target as Node;
      if (attachmentPickerRef.current?.contains(target) || attachmentAddButtonRef.current?.contains(target)) return;
      setAttachmentPicker(null);
    }

    document.addEventListener("pointerdown", closeAttachmentPicker);
    return () => document.removeEventListener("pointerdown", closeAttachmentPicker);
  }, [attachmentPicker]);

  useEffect(() => {
    if (!chatSettingsMenuOpen) return;

    function closeChatSettingsMenu(event: PointerEvent) {
      const target = event.target as Node;
      if (!chatSettingsMenuRef.current?.contains(target) && !chatSettingsTriggerRef.current?.contains(target)) {
        setChatSettingsMenuOpen(false);
        setChatSettingsMenuPosition(null);
      }
    }

    function closeChatSettingsMenuWithKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setChatSettingsMenuOpen(false);
      setChatSettingsMenuPosition(null);
      chatSettingsTriggerRef.current?.focus();
    }

    function closeChatSettingsMenuForViewportChange() {
      setChatSettingsMenuOpen(false);
      setChatSettingsMenuPosition(null);
    }

    document.addEventListener("pointerdown", closeChatSettingsMenu);
    document.addEventListener("keydown", closeChatSettingsMenuWithKeyboard);
    window.addEventListener("scroll", closeChatSettingsMenuForViewportChange, true);
    window.addEventListener("resize", closeChatSettingsMenuForViewportChange);
    return () => {
      document.removeEventListener("pointerdown", closeChatSettingsMenu);
      document.removeEventListener("keydown", closeChatSettingsMenuWithKeyboard);
      window.removeEventListener("scroll", closeChatSettingsMenuForViewportChange, true);
      window.removeEventListener("resize", closeChatSettingsMenuForViewportChange);
    };
  }, [chatSettingsMenuOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_PANEL_WIDTHS_STORAGE_KEY, JSON.stringify(panelWidths));
    } catch {
      // Layout preference persistence is optional when browser storage is unavailable.
    }
  }, [panelWidths]);

  useEffect(() => {
    function clampPanelWidthsToViewport() {
      const containerWidth = messagesLayoutRef.current?.clientWidth;
      if (!containerWidth) return;

      setPanelWidths((current) => {
        const chatBounds = getChatPanelWidthBounds({
          panel: "chats",
          containerWidth,
          widths: current,
          detailsVisible: settingsOpen,
        });
        const chats = Math.min(Math.max(current.chats, chatBounds.min), chatBounds.max);
        const detailsBounds = getChatPanelWidthBounds({
          panel: "details",
          containerWidth,
          widths: { ...current, chats },
          detailsVisible: settingsOpen,
        });
        const details = Math.min(Math.max(current.details, detailsBounds.min), detailsBounds.max);

        return chats === current.chats && details === current.details ? current : { chats, details };
      });
    }

    clampPanelWidthsToViewport();
    window.addEventListener("resize", clampPanelWidthsToViewport);
    return () => window.removeEventListener("resize", clampPanelWidthsToViewport);
  }, [settingsOpen]);

  useEffect(() => {
    if (!selectedGroupId || !user) {
      setChatMuted(false);
      setChatSaveReceipts(true);
      return;
    }

    let cancelled = false;
    void getChatNotificationPreferences(selectedGroupId)
      .then((preferences) => {
        if (cancelled) return;
        setChatMuted(preferences.isMuted);
        setChatSaveReceipts(preferences.saveReceipts);
      })
      .catch((loadError) => {
        if (!cancelled) setError(toChatErrorMessage(loadError, "Could not load chat settings."));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, user?.id]);

  async function loadThreads(preferredGroupId?: string) {
    if (!user) return;

    setError(null);
    try {
      const nextThreads = await getChatThreads(user.id);
      setThreads(nextThreads);
      setSelectedGroupId((current) => {
        if (preferredGroupId && nextThreads.some((thread) => thread.group.id === preferredGroupId)) {
          return preferredGroupId;
        }
        if (nextThreads.some((thread) => thread.group.id === current)) return current;
        return nextThreads[0]?.group.id ?? "";
      });
    } catch (loadError) {
      setError(toChatErrorMessage(loadError, "Could not load chats."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadThreads();
  }, [user?.id]);

  useEffect(() => {
    if (!selectedGroupId || !user) {
      setMessages([]);
      setMembers([]);
      setSavedAttachmentMessageIds(new Set());
      return;
    }

    let cancelled = false;
    setMessagesLoading(true);
    setError(null);

    Promise.all([getChatMessages(selectedGroupId), getChatMembers(selectedGroupId)])
      .then(async ([nextMessages, nextMembers]) => {
        if (cancelled) return;
        const savedIds = await getSavedChatAttachmentMessageIds(
          nextMessages
            .filter((message) => message.attachment_payload)
            .map((message) => message.id),
        );
        if (cancelled) return;
        setMessages(nextMessages);
        setMembers(nextMembers);
        setSavedAttachmentMessageIds(savedIds);
        await markChatRead(selectedGroupId);
        if (!cancelled) {
          setThreads((current) =>
            current.map((thread) =>
              thread.group.id === selectedGroupId ? { ...thread, unreadCount: 0 } : thread,
            ),
          );
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(toChatErrorMessage(loadError, "Could not load this chat."));
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, user?.id]);

  useEffect(() => {
    if (!selectedGroupId || !user) return;

    const channel = supabase
      .channel(`group-messages:${selectedGroupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${selectedGroupId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldMessage = messageFromPayload(payload.old);
            setMessages((current) => current.filter((message) => message.id !== oldMessage.id));
            return;
          }

          const nextMessage = messageFromPayload(payload.new);
          void getChatMessages(selectedGroupId)
            .then(async (nextMessages) => {
              const savedIds = await getSavedChatAttachmentMessageIds(
                nextMessages
                  .filter((message) => message.attachment_payload)
                  .map((message) => message.id),
              );
              setMessages(nextMessages);
              setSavedAttachmentMessageIds(savedIds);
            })
            .catch(() => setMessages((current) => upsertMessage(current, nextMessage)));
          void loadThreads(selectedGroupId);

          void markChatRead(selectedGroupId).catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedGroupId, user?.id]);

  useEffect(() => {
    shouldScrollToLatestRef.current = true;
  }, [selectedGroupId]);

  useLayoutEffect(() => {
    if (messagesLoading || !shouldScrollToLatestRef.current) return;
    const scrollContainer = messagesScrollRef.current;
    if (!scrollContainer) return;

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    shouldScrollToLatestRef.current = false;
  }, [messages, messagesLoading, selectedGroupId]);

  useEffect(() => {
    setSelectedReply(null);
    setMessageActionMenu(null);
    setSwipeReplyMessageId(null);
    setSwipeReplyOffset(0);
    swipeReplyGestureRef.current = null;
    setSettingsOpen(false);
  }, [selectedGroupId]);

  useEffect(() => {
    function closeFloatingMenus() {
      setMessageActionMenu(null);
    }

    window.addEventListener("click", closeFloatingMenus);
    window.addEventListener("scroll", closeFloatingMenus, true);
    return () => {
      window.removeEventListener("click", closeFloatingMenus);
      window.removeEventListener("scroll", closeFloatingMenus, true);
    };
  }, []);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function resetSwipeReplyGesture() {
    swipeReplyGestureRef.current = null;
    setSwipeReplyMessageId(null);
    setSwipeReplyOffset(0);
  }

  function startMessageTouch(message: GroupMessage, event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1 || !window.matchMedia("(max-width: 1023px)").matches) return;

    const touch = event.touches[0];
    swipeReplyGestureRef.current = {
      messageId: message.id,
      startX: touch.clientX,
      startY: touch.clientY,
      direction: "pending",
    };
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      openMessageActionMenu(message, touch.clientX, touch.clientY);
      resetSwipeReplyGesture();
    }, 550);
  }

  function moveMessageTouch(event: ReactTouchEvent<HTMLDivElement>) {
    const gesture = swipeReplyGestureRef.current;
    if (!gesture || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;

    if (gesture.direction === "pending") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_DIRECTION_LOCK_DISTANCE) return;
      gesture.direction = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (gesture.direction !== "horizontal") {
      clearLongPressTimer();
      return;
    }

    clearLongPressTimer();
    if (event.cancelable) event.preventDefault();

    const offset = -Math.min(Math.max(-deltaX, 0), SWIPE_REPLY_MAX_DISTANCE);
    setSwipeReplyMessageId(gesture.messageId);
    setSwipeReplyOffset(offset);
  }

  function endMessageTouch(message: GroupMessage, event: ReactTouchEvent<HTMLDivElement>) {
    const gesture = swipeReplyGestureRef.current;
    clearLongPressTimer();

    if (!gesture || gesture.messageId !== message.id) return;

    const touch = event.changedTouches[0];
    const distance = touch ? gesture.startX - touch.clientX : 0;
    const shouldReply = gesture.direction === "horizontal" && distance >= SWIPE_REPLY_TRIGGER_DISTANCE;
    resetSwipeReplyGesture();

    if (shouldReply) startReply(message, memberProfiles.get(message.sender_id));
  }

  function openMessageActionMenu(message: GroupMessage, x: number, y: number) {
    if (message.deleted_at) return;
    setMessageActionMenu({ messageId: message.id, x, y });
  }

  function openAttachmentPreview(preview: AttachmentPreviewState) {
    setAttachmentPreview(preview);
    setAttachmentSaveReceipts([]);
    setAttachmentSaveReceiptsLoading(false);

    if (preview.message.sender_id !== user?.id) return;

    const requestId = ++attachmentSaveReceiptRequestRef.current;
    setAttachmentSaveReceiptsLoading(true);
    void getChatAttachmentSaveReceipts(preview.message.id)
      .then((receipts) => {
        if (attachmentSaveReceiptRequestRef.current === requestId) {
          setAttachmentSaveReceipts(receipts);
        }
      })
      .catch(() => {
        if (attachmentSaveReceiptRequestRef.current === requestId) {
          setAttachmentSaveReceipts([]);
        }
      })
      .finally(() => {
        if (attachmentSaveReceiptRequestRef.current === requestId) {
          setAttachmentSaveReceiptsLoading(false);
        }
      });
  }

  function startReply(message: GroupMessage, senderProfile?: PublicProfile) {
    setSelectedReply(
      buildReplySnapshot({
        message,
        senderName: message.sender_id === user?.id ? "You" : profileLabel(senderProfile),
      }),
    );
    setMessageActionMenu(null);
  }

  function closeChatDetails() {
    setChatSettingsMenuOpen(false);
    setChatSettingsMenuPosition(null);
    setSettingsOpen(false);
  }

  function toggleChatSettingsMenu() {
    if (chatSettingsMenuOpen) {
      setChatSettingsMenuOpen(false);
      setChatSettingsMenuPosition(null);
      return;
    }

    const triggerBounds = chatSettingsTriggerRef.current?.getBoundingClientRect();
    if (!triggerBounds) return;

    setChatSettingsMenuPosition({
      top: triggerBounds.bottom + 8,
      right: Math.max(12, window.innerWidth - triggerBounds.right),
    });
    setChatSettingsMenuOpen(true);
  }

  function adjustPanelWidth(panel: keyof ChatPanelWidths, delta: number) {
    const containerWidth = messagesLayoutRef.current?.clientWidth ?? 0;
    if (containerWidth === 0) return;

    setPanelWidths((current) => {
      const bounds = getChatPanelWidthBounds({
        panel,
        containerWidth,
        widths: current,
        detailsVisible: settingsOpen,
      });
      const nextWidth = Math.min(Math.max(current[panel] + delta, bounds.min), bounds.max);
      return nextWidth === current[panel] ? current : { ...current, [panel]: nextWidth };
    });
  }

  function startPanelResize(panel: keyof ChatPanelWidths, event: ReactPointerEvent<HTMLDivElement>) {
    if (window.innerWidth < 1024) return;

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidths[panel];
    const containerWidth = messagesLayoutRef.current?.clientWidth ?? 0;
    if (containerWidth === 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    function resizePanel(moveEvent: PointerEvent) {
      const horizontalDelta = moveEvent.clientX - startX;
      const delta = panel === "chats" ? horizontalDelta : -horizontalDelta;
      setPanelWidths((current) => {
        const bounds = getChatPanelWidthBounds({
          panel,
          containerWidth,
          widths: current,
          detailsVisible: settingsOpen,
        });
        const nextWidth = Math.min(Math.max(startWidth + delta, bounds.min), bounds.max);
        return nextWidth === current[panel] ? current : { ...current, [panel]: nextWidth };
      });
    }

    function stopPanelResize() {
      window.removeEventListener("pointermove", resizePanel);
      window.removeEventListener("pointerup", stopPanelResize);
    }

    window.addEventListener("pointermove", resizePanel);
    window.addEventListener("pointerup", stopPanelResize);
  }

  function handlePanelResizeKeyDown(panel: keyof ChatPanelWidths, event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const movesRight = event.key === "ArrowRight";
    const delta = panel === "chats"
      ? (movesRight ? 16 : -16)
      : (movesRight ? -16 : 16);
    adjustPanelWidth(panel, delta);
  }

  function renderPanelResizeHandle(panel: keyof ChatPanelWidths) {
    const label = panel === "chats" ? "Resize chats panel" : "Resize chat details panel";
    const value = panelWidths[panel];
    const min = panel === "chats" ? CHAT_LIST_MIN_WIDTH : CHAT_DETAILS_MIN_WIDTH;

    return (
      <div
        role="separator"
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={CHAT_PANEL_MAX_WIDTH}
        aria-valuenow={value}
        tabIndex={0}
        className="group hidden h-full cursor-col-resize touch-none select-none lg:relative lg:block"
        onPointerDown={(event) => startPanelResize(panel, event)}
        onKeyDown={(event) => handlePanelResizeKeyDown(panel, event)}
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary/60 group-focus-visible:bg-primary group-focus-visible:outline-none" />
      </div>
    );
  }

  async function updateChatPreferences(nextPreferences: { isMuted: boolean; saveReceipts: boolean }) {
    if (!selectedGroupId || !user || savingChatPreference) return;

    const previousPreferences = { isMuted: chatMuted, saveReceipts: chatSaveReceipts };
    setChatMuted(nextPreferences.isMuted);
    setChatSaveReceipts(nextPreferences.saveReceipts);
    setSavingChatPreference(true);
    setError(null);

    try {
      await setChatNotificationPreferences(user.id, selectedGroupId, nextPreferences);
    } catch (saveError) {
      setChatMuted(previousPreferences.isMuted);
      setChatSaveReceipts(previousPreferences.saveReceipts);
      setError(toChatErrorMessage(saveError, "Could not update chat settings."));
    } finally {
      setSavingChatPreference(false);
    }
  }

  function updateChatMuted(isMuted: boolean) {
    return updateChatPreferences({ isMuted, saveReceipts: chatSaveReceipts });
  }

  function updateChatSaveReceipts(saveReceipts: boolean) {
    return updateChatPreferences({ isMuted: chatMuted, saveReceipts });
  }

  async function copyMessageText(message: GroupMessage) {
    if (!message.content.trim()) return;
    setMessageActionMenu(null);
    try {
      await navigator.clipboard.writeText(message.content);
      setStatusMessage("Message copied.");
    } catch {
      setError("Could not copy message.");
    }
  }

  function renderSettingsPanelContent({ showHeading = true }: { showHeading?: boolean } = {}) {
    return (
      <div className="space-y-4">
        {showHeading && (
          <div>
            <AppHeading level={4} as="h2">Chat Settings</AppHeading>
            <HeadingDescription>
              {members.length} member{members.length === 1 ? "" : "s"}
            </HeadingDescription>
          </div>
        )}

        {canManageSelectedGroup && (
          <form className="flex gap-2" onSubmit={submitMember}>
            <Input
              aria-label="Member username"
              placeholder="username"
              value={memberUsername}
              onChange={(event) => setMemberUsername(event.target.value)}
            />
            <Button type="submit" size="icon" variant="outline" disabled={saving || !memberUsername.trim()}>
              <UserPlus className="h-4 w-4" />
            </Button>
          </form>
        )}

        <div className="space-y-2">
          {members.map((member) => {
            const canEditMember =
              canManageSelectedGroup && member.user_id !== user?.id && member.role !== "owner";
            return (
              <div key={member.user_id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <MessageAvatar profile={member.profile} fallback={member.user_id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.user_id === user?.id ? "You" : profileLabel(member.profile)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {profileSubLabel(member.profile)} · {member.role}
                    </p>
                  </div>
                </div>

                {canEditMember && (
                  <div className="flex gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(value) => changeRole(member.user_id, value as GroupMembershipRole)}
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmAction({ type: "member", userId: member.user_id })}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedThread?.group.kind === "group" && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => user && setConfirmAction({ type: "leave", userId: user.id })}
            disabled={saving}
          >
            Leave group
          </Button>
        )}
      </div>
    );
  }

  function renderChatDetails() {
    const profileHref = directChatProfile ? `/profiles/${directChatProfile.id}` : null;
    const chatPersonName = selectedThread?.title || "This person";
    const settingsMenuPortalTarget = typeof document === "undefined" ? null : document.body;
    const profileContent = (
      <div className="flex min-w-0 items-center gap-3">
        <MessageAvatar profile={selectedThread?.avatarProfile} fallback={selectedThread?.title} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{selectedThread?.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {selectedThread?.group.kind === "direct" ? profileSubLabel(directChatProfile) : `${members.length} members`}
          </p>
        </div>
      </div>
    );

    return (
      <aside className="absolute inset-0 z-10 min-h-0 overflow-y-auto bg-background p-4 lg:static lg:z-auto lg:border-l">
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="lg:hidden"
              aria-label="Back to messages"
              onClick={closeChatDetails}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <AppHeading level={4} as="h2">Chat Details</AppHeading>
            <div className="ml-auto flex items-center gap-1">
              <Button
                ref={chatSettingsTriggerRef}
                type="button"
                size="icon"
                variant="ghost"
                title="Chat settings"
                aria-label="Chat settings"
                aria-expanded={chatSettingsMenuOpen}
                onClick={toggleChatSettingsMenu}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Close chat details"
                onClick={closeChatDetails}
              >
                <X className="h-4 w-4" />
              </Button>
              {chatSettingsMenuOpen && chatSettingsMenuPosition && settingsMenuPortalTarget && createPortal(
                <div
                  ref={chatSettingsMenuRef}
                  className="fixed z-[70] w-[min(20rem,calc(100vw-1.5rem))] rounded-md border bg-popover p-3 text-popover-foreground shadow-[var(--shadow-popover)]"
                  style={{ top: chatSettingsMenuPosition.top, right: chatSettingsMenuPosition.right }}
                >
                  <ChatSettingToggle
                    label="Mute this chat"
                    checked={chatMuted}
                    disabled={savingChatPreference}
                    onCheckedChange={(isMuted) => void updateChatMuted(isMuted)}
                  />
                  <ChatSettingToggle
                    label={`Reading Activity visible for ${chatPersonName}`}
                    description={`${chatPersonName} can see what you're reading when you have reading activity turned on.`}
                    checked={false}
                    disabled
                  />
                  <ChatSettingToggle
                    label="Save receipts"
                    description={`${chatPersonName} can see when you've saved something that they send you.`}
                    checked={chatSaveReceipts}
                    disabled={savingChatPreference}
                    onCheckedChange={(saveReceipts) => void updateChatSaveReceipts(saveReceipts)}
                  />
                </div>,
                settingsMenuPortalTarget,
              )}
            </div>
          </div>

          {profileHref ? (
            <Link
              to={profileHref}
              className="block rounded-md p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {profileContent}
            </Link>
          ) : (
            <div className="rounded-md p-2">{profileContent}</div>
          )}

          <section className="space-y-2">
            <div>
              <AppHeading level={4} as="h3">Shared</AppHeading>
              <HeadingDescription className="text-xs">
                {sharedAttachments.length} item{sharedAttachments.length === 1 ? "" : "s"}
              </HeadingDescription>
            </div>
            {sharedAttachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shared content yet.</p>
            ) : (
              <div className="space-y-1">
                {sharedAttachments.map(({ id, attachment }) => {
                  const href = attachmentHref(attachment);
                  const item = (
                    <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 hover:bg-muted">
                      <Badge variant="outline" className="shrink-0">{attachmentTypeLabel(attachment)}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm">{attachmentTitle(attachment)}</span>
                      {href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </div>
                  );
                  return href ? (
                    <Link key={id} to={href} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {item}
                    </Link>
                  ) : (
                    <div key={id}>{item}</div>
                  );
                })}
              </div>
            )}
          </section>

          {selectedThread?.group.kind === "group" && (
            <section className="space-y-2">
              <AppHeading level={4} as="h3">Members</AppHeading>
              {renderSettingsPanelContent({ showHeading: false })}
            </section>
          )}
        </div>
      </aside>
    );
  }

  function startAttachmentPickerResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = attachmentPickerHeight;

    function resizePicker(moveEvent: PointerEvent) {
      setAttachmentPickerHeight(Math.min(600, Math.max(240, startHeight + startY - moveEvent.clientY)));
    }

    function stopResizing() {
      window.removeEventListener("pointermove", resizePicker);
      window.removeEventListener("pointerup", stopResizing);
    }

    window.addEventListener("pointermove", resizePicker);
    window.addEventListener("pointerup", stopResizing);
  }

  function renderChatComposer() {
    function chooseAttachment(attachment: ChatAttachmentPayload) {
      setSelectedAttachment(attachment);
      setAttachmentPicker(null);
      setAttachmentSearch("");
    }

    return (
      <form className="relative space-y-2 bg-background p-3" onSubmit={submitMessage}>
        {selectedReply && <ReplyPreview reply={selectedReply} onCancel={() => setSelectedReply(null)} />}

        {selectedAttachment && (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <AttachmentSummary attachment={selectedAttachment} />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove attachment"
              onClick={() => setSelectedAttachment(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {attachmentPicker && (
          <div
            ref={attachmentPickerRef}
            className="absolute right-3 bottom-full left-3 z-40 mb-2 flex overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] sm:left-auto sm:w-[34rem]"
            style={{ height: `${attachmentPickerHeight}px` }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1 flex-col">
            <button
              type="button"
              aria-label="Resize shared content picker"
              className="flex h-6 shrink-0 cursor-ns-resize touch-none items-center justify-center border-b hover:bg-muted"
              onPointerDown={startAttachmentPickerResize}
            >
              <span className="h-1 w-10 rounded-full bg-muted-foreground/45" />
            </button>
            <div className="space-y-3 border-b p-3">
              <Input
                aria-label="Search shared content"
                placeholder={`Search ${attachmentPicker === "note" ? "journal entries" : `${attachmentPicker}s`}`}
                value={attachmentSearch}
                onChange={(event) => setAttachmentSearch(event.target.value)}
              />
              <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
                {([
                  ["book", "Books", BookOpen],
                  ["author", "Authors", UserRound],
                  ["series", "Series", LibraryBig],
                  ["note", "Entries", StickyNote],
                ] as const).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      "flex min-h-8 items-center justify-center gap-1 rounded px-1 text-xs font-medium transition-colors hover:bg-background",
                      attachmentPicker === mode && "bg-background shadow-sm",
                    )}
                    onClick={() => {
                      setAttachmentPicker(mode);
                      setAttachmentSearch("");
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {attachmentPicker === "book" && filteredBooks.map((book) => (
                <div key={book.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-muted">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{book.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => chooseAttachment(buildBookAttachment(book, [], authorRecords))}>
                    Add
                  </Button>
                </div>
              ))}

              {attachmentPicker === "author" && filteredAuthors.map((author) => (
                <div key={author.name} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
                  <UserRound className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{author.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {author.bookCount} book{author.bookCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => chooseAttachment(buildAuthorAttachment({
                      authorId: author.id,
                      authorName: author.name,
                      authorPhotoUrl: authorRecords.find((item) => item.id === author.id)?.photo_url,
                      authorBio: authorRecords.find((item) => item.id === author.id)?.bio,
                      books: author.books,
                      includedQuotes: [],
                    }))}
                  >
                    Add
                  </Button>
                </div>
              ))}

              {attachmentPicker === "series" && filteredSeries.map((item) => {
                const booksInSeries = sortBooksByTitle(seriesBooksById.get(item.id) ?? []);
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
                    <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {booksInSeries.length} book{booksInSeries.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => chooseAttachment(buildSeriesAttachment({
                        seriesId: item.id,
                        seriesName: item.name,
                        seriesCoverUrl: item.cover_url,
                        seriesDescription: item.description,
                        books: booksInSeries,
                        authorProfiles: authorRecords,
                        includedQuotes: [],
                      }))}
                    >
                      Add
                    </Button>
                  </div>
                );
              })}

              {attachmentPicker === "note" && (
                filteredJournalEntries.length > 0 ? filteredJournalEntries.map((item) => {
                  const note = item.entry;
                  return (
                    <div
                      key={`${item.sourceType}-${note.id}`}
                      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md p-2 hover:bg-muted"
                    >
                      <StickyNote className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{note.content}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {noteLabel(note.label)} - {item.sourceTitle}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 whitespace-nowrap"
                        onClick={() => chooseAttachment(buildNoteAttachment(note, {
                          type: item.sourceType,
                          id: item.sourceId,
                          title: item.sourceTitle,
                          authors: item.sourceAuthors,
                          imageUrl: item.sourceImageUrl,
                        }))}
                      >
                        Add
                      </Button>
                    </div>
                  );
                }) : (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No journal entries found.
                  </p>
                )
              )}
            </div>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <Textarea
              aria-label="Message"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
              placeholder="Write a message"
              rows={2}
              className="min-h-12 resize-none rounded-full px-4 py-3 pr-24"
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
              <Button
                ref={attachmentAddButtonRef}
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-foreground hover:bg-muted"
                aria-label="Add shared content"
                onClick={() => {
                  setAttachmentPicker((current) => current ? null : "book");
                  setAttachmentSearch("");
                }}
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-foreground hover:bg-muted"
                aria-label="Stickers"
              >
                <Sticker className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            disabled={saving || (!messageText.trim() && !selectedAttachment)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    );
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThread || !memberUsername.trim()) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      await addGroupMemberByUsername(selectedThread.group.id, memberUsername);
      setMemberUsername("");
      setStatusMessage("Member added.");
      setMembers(await getChatMembers(selectedThread.group.id));
      await loadThreads(selectedThread.group.id);
    } catch (memberError) {
      setError(toChatErrorMessage(memberError, "Could not add member."));
    } finally {
      setSaving(false);
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThread || !user || (!messageText.trim() && !selectedAttachment)) return;

    setSaving(true);
    setError(null);

    try {
      const message = await sendChatMessage(
        selectedThread.group.id,
        user.id,
        messageText,
        selectedAttachment,
        selectedReply,
      );
      setMessages((current) => upsertMessage(current, message));
      setMessageText("");
      setSelectedAttachment(null);
      setSelectedReply(null);
      await markChatRead(selectedThread.group.id);
      await loadThreads(selectedThread.group.id);
    } catch (sendError) {
      setError(toChatErrorMessage(sendError, "Could not send message."));
    } finally {
      setSaving(false);
    }
  }

  async function markAttachmentSaved(messageId: string) {
    if (!user) return;
    await saveChatAttachment(user.id, messageId);
    setSavedAttachmentMessageIds((current) => new Set(current).add(messageId));
  }

  function setAttachmentImporting(messageId: string, importing: boolean) {
    if (importing) {
      attachmentSaveInFlightRef.current.add(messageId);
    } else {
      attachmentSaveInFlightRef.current.delete(messageId);
    }

    setSavingAttachmentMessageIds((current) => {
      const next = new Set(current);
      if (importing) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  }

  function showAttachmentSaveFeedback(description: string, libraryHref: string) {
    setAttachmentPreview(null);
    setAttachmentSaveFeedback({ description, libraryHref });
  }

  async function importBookSnapshot(
    messageId: string,
    book: ChatSharedBookSnapshot,
    sourceBookId?: string,
  ) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      let imageCopyError: string | null = null;
      const result = await addBook(importPayloadForBookSnapshot(book));
      if (book.cover_url) {
        try {
          const coverUrl = await copyChatAttachmentImage(messageId, "book", result.book.id, sourceBookId);
          await updateBook(result.book.id, { cover_url: coverUrl });
        } catch (copyError) {
          imageCopyError = imageCopyErrorMessage(copyError);
        }
      }
      if (!sourceBookId) {
        imageCopyError ??= await importAuthorPhotosForBookSnapshot({
          messageId,
          attachmentType: "book",
          book,
          addAuthor,
          editAuthor,
        });
      }
      await markAttachmentSaved(messageId);
      showAttachmentSaveFeedback(
        imageCopyError
          ? `Book saved, but one or more images could not be copied: ${imageCopyError}`
          : "Book, cover, and author profile pictures saved to your library.",
        `/books/${result.book.id}`,
      );
    } catch (importError) {
      setError(toChatErrorMessage(importError, "Could not save book."));
    } finally {
      setSaving(false);
    }
  }

  async function importSeriesAttachment(
    messageId: string,
    seriesSnapshot: Extract<ChatAttachmentPayload, { type: "series" }>["series"],
  ) {
    if (!user) return;
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      let imageCopyError: string | null = null;
      const existingSeries = librarySeries.find(
        (item) => item.name.trim().toLowerCase() === seriesSnapshot.name.trim().toLowerCase(),
      );
      let savedSeries = existingSeries ?? await addSeries({
        name: seriesSnapshot.name,
        description: seriesSnapshot.description ?? undefined,
      });

      if (seriesSnapshot.cover_url && (!existingSeries || !existingSeries.cover_url)) {
        try {
          const coverUrl = await copyChatAttachmentImage(messageId, "series", savedSeries.id);
          savedSeries = await editSeries(savedSeries.id, { cover_url: coverUrl });
        } catch (copyError) {
          imageCopyError ??= imageCopyErrorMessage(copyError);
        }
      }

      for (const book of seriesSnapshot.books) {
        const result = await addBook(importPayloadForBookSnapshot(book, savedSeries.id));
        if (book.cover_url) {
          try {
            const coverUrl = await copyChatAttachmentImage(messageId, "book", result.book.id, book.id);
            await updateBook(result.book.id, { cover_url: coverUrl });
          } catch (copyError) {
            imageCopyError ??= imageCopyErrorMessage(copyError);
          }
        }
        imageCopyError ??= await importAuthorPhotosForBookSnapshot({
          messageId,
          attachmentType: "series",
          book,
          sourceBookId: book.id,
          addAuthor,
          editAuthor,
        });
      }

      await markAttachmentSaved(messageId);
      showAttachmentSaveFeedback(
        imageCopyError
          ? `Series saved, but one or more images could not be copied: ${imageCopyError}`
          : "Series, books, covers, and author profile pictures saved to your library.",
        `/series/${savedSeries.id}`,
      );
    } catch (importError) {
      setError(toChatErrorMessage(importError, "Could not save series."));
    } finally {
      setSaving(false);
    }
  }

  async function importAuthorAttachment(
    messageId: string,
    authorSnapshot: Extract<ChatAttachmentPayload, { type: "author" }>["author"],
  ) {
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      let imageCopyError: string | null = null;
      let savedAuthor = await addAuthor({
        name: authorSnapshot.name,
        bio: authorSnapshot.bio ?? null,
      });
      if (authorSnapshot.photo_url && !savedAuthor.photo_url) {
        try {
          const photoUrl = await copyChatAttachmentImage(messageId, "author", savedAuthor.id);
          savedAuthor = await editAuthor(savedAuthor.id, {
            name: savedAuthor.name,
            bio: savedAuthor.bio ?? null,
            is_favorite: savedAuthor.is_favorite,
            photo_url: photoUrl,
          });
        } catch (copyError) {
          imageCopyError = imageCopyErrorMessage(copyError);
        }
      }
      await markAttachmentSaved(messageId);
      showAttachmentSaveFeedback(
        imageCopyError
          ? `Author saved, but their profile picture could not be copied: ${imageCopyError}`
          : "Author and profile picture saved to your library.",
        `/authors/${encodeURIComponent(savedAuthor.id)}`,
      );
    } catch (importError) {
      setError(toChatErrorMessage(importError, "Could not save author."));
    } finally {
      setSaving(false);
    }
  }

  function startAttachmentImport(message: GroupMessage) {
    if (!message.attachment_payload) return;
    if (saving || savedAttachmentMessageIds.has(message.id) || attachmentSaveInFlightRef.current.has(message.id)) return;

    if (message.attachment_payload.type === "book") {
      setAttachmentImporting(message.id, true);
      void importBookSnapshot(message.id, message.attachment_payload.book)
        .finally(() => setAttachmentImporting(message.id, false));
      return;
    }
    if (message.attachment_payload.type === "author") {
      setAttachmentImporting(message.id, true);
      void importAuthorAttachment(message.id, message.attachment_payload.author)
        .finally(() => setAttachmentImporting(message.id, false));
      return;
    }
    if (message.attachment_payload.type === "series") {
      setAttachmentImporting(message.id, true);
      void importSeriesAttachment(message.id, message.attachment_payload.series)
        .finally(() => setAttachmentImporting(message.id, false));
      return;
    }
    setNoteImportMessage(message);
    setNoteImportTargetKind("book");
    setNoteImportTargetId("");
  }

  function findMatchingBook(bookSnapshot: ChatSharedBookSnapshot): Book | undefined {
    const title = bookSnapshot.title.trim().toLocaleLowerCase();
    const authors = bookSnapshot.authors
      .map((author) => author.trim().toLocaleLowerCase())
      .sort()
      .join("|");

    return books.find((book) => {
      if (bookSnapshot.isbn && book.isbn === bookSnapshot.isbn) return true;
      return book.title.trim().toLocaleLowerCase() === title
        && book.authors.map((author) => author.trim().toLocaleLowerCase()).sort().join("|") === authors;
    });
  }

  function isBookSnapshotSaved(bookSnapshot: ChatSharedBookSnapshot): boolean {
    return Boolean(findMatchingBook(bookSnapshot));
  }

  function getAttachmentLibraryHref(attachment: ChatAttachmentPayload): string {
    if (attachment.type === "book") {
      const matchingBook = findMatchingBook(attachment.book);
      return matchingBook ? `/books/${matchingBook.id}` : "/library";
    }

    if (attachment.type === "author") {
      const matchingAuthor = authorRecords.find(
        (author) => author.id === attachment.author.id || author.name.trim().toLocaleLowerCase() === attachment.author.name.trim().toLocaleLowerCase(),
      );
      return matchingAuthor ? `/authors/${encodeURIComponent(matchingAuthor.id)}` : "/authors";
    }

    if (attachment.type === "series") {
      const matchingSeries = librarySeries.find(
        (series) => series.id === attachment.series.id || series.name.trim().toLocaleLowerCase() === attachment.series.name.trim().toLocaleLowerCase(),
      );
      return matchingSeries ? `/series/${matchingSeries.id}` : "/library/series";
    }

    if (attachment.note.source_type === "book") {
      const matchingBook = books.find((book) => book.id === attachment.note.source_id);
      return matchingBook ? `/books/${matchingBook.id}/journal` : "/library";
    }

    if (attachment.note.source_type === "series") {
      const matchingSeries = librarySeries.find((series) => series.id === attachment.note.source_id);
      return matchingSeries ? `/series/${matchingSeries.id}/journal` : "/library/series";
    }

    if (attachment.note.source_type === "author") {
      const matchingAuthor = authorRecords.find((author) => author.id === attachment.note.source_id);
      return matchingAuthor ? `/authors/${encodeURIComponent(matchingAuthor.id)}/journal` : "/authors";
    }

    return "/library";
  }

  async function importNoteAttachment() {
    if (!user || noteImportMessage?.attachment_payload?.type !== "note" || !noteImportTargetId) return;
    if (savedAttachmentMessageIds.has(noteImportMessage.id) || attachmentSaveInFlightRef.current.has(noteImportMessage.id)) return;

    const messageId = noteImportMessage.id;
    const libraryHref = noteImportTargetKind === "book"
      ? `/books/${noteImportTargetId}/journal`
      : noteImportTargetKind === "series"
        ? `/series/${noteImportTargetId}/journal`
        : `/authors/${encodeURIComponent(noteImportTargetId)}/journal`;
    setAttachmentImporting(messageId, true);

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const note = noteImportMessage.attachment_payload.note;
      if (noteImportTargetKind === "book") {
        const savedNote = await createBookJournalEntryRecord(noteSnapshotToCreateInput({
          note,
          bookId: noteImportTargetId,
          userId: user.id,
        }));
        setJournalEntries((current) => [savedNote, ...current]);
      } else if (noteImportTargetKind === "series") {
        const savedNote = await createSeriesJournalEntryRecord({
          seriesId: noteImportTargetId,
          userId: user.id,
          label: note.label,
          attribution: note.attribution ?? undefined,
          content: note.content,
          tags: note.tags ?? undefined,
          pageStart: note.page_start ?? undefined,
          noteDate: note.entry_date ?? undefined,
        });
        setSeriesJournalEntries((current) => [savedNote, ...current]);
      } else {
        const savedNote = await createAuthorJournalEntryRecord({
          authorId: noteImportTargetId,
          userId: user.id,
          label: note.label,
          attribution: note.attribution ?? undefined,
          content: note.content,
          tags: note.tags ?? undefined,
          pageStart: note.page_start ?? undefined,
          noteDate: note.entry_date ?? undefined,
        });
        setAuthorJournalEntries((current) => [savedNote, ...current]);
      }
      await markAttachmentSaved(messageId);
      setNoteImportMessage(null);
      setNoteImportTargetId("");
      showAttachmentSaveFeedback("Note saved to your library.", libraryHref);
    } catch (importError) {
      setError(toChatErrorMessage(importError, "Could not save note."));
    } finally {
      setSaving(false);
      setAttachmentImporting(messageId, false);
    }
  }

  async function saveEditedMessage(messageId: string) {
    if (!editingText.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const message = await editChatMessage(messageId, editingText);
      setMessages((current) => upsertMessage(current, message));
      setEditingMessageId(null);
      setEditingText("");
      await loadThreads(selectedGroupId);
    } catch (editError) {
      setError(toChatErrorMessage(editError, "Could not edit message."));
    } finally {
      setSaving(false);
    }
  }

  async function removeMessage(messageId: string) {
    setSaving(true);
    setError(null);

    try {
      const message = await deleteChatMessage(messageId);
      setMessages((current) => upsertMessage(current, message));
      await loadThreads(selectedGroupId);
    } catch (deleteError) {
      setError(toChatErrorMessage(deleteError, "Could not delete message."));
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(userId: string, role: GroupMembershipRole) {
    if (!selectedThread) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      await changeGroupMemberRole(selectedThread.group.id, userId, role);
      setMembers(await getChatMembers(selectedThread.group.id));
      setStatusMessage("Member role updated.");
    } catch (roleError) {
      setError(toChatErrorMessage(roleError, "Could not update member role."));
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId: string) {
    if (!selectedThread || !user) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      await removeChatMember(selectedThread.group.id, userId);
      setStatusMessage(userId === user.id ? "You left the group." : "Member removed.");
      await loadThreads(userId === user.id ? undefined : selectedThread.group.id);
    } catch (removeError) {
      setError(toChatErrorMessage(removeError, "Could not remove member."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const action = confirmAction;
    setConfirmAction(null);

    if (!action) return;

    if (action.type === "message") {
      await removeMessage(action.messageId);
      return;
    }

    await removeMember(action.userId);
  }

  const actionMenuMessage = messageActionMenu
    ? messages.find((message) => message.id === messageActionMenu.messageId) ?? null
    : null;
  const actionMenuSenderProfile = actionMenuMessage ? memberProfiles.get(actionMenuMessage.sender_id) : undefined;
  const actionMenuMine = actionMenuMessage?.sender_id === user?.id;
  const attachmentPreviewIsMine = attachmentPreview?.message.sender_id === user?.id;
  const attachmentPreviewSaveReceipt = attachmentPreviewIsMine
    ? formatAttachmentSaveReceipt(attachmentSaveReceipts)
    : null;
  const attachmentPreviewSaved = attachmentPreview ? savedAttachmentMessageIds.has(attachmentPreview.message.id) : false;
  const attachmentPreviewLibraryHref = attachmentPreview
    ? getAttachmentLibraryHref(attachmentPreview.attachment)
    : "/library";

  return (
    <div className="overflow-hidden bg-background">
      {(error || statusMessage) && (
        <div className="space-y-1 border-b px-4 py-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}
        </div>
      )}

      {messageActionMenu && actionMenuMessage && (
        <div
          className="fixed z-50 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]"
          style={{
            left: Math.min(messageActionMenu.x, window.innerWidth - 190),
            top: Math.min(messageActionMenu.y, window.innerHeight - 176),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-sm hover:bg-muted"
            aria-label="Reply"
            title="Reply"
            onClick={() => startReply(actionMenuMessage, actionMenuSenderProfile)}
          >
            <Reply className="h-4 w-4" />
          </button>
          {actionMenuMessage.content.trim() && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => copyMessageText(actionMenuMessage)}
            >
              <Copy className="h-4 w-4" />
              Copy Text
            </button>
          )}
          {actionMenuMine && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                setEditingMessageId(actionMenuMessage.id);
                setEditingText(actionMenuMessage.content);
                setMessageActionMenu(null);
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {actionMenuMine && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
              onClick={() => {
                setConfirmAction({ type: "message", messageId: actionMenuMessage.id });
                setMessageActionMenu(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      )}

      <div
        ref={messagesLayoutRef}
        className="grid h-[calc(100svh-8rem)] min-h-[38rem] lg:h-[calc(100svh-4rem)] lg:grid-cols-[var(--chat-list-width)_var(--panel-resize-handle-width)_minmax(0,1fr)]"
        style={{
          "--chat-list-width": `${panelWidths.chats}px`,
          "--chat-details-width": `${panelWidths.details}px`,
          "--panel-resize-handle-width": `${PANEL_RESIZE_HANDLE_WIDTH}px`,
        } as CSSProperties}
      >
        <aside className={cn("min-h-0 min-w-0 border-r-0 bg-muted/20 lg:border-r", mobileThreadOpen && "hidden lg:flex", "flex-col")}>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="flex items-center justify-between gap-3 px-2 py-3">
              <div>
                <AppHeading level={4} as="h2">Chats</AppHeading>
                <HeadingDescription className="text-xs">
                  {loading ? "Loading..." : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
                </HeadingDescription>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Add chat"
                onClick={() => setAddChatOpen(true)}
              >
                <MessageCirclePlus className="h-5 w-5" />
              </Button>
            </div>

            {threads.length === 0 && !loading ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                Add a chat to start a conversation.
              </p>
            ) : (
              <div className="space-y-1">
                {threads.map((thread) => (
                  <button
                    key={thread.group.id}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      thread.group.id === selectedGroupId && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                    onClick={() => {
                      setSelectedGroupId(thread.group.id);
                      setMobileThreadOpen(true);
                      setSettingsOpen(false);
                    }}
                  >
                    <MessageAvatar profile={thread.avatarProfile} fallback={thread.title} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{thread.title}</span>
                        {thread.group.kind === "group" && (
                          <Users
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              thread.group.id === selectedGroupId ? "text-primary-foreground/80" : "text-muted-foreground",
                            )}
                          />
                        )}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 line-clamp-1 text-xs",
                          thread.group.id === selectedGroupId ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {getMessagePreview(thread.latestMessage)}
                      </span>
                    </span>
                    {thread.unreadCount > 0 && (
                      <span
                        className={cn(
                          "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[0.68rem] font-semibold",
                          thread.group.id === selectedGroupId
                            ? "bg-primary-foreground text-primary"
                            : "bg-primary text-primary-foreground",
                        )}
                      >
                        {thread.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {renderPanelResizeHandle("chats")}

        <section className={cn("min-h-0 min-w-0", !mobileThreadOpen && "hidden lg:block")}>
          {selectedThread ? (
            <div className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
              <div className="relative flex min-h-16 items-center border-b bg-background px-3 sm:px-4">
                <div className="absolute inset-y-0 left-3 flex items-center lg:hidden">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setMobileThreadOpen(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1">
                  <button
                    type="button"
                    className="flex min-w-0 max-w-[min(18rem,calc(100vw-8rem))] items-center justify-center gap-3 rounded-md px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <MessageAvatar profile={selectedThread.avatarProfile} fallback={selectedThread.title} />
                    <span className="min-w-0">
                      <AppHeading level={4} as="h1" className="truncate">
                        {selectedThread.title}
                      </AppHeading>
                    </span>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Open chat details"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div
                className={cn(
                  "grid min-h-0",
                  settingsOpen && "lg:grid-cols-[minmax(22.5rem,1fr)_var(--panel-resize-handle-width)_var(--chat-details-width)]",
                )}
              >
                <div className={cn("min-h-0 min-w-0 flex-col", settingsOpen ? "hidden lg:flex" : "flex")}>
                  <div ref={messagesScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background p-4 sm:p-6">
                    {messagesLoading ? (
                      <p className="text-sm text-muted-foreground">Loading messages...</p>
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                    ) : (
                      messages.map((message, index) => {
                        const mine = message.sender_id === user?.id;
                        const senderProfile = memberProfiles.get(message.sender_id);
                        const editing = editingMessageId === message.id;
                        const canUseActions = !message.deleted_at && !editing;
                        const isGroupChat = selectedThread.group.kind === "group";
                        const showDate = index === 0 || messageDayKey(messages[index - 1].created_at) !== messageDayKey(message.created_at);

                        return (
                          <div key={message.id}>
                            {showDate && (
                              <div className="my-5 text-center text-xs text-muted-foreground" aria-label={formatMessageDate(message.created_at)}>
                                {formatMessageDate(message.created_at)}
                              </div>
                            )}
                            <div className={cn("relative flex gap-3", mine && "justify-end")}>
                            {isGroupChat && !mine && <MessageAvatar profile={senderProfile} fallback={message.sender_id} />}
                            {canUseActions && (
                              <div
                                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-primary lg:hidden"
                                aria-hidden="true"
                              >
                                <Reply className="h-5 w-5" />
                              </div>
                            )}
                            <div
                              className={cn("relative max-w-[min(34rem,80%)] touch-pan-y", mine && "items-end")}
                              onContextMenu={(event) => {
                                if (!canUseActions) return;
                                event.preventDefault();
                                openMessageActionMenu(message, event.clientX, event.clientY);
                              }}
                              onTouchStart={(event) => {
                                if (canUseActions) startMessageTouch(message, event);
                              }}
                              onTouchMove={moveMessageTouch}
                              onTouchEnd={(event) => endMessageTouch(message, event)}
                              onTouchCancel={() => {
                                clearLongPressTimer();
                                resetSwipeReplyGesture();
                              }}
                            >
                              <div
                                className={cn(
                                  "relative space-y-1",
                                  swipeReplyMessageId === message.id ? "transition-none" : "transition-transform duration-200 ease-out",
                                )}
                                style={swipeReplyMessageId === message.id ? { transform: `translateX(${swipeReplyOffset}px)` } : undefined}
                              >
                              {editing ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editingText}
                                    onChange={(event) => setEditingText(event.target.value)}
                                    rows={3}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingMessageId(null);
                                        setEditingText("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={saving || !editingText.trim()}
                                      onClick={() => saveEditedMessage(message.id)}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : message.content.trim() || message.deleted_at || message.reply_snapshot ? (
                                <div className={cn("relative", mine && "self-end")}>
                                  <div
                                    className={cn(
                                      "space-y-2 rounded-2xl px-3 py-2 text-sm leading-relaxed",
                                      mine
                                        ? "rounded-br-sm bg-primary text-primary-foreground"
                                        : "rounded-bl-sm bg-muted text-foreground",
                                      message.deleted_at && "italic text-muted-foreground",
                                    )}
                                  >
                                    {isGroupChat && (
                                      <p className={cn("text-xs font-medium", mine ? "text-primary-foreground/85" : "text-muted-foreground")}>
                                        {mine ? "You" : profileLabel(senderProfile)}
                                      </p>
                                    )}
                                    {message.reply_snapshot && <ReplyPreview reply={message.reply_snapshot} compact />}
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                                      <p className="min-w-0">
                                        {message.deleted_at ? "Message deleted" : message.content}
                                      </p>
                                      <span className={cn("shrink-0 whitespace-nowrap text-[0.68rem]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                                        {formatMessageTime(message.created_at)}
                                        {message.edited_at && !message.deleted_at ? " · edited" : ""}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : null}

                              {!message.deleted_at && (
                                <div>
                                  <AttachmentCard
                                    message={message}
                                    mine={mine}
                                    saved={savedAttachmentMessageIds.has(message.id)}
                                    savingToLibrary={saving || savingAttachmentMessageIds.has(message.id)}
                                    onOpenDetails={openAttachmentPreview}
                                    onAddToLibrary={() => startAttachmentImport(message)}
                                  />
                                </div>
                              )}
                              </div>
                            </div>
                          </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {settingsOpen && (
                  <>
                    {renderPanelResizeHandle("details")}
                    {renderChatDetails()}
                  </>
                )}
              </div>

              <div className={cn("border-t bg-background", settingsOpen && "hidden lg:block")}>
                {renderChatComposer()}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[38rem] items-center justify-center">
              <div className="p-6 text-center">
                <MessageCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No chat selected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a chat or choose a conversation from the list.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={saving}>
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attachmentPreview !== null} onOpenChange={(open) => !open && setAttachmentPreview(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Shared content</DialogTitle>
          </DialogHeader>
          {attachmentPreview && (
            <>
              <AttachmentPreviewContent
                attachment={attachmentPreview.attachment}
                onAddAuthorBookToLibrary={
                  attachmentPreview.attachment.type === "author"
                    ? (book) => void importBookSnapshot(attachmentPreview.message.id, book, book.id)
                    : undefined
                }
                isBookSaved={isBookSnapshotSaved}
              />
              {(attachmentPreviewIsMine || attachmentPreviewSaved || attachmentPreview.message.sender_id !== user?.id) && (
                <DialogFooter>
                  {attachmentPreviewIsMine && (attachmentPreviewSaveReceipt || attachmentSaveReceiptsLoading) && (
                    <p className="mr-auto max-w-sm text-left text-xs leading-relaxed text-muted-foreground">
                      {attachmentPreviewSaveReceipt ?? "Loading save receipts..."}
                    </p>
                  )}
                  {(attachmentPreviewIsMine || attachmentPreviewSaved) && (
                    <Button asChild type="button" variant="outline">
                      <Link to={attachmentPreviewLibraryHref} onClick={() => setAttachmentPreview(null)}>
                        <LibraryBig className="h-4 w-4" />
                        See in Library
                      </Link>
                    </Button>
                  )}
                  {attachmentPreview.message.sender_id !== user?.id && !attachmentPreviewSaved && (
                    <Button
                      type="button"
                      disabled={saving || savingAttachmentMessageIds.has(attachmentPreview.message.id)}
                      onClick={() => startAttachmentImport(attachmentPreview.message)}
                    >
                      Add to Library
                    </Button>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={attachmentSaveFeedback !== null} onOpenChange={(open) => !open && setAttachmentSaveFeedback(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saved to Library</DialogTitle>
            <DialogDescription>{attachmentSaveFeedback?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAttachmentSaveFeedback(null)}>
              Close
            </Button>
            {attachmentSaveFeedback && (
              <Button asChild>
                <Link to={attachmentSaveFeedback.libraryHref} onClick={() => setAttachmentSaveFeedback(null)}>
                  <LibraryBig className="h-4 w-4" />
                  See in Library
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteImportMessage !== null} onOpenChange={(open) => !open && setNoteImportMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add journal entry to library</DialogTitle>
            <DialogDescription>Choose where this shared entry should be saved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(["book", "series", "author"] as const).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant={noteImportTargetKind === kind ? "secondary" : "outline"}
                  className="capitalize"
                  onClick={() => {
                    setNoteImportTargetKind(kind);
                    setNoteImportTargetId("");
                  }}
                >
                  {kind}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat-note-import-target">Choose a {noteImportTargetKind}</Label>
              <Select value={noteImportTargetId} onValueChange={setNoteImportTargetId}>
                <SelectTrigger id="chat-note-import-target">
                  <SelectValue placeholder={`Select a ${noteImportTargetKind}`} />
                </SelectTrigger>
                <SelectContent>
                  {noteImportTargets.map((target) => (
                    <SelectItem key={target.id} value={target.id}>{target.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNoteImportMessage(null)}>Cancel</Button>
            <Button type="button" disabled={!noteImportTargetId || saving} onClick={() => void importNoteAttachment()}>
              Add to library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddChatDialog
        open={addChatOpen}
        onOpenChange={setAddChatOpen}
        onCreated={(groupId) => {
          void loadThreads(groupId);
          setMobileThreadOpen(true);
        }}
      />
    </div>
  );
}
