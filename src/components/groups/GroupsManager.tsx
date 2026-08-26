import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CircleCheck,
  CirclePlus,
  ChevronRight,
  Copy,
  FileSearchCorner,
  Heart,
  LibraryBig,
  MessageCircle,
  MessageCirclePlus,
  Pencil,
  Plus,
  Reply,
  Send,
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
  getChatMembers,
  getChatMessages,
  getSavedChatAttachmentMessageIds,
  getChatThreads,
  getMessagePreview,
  markChatRead,
  removeChatMember,
  sendChatMessage,
  saveChatAttachment,
  toggleHeartReaction,
  toChatErrorMessage,
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
    reactions: row.reactions ?? [],
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
        <p className="truncate text-xs font-medium text-primary">Note to {reply.sender_name}</p>
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

function reactionNames(reaction: NonNullable<GroupMessage["reactions"]>[number]): string {
  return reaction.participants.map((participant) => participant.display_name).join(", ");
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

  return image ? (
    <img src={image} alt="" className="h-16 w-11 shrink-0 rounded-md object-cover" />
  ) : (
    <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-muted">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function AttachmentPreviewContent({ attachment }: { attachment: ChatAttachmentPayload }) {
  const title = attachmentTitle(attachment);
  const secondaryInfo = attachmentSecondaryInfo(attachment);

  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <AttachmentThumbnail attachment={attachment} />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">{attachmentTypeLabel(attachment)}</p>
          <h3 className="mt-1 text-lg font-semibold leading-snug">{title}</h3>
          {secondaryInfo && <p className="mt-1 text-sm text-muted-foreground">{secondaryInfo}</p>}
        </div>
      </div>

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
          {attachment.author.books.map((book, index) => (
            <div key={`${book.id ?? book.title}-${index}`} className="flex items-center gap-3 rounded-md border p-2">
              {book.cover_url ? <img src={book.cover_url} alt="" className="h-12 w-8 rounded object-cover" /> : <BookOpen className="h-5 w-5 text-muted-foreground" />}
              <div className="min-w-0"><p className="truncate font-medium">{book.title}</p><p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p></div>
            </div>
          ))}
        </div>
      )}

      {attachment.type === "series" && (
        <div className="space-y-3 text-sm">
          {attachment.series.description && <p className="whitespace-pre-wrap text-muted-foreground">{attachment.series.description}</p>}
          {attachment.series.books.map((book, index) => (
            <div key={`${book.id ?? book.title}-${index}`} className="flex items-center gap-3 rounded-md border p-2">
              {book.cover_url ? <img src={book.cover_url} alt="" className="h-12 w-8 rounded object-cover" /> : <BookOpen className="h-5 w-5 text-muted-foreground" />}
              <div className="min-w-0"><p className="truncate font-medium">{book.title}</p><p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentCard({
  message,
  mine,
  saved,
  onOpenDetails,
  onAddToLibrary,
}: {
  message: GroupMessage;
  mine: boolean;
  saved: boolean;
  onOpenDetails: (attachment: ChatAttachmentPayload) => void;
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
        onClick={() => onOpenDetails(attachment)}
      >
        <FileSearchCorner className="h-3.5 w-3.5" />
        See details
      </Button>
      {!mine && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={saved}
          className="h-8 gap-1.5 px-2 text-xs disabled:opacity-100"
          onClick={onAddToLibrary}
        >
          {saved ? <CircleCheck className="h-3.5 w-3.5 text-emerald-700" /> : <CirclePlus className="h-3.5 w-3.5" />}
          {saved ? "Saved to library" : "Save to library"}
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
        onClick={() => onOpenDetails(attachment)}
        aria-label={`View ${attachmentTitle(attachment)} details`}
      >
        {attachment.type === "note" ? (
          <div className="min-w-0 py-1 text-sm">
            <p className="text-xs font-medium text-muted-foreground">{noteLabel(attachment.note.label)}</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{attachment.note.content}</p>
          </div>
        ) : (
          <>
            <AttachmentThumbnail attachment={attachment} />
            {secondaryInfo && <p className="min-w-0 truncate text-xs text-muted-foreground">{secondaryInfo}</p>}
          </>
        )}
      </button>
      {!mine && actions}
    </div>
  );
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
  const [addChatOpen, setAddChatOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [attachmentPicker, setAttachmentPicker] = useState<AttachmentPickerMode | null>(null);
  const [attachmentSearch, setAttachmentSearch] = useState("");
  const [attachmentPickerHeight, setAttachmentPickerHeight] = useState(360);
  const [selectedAttachment, setSelectedAttachment] = useState<ChatAttachmentPayload | null>(null);
  const [selectedReply, setSelectedReply] = useState<ChatReplySnapshot | null>(null);
  const [messageActionMenu, setMessageActionMenu] = useState<MessageActionMenu | null>(null);
  const [reactionDetailsMessageId, setReactionDetailsMessageId] = useState<string | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<ChatAttachmentPayload | null>(null);
  const [noteImportMessage, setNoteImportMessage] = useState<GroupMessage | null>(null);
  const [noteImportTargetKind, setNoteImportTargetKind] = useState<JournalTargetKind>("book");
  const [noteImportTargetId, setNoteImportTargetId] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const attachmentPickerRef = useRef<HTMLDivElement>(null);
  const attachmentAddButtonRef = useRef<HTMLButtonElement>(null);

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

    Promise.all([getChatMessages(selectedGroupId, user.id), getChatMembers(selectedGroupId)])
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
    const currentUserId = user.id;

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
          void getChatMessages(selectedGroupId, currentUserId)
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_message_reactions",
        },
        () => {
          void getChatMessages(selectedGroupId, currentUserId)
            .then(setMessages)
            .catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedGroupId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, selectedGroupId]);

  useEffect(() => {
    setSelectedReply(null);
    setMessageActionMenu(null);
    setReactionDetailsMessageId(null);
    setSettingsOpen(false);
  }, [selectedGroupId]);

  useEffect(() => {
    function closeFloatingMenus() {
      setMessageActionMenu(null);
      setReactionDetailsMessageId(null);
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

  function openMessageActionMenu(message: GroupMessage, x: number, y: number) {
    if (message.deleted_at) return;
    setMessageActionMenu({ messageId: message.id, x, y });
    setReactionDetailsMessageId(null);
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

  async function toggleMessageHeart(message: GroupMessage) {
    if (!user || message.deleted_at) return;
    setError(null);
    try {
      await toggleHeartReaction(message, user.id);
      setMessages(await getChatMessages(selectedGroupId, user.id));
    } catch (reactionError) {
      setError(toChatErrorMessage(reactionError, "Could not update reaction."));
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
      <aside className="min-h-0 overflow-y-auto border-t bg-background p-4 lg:border-t-0 lg:border-l">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <AppHeading level={4} as="h2">Chat Details</AppHeading>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="lg:hidden"
              aria-label="Back to messages"
              onClick={() => setSettingsOpen(false)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
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

              {attachmentPicker === "note" && filteredJournalEntries.map((item) => {
                const note = item.entry;
                return (
                  <div key={`${item.sourceType}-${note.id}`} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted">
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
              })}
            </div>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
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
            className="min-h-12 flex-1 resize-none rounded-full px-4 py-3"
          />
          <Button
            ref={attachmentAddButtonRef}
            type="button"
            size="icon"
            variant="outline"
            aria-label="Add shared content"
            onClick={() => {
              setAttachmentPicker((current) => current ? null : "book");
              setAttachmentSearch("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" aria-label="Stickers">
            <Sticker className="h-4 w-4" />
          </Button>
          <Button type="submit" size="icon" disabled={saving || (!messageText.trim() && !selectedAttachment)}>
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

  async function importBookSnapshot(messageId: string, book: ChatSharedBookSnapshot) {
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      let imageCopyError: string | null = null;
      const result = await addBook(importPayloadForBookSnapshot(book));
      if (book.cover_url) {
        try {
          const coverUrl = await copyChatAttachmentImage(messageId, "book", result.book.id);
          await updateBook(result.book.id, { cover_url: coverUrl });
        } catch (copyError) {
          imageCopyError = imageCopyErrorMessage(copyError);
        }
      }
      imageCopyError ??= await importAuthorPhotosForBookSnapshot({
        messageId,
        attachmentType: "book",
        book,
        addAuthor,
        editAuthor,
      });
      await markAttachmentSaved(messageId);
      setStatusMessage(
        imageCopyError
          ? `Book saved, but one or more images could not be copied: ${imageCopyError}`
          : "Book, cover, and author profile pictures saved to your library.",
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
      setStatusMessage(
        imageCopyError
          ? `Series saved, but one or more images could not be copied: ${imageCopyError}`
          : "Series, books, covers, and author profile pictures saved to your library.",
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
      setStatusMessage(
        imageCopyError
          ? `Author saved, but their profile picture could not be copied: ${imageCopyError}`
          : "Author and profile picture saved to your library.",
      );
    } catch (importError) {
      setError(toChatErrorMessage(importError, "Could not save author."));
    } finally {
      setSaving(false);
    }
  }

  function startAttachmentImport(message: GroupMessage) {
    if (!message.attachment_payload) return;
    if (savedAttachmentMessageIds.has(message.id)) return;
    if (message.attachment_payload.type === "book") {
      void importBookSnapshot(message.id, message.attachment_payload.book);
      return;
    }
    if (message.attachment_payload.type === "author") {
      void importAuthorAttachment(message.id, message.attachment_payload.author);
      return;
    }
    if (message.attachment_payload.type === "series") {
      void importSeriesAttachment(message.id, message.attachment_payload.series);
      return;
    }
    setNoteImportMessage(message);
    setNoteImportTargetKind("book");
    setNoteImportTargetId("");
  }

  async function importNoteAttachment() {
    if (!user || noteImportMessage?.attachment_payload?.type !== "note" || !noteImportTargetId) return;

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
      await markAttachmentSaved(noteImportMessage.id);
      setNoteImportMessage(null);
      setNoteImportTargetId("");
      setStatusMessage("Note saved.");
    } catch (importError) {
      setError(toChatErrorMessage(importError, "Could not save note."));
    } finally {
      setSaving(false);
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
            top: Math.min(messageActionMenu.y, window.innerHeight - 224),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => startReply(actionMenuMessage, actionMenuSenderProfile)}
          >
            <Reply className="h-4 w-4" />
            Note
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              setMessageActionMenu(null);
              void toggleMessageHeart(actionMenuMessage);
            }}
          >
            <Heart className="h-4 w-4 fill-current" />
            React
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

      <div className="grid h-[calc(100svh-8rem)] min-h-[38rem] lg:h-[calc(100svh-4rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className={cn("min-h-0 border-r-0 bg-muted/20 lg:border-r", mobileThreadOpen && "hidden lg:flex", "flex-col")}>
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

        <section className={cn("min-h-0 min-w-0", !mobileThreadOpen && "hidden lg:block")}>
          {selectedThread ? (
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
              <div className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b bg-background px-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="lg:hidden"
                    onClick={() => setMobileThreadOpen(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <MessageAvatar profile={selectedThread.avatarProfile} fallback={selectedThread.title} />
                </div>
                <button
                  type="button"
                  className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSettingsOpen(true)}
                >
                  <AppHeading level={4} as="h1" className="truncate">
                    {selectedThread.title}
                  </AppHeading>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedThread.group.kind === "direct"
                      ? "Direct chat"
                      : selectedThread.description || `${members.length} members`}
                  </p>
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant={settingsOpen ? "secondary" : "ghost"}
                  aria-label="Open chat details"
                  onClick={() => setSettingsOpen(true)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className={cn("min-h-0", settingsOpen ? "grid lg:grid-cols-[minmax(0,1fr)_19rem]" : "grid")}>
                <div className={cn("min-h-0 min-w-0 flex-col", settingsOpen ? "hidden lg:flex" : "flex")}>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background p-4 sm:p-6">
                    {messagesLoading ? (
                      <p className="text-sm text-muted-foreground">Loading messages...</p>
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                    ) : (
                      messages.map((message, index) => {
                        const mine = message.sender_id === user?.id;
                        const senderProfile = memberProfiles.get(message.sender_id);
                        const editing = editingMessageId === message.id;
                        const heartReaction = message.reactions?.find((reaction) => reaction.reaction === "heart");
                        const canUseActions = !message.deleted_at;
                        const isGroupChat = selectedThread.group.kind === "group";
                        const showDate = index === 0 || messageDayKey(messages[index - 1].created_at) !== messageDayKey(message.created_at);

                        return (
                          <div key={message.id}>
                            {showDate && (
                              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground" aria-label={formatMessageDate(message.created_at)}>
                                <span className="h-px flex-1 bg-border" />
                                <span>{formatMessageDate(message.created_at)}</span>
                                <span className="h-px flex-1 bg-border" />
                              </div>
                            )}
                            <div className={cn("flex gap-3", mine && "justify-end")}>
                            {isGroupChat && !mine && <MessageAvatar profile={senderProfile} fallback={message.sender_id} />}
                            <div className={cn("max-w-[min(34rem,80%)] space-y-1", mine && "items-end")}>
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
                                    onContextMenu={(event) => {
                                      if (!canUseActions) return;
                                      event.preventDefault();
                                      openMessageActionMenu(message, event.clientX, event.clientY);
                                    }}
                                    onDoubleClick={() => toggleMessageHeart(message)}
                                    onTouchStart={(event) => {
                                      if (!canUseActions) return;
                                      const touch = event.touches[0];
                                      clearLongPressTimer();
                                      longPressTimerRef.current = window.setTimeout(() => {
                                        openMessageActionMenu(message, touch.clientX, touch.clientY);
                                      }, 550);
                                    }}
                                    onTouchMove={clearLongPressTimer}
                                    onTouchEnd={clearLongPressTimer}
                                    onTouchCancel={clearLongPressTimer}
                                  >
                                    {isGroupChat && (
                                      <p className={cn("text-xs font-medium", mine ? "text-primary-foreground/85" : "text-muted-foreground")}>
                                        {mine ? "You" : profileLabel(senderProfile)}
                                      </p>
                                    )}
                                    {message.reply_snapshot && <ReplyPreview reply={message.reply_snapshot} compact />}
                                    {message.deleted_at ? "Message deleted" : message.content}
                                    <p className={cn("text-left text-[0.68rem]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                                      {formatMessageTime(message.created_at)}
                                      {message.edited_at && !message.deleted_at ? " · edited" : ""}
                                    </p>
                                  </div>
                                  {heartReaction && heartReaction.count > 0 && (
                                    <div
                                      className={cn(
                                        "relative mt-1 flex",
                                        mine ? "justify-end pr-2" : "justify-start pl-2",
                                      )}
                                    >
                                      <button
                                        type="button"
                                        className={cn(
                                          "flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs shadow-sm",
                                          heartReaction.reacted_by_current_user && "border-primary text-primary",
                                        )}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setReactionDetailsMessageId((current) =>
                                            current === message.id ? null : message.id,
                                          );
                                        }}
                                        onMouseEnter={() => setReactionDetailsMessageId(message.id)}
                                      >
                                        <Heart className="h-3 w-3 fill-current" />
                                        {heartReaction.count}
                                      </button>
                                      {reactionDetailsMessageId === message.id && (
                                        <div className="absolute bottom-7 z-30 max-w-56 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[var(--shadow-popover)]">
                                          {reactionNames(heartReaction)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : null}

                              {!message.deleted_at && (
                                <div
                                  onContextMenu={(event) => {
                                    if (!canUseActions) return;
                                    event.preventDefault();
                                    openMessageActionMenu(message, event.clientX, event.clientY);
                                  }}
                                  onDoubleClick={() => toggleMessageHeart(message)}
                                  onTouchStart={(event) => {
                                    if (!canUseActions) return;
                                    const touch = event.touches[0];
                                    clearLongPressTimer();
                                    longPressTimerRef.current = window.setTimeout(() => {
                                      openMessageActionMenu(message, touch.clientX, touch.clientY);
                                    }, 550);
                                  }}
                                  onTouchMove={clearLongPressTimer}
                                  onTouchEnd={clearLongPressTimer}
                                  onTouchCancel={clearLongPressTimer}
                                >
                                  <AttachmentCard
                                    message={message}
                                    mine={mine}
                                    saved={savedAttachmentMessageIds.has(message.id)}
                                    onOpenDetails={setAttachmentPreview}
                                    onAddToLibrary={() => startAttachmentImport(message)}
                                  />
                                </div>
                              )}

                              {heartReaction &&
                                heartReaction.count > 0 &&
                                !message.content.trim() &&
                                !message.reply_snapshot && (
                                  <div
                                    className={cn(
                                      "relative flex",
                                      mine ? "justify-end pr-2" : "justify-start pl-2",
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className={cn(
                                        "flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs shadow-sm",
                                        heartReaction.reacted_by_current_user && "border-primary text-primary",
                                      )}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setReactionDetailsMessageId((current) =>
                                          current === message.id ? null : message.id,
                                        );
                                      }}
                                      onMouseEnter={() => setReactionDetailsMessageId(message.id)}
                                    >
                                      <Heart className="h-3 w-3 fill-current" />
                                      {heartReaction.count}
                                    </button>
                                    {reactionDetailsMessageId === message.id && (
                                      <div className="absolute bottom-7 z-30 max-w-56 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[var(--shadow-popover)]">
                                        {reactionNames(heartReaction)}
                                      </div>
                                    )}
                                  </div>
                                )}

                            </div>
                          </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {settingsOpen && renderChatDetails()}
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
          {attachmentPreview && <AttachmentPreviewContent attachment={attachmentPreview} />}
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
