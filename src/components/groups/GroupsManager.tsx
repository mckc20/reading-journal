import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BookOpen,
  Copy,
  Heart,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  StickyNote,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
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
import { useBooksContext } from "@/context/BooksContext";
import {
  attachmentTitle,
  bookSnapshotToAddBookPayload,
  buildAuthorAttachment,
  buildBookAttachment,
  buildNoteAttachment,
  noteSnapshotToCreateInput,
  MAX_INCLUDED_ATTACHMENT_NOTES,
} from "@/lib/chatAttachments";
import {
  addGroupMemberByUsername,
  changeGroupMemberRole,
  createGroupChat,
  createOrGetDirectChat,
  deleteChatMessage,
  editChatMessage,
  buildReplySnapshot,
  getChatMembers,
  getChatMessages,
  getChatThreads,
  getMessagePreview,
  markChatRead,
  removeChatMember,
  searchPublicProfiles,
  sendChatMessage,
  toggleHeartReaction,
  toChatErrorMessage,
  type ChatMember,
  type ChatThread,
} from "@/lib/chat";
import { supabase } from "@/lib/supabase";
import { buildAuthorSummaries } from "@/lib/authorShelf";
import { createBookNote, fetchAllBookNotes } from "@/lib/bookNotes";
import { cn } from "@/lib/utils";
import type {
  Book,
  BookNote,
  ChatAttachmentPayload,
  ChatReplySnapshot,
  ChatSharedBookSnapshot,
  ChatSharedNoteSnapshot,
  GroupMessage,
  PublicProfile,
  GroupMembershipRole,
} from "@/types";

type ComposeMode = "direct" | "group";
type AttachmentPickerMode = "book" | "note" | "author";

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
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
  return "Author";
}

function sortBooksByTitle(books: Book[]): Book[] {
  return [...books].sort((first, second) =>
    first.title.localeCompare(second.title, undefined, { sensitivity: "base", numeric: true }),
  );
}

function sortNotesForPicker(notes: BookNote[]): BookNote[] {
  return [...notes].sort((first, second) => {
    const dateCompare = (second.note_date ?? second.created_at).localeCompare(first.note_date ?? first.created_at);
    if (dateCompare !== 0) return dateCompare;
    return second.created_at.localeCompare(first.created_at);
  });
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

function reactionNames(reaction: NonNullable<GroupMessage["reactions"]>[number]): string {
  return reaction.participants.map((participant) => participant.display_name).join(", ");
}

function AttachmentCard({
  message,
  mine,
  books,
  noteImportOpen,
  noteImportTargetBookId,
  onImportBook,
  onOpenNoteImport,
  onCancelNoteImport,
  onNoteTargetChange,
  onImportNote,
}: {
  message: GroupMessage;
  mine: boolean;
  books: Book[];
  noteImportOpen: boolean;
  noteImportTargetBookId: string;
  onImportBook: (book: ChatSharedBookSnapshot) => void;
  onOpenNoteImport: () => void;
  onCancelNoteImport: () => void;
  onNoteTargetChange: (bookId: string) => void;
  onImportNote: () => void;
}) {
  const attachment = message.attachment_payload;
  if (!attachment) return null;

  return (
    <div className="mt-2 space-y-3 rounded-lg border bg-background p-3 text-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{attachmentTypeLabel(attachment)}</Badge>
        <span className="min-w-0 truncate text-sm font-medium">{attachmentTitle(attachment)}</span>
      </div>

      {attachment.type === "book" && (
        <div className="flex gap-3">
          {attachment.book.cover_url ? (
            <img
              src={attachment.book.cover_url}
              alt=""
              className="h-24 w-16 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="font-medium leading-snug">{attachment.book.title}</p>
              <p className="text-xs text-muted-foreground">{attachment.book.authors.join(", ")}</p>
            </div>
            {attachment.book.description && (
              <p className="line-clamp-3 text-xs text-muted-foreground">{attachment.book.description}</p>
            )}
            {attachment.book.included_notes && attachment.book.included_notes.length > 0 && (
              <div className="space-y-1">
                {attachment.book.included_notes.map((note, index) => (
                  <p key={`${note.id ?? index}-${note.label}`} className="rounded-md bg-muted/50 px-2 py-1 text-xs">
                    <span className="font-medium">{noteLabel(note.label)}:</span> {note.content}
                  </p>
                ))}
              </div>
            )}
            {!mine && (
              <Button type="button" size="sm" variant="outline" onClick={() => onImportBook(attachment.book)}>
                Save to own library
              </Button>
            )}
          </div>
        </div>
      )}

      {attachment.type === "note" && (
        <div className="space-y-3">
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">{noteLabel(attachment.note.label)}</p>
            {attachment.note.title && <p className="mt-1 text-sm font-medium">{attachment.note.title}</p>}
            <p className="mt-1 text-sm">{attachment.note.content}</p>
            {attachment.note.quote_speaker && (
              <p className="mt-1 text-xs text-muted-foreground">- {attachment.note.quote_speaker}</p>
            )}
            {attachment.note.book_title && (
              <p className="mt-2 text-xs text-muted-foreground">
                From {attachment.note.book_title}
              </p>
            )}
          </div>

          {!mine && !noteImportOpen && (
            <Button type="button" size="sm" variant="outline" onClick={onOpenNoteImport}>
              Save to own library
            </Button>
          )}

          {!mine && noteImportOpen && (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Choose a book</Label>
              <Select value={noteImportTargetBookId} onValueChange={onNoteTargetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a book" />
                </SelectTrigger>
                <SelectContent>
                  {sortBooksByTitle(books).map((book) => (
                    <SelectItem key={book.id} value={book.id}>
                      {book.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={onCancelNoteImport}>
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={!noteImportTargetBookId} onClick={onImportNote}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {attachment.type === "author" && (
        <div className="space-y-3">
          <div>
            <p className="font-medium">{attachment.author.name}</p>
            <p className="text-xs text-muted-foreground">
              {attachment.author.books.length} book{attachment.author.books.length === 1 ? "" : "s"} shared
            </p>
          </div>
          {attachment.author.books.length > 0 && (
            <div className="space-y-2">
              {attachment.author.books.map((book, index) => (
                <div
                  key={`${book.id ?? book.title}-${index}`}
                  className="flex items-center gap-3 rounded-md border bg-muted/20 p-2"
                >
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-muted">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{book.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{book.authors.join(", ")}</p>
                  </div>
                  {!mine && (
                    <Button type="button" size="sm" variant="outline" onClick={() => onImportBook(book)}>
                      Save
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {attachment.author.included_quotes && attachment.author.included_quotes.length > 0 && (
            <div className="space-y-1">
              {attachment.author.included_quotes.map((quote, index) => (
                <p key={`${quote.id ?? index}-${quote.content}`} className="rounded-md bg-muted/50 px-2 py-1 text-xs">
                  {quote.content}
                  {quote.book_title && <span className="text-muted-foreground"> - {quote.book_title}</span>}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GroupsManager() {
  const { user } = useAuth();
  const { books, addBook } = useBooksContext();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [composeMode, setComposeMode] = useState<ComposeMode>("direct");
  const [directSearch, setDirectSearch] = useState("");
  const [profileResults, setProfileResults] = useState<PublicProfile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [memberUsername, setMemberUsername] = useState("");
  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachmentPicker, setAttachmentPicker] = useState<AttachmentPickerMode | null>(null);
  const [attachmentSearch, setAttachmentSearch] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [selectedAuthorName, setSelectedAuthorName] = useState("");
  const [selectedIncludedNoteIds, setSelectedIncludedNoteIds] = useState<string[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<ChatAttachmentPayload | null>(null);
  const [selectedReply, setSelectedReply] = useState<ChatReplySnapshot | null>(null);
  const [messageActionMenu, setMessageActionMenu] = useState<MessageActionMenu | null>(null);
  const [reactionDetailsMessageId, setReactionDetailsMessageId] = useState<string | null>(null);
  const [noteImportMessageId, setNoteImportMessageId] = useState<string | null>(null);
  const [noteImportTargetBookId, setNoteImportTargetBookId] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.group.id === selectedGroupId) ?? null,
    [threads, selectedGroupId],
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

  const notesByBookId = useMemo(() => {
    const map = new Map<string, BookNote[]>();
    notes.forEach((note) => {
      map.set(note.book_id, [...(map.get(note.book_id) ?? []), note]);
    });
    return map;
  }, [notes]);

  const authorSummaries = useMemo(() => buildAuthorSummaries(books, notes), [books, notes]);

  const filteredBooks = useMemo(() => {
    const query = attachmentSearch.trim().toLowerCase();
    const sorted = sortBooksByTitle(books);
    if (!query) return sorted;
    return sorted.filter((book) =>
      [book.title, ...book.authors].some((value) => value.toLowerCase().includes(query)),
    );
  }, [attachmentSearch, books]);

  const filteredNotes = useMemo(() => {
    const query = attachmentSearch.trim().toLowerCase();
    const sorted = sortNotesForPicker(notes);
    if (!query) return sorted;
    return sorted.filter((note) => {
      const book = booksById.get(note.book_id);
      return [note.title, note.content, note.quote_speaker, book?.title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [attachmentSearch, booksById, notes]);

  const filteredAuthors = useMemo(() => {
    const query = attachmentSearch.trim().toLowerCase();
    if (!query) return authorSummaries;
    return authorSummaries.filter((author) => author.name.toLowerCase().includes(query));
  }, [attachmentSearch, authorSummaries]);

  const selectedBook = selectedBookId ? booksById.get(selectedBookId) ?? null : null;
  const selectedNote = selectedNoteId ? notes.find((note) => note.id === selectedNoteId) ?? null : null;
  const selectedAuthor = selectedAuthorName
    ? authorSummaries.find((author) => author.name === selectedAuthorName) ?? null
    : null;

  const selectedBookNotes = selectedBook ? sortNotesForPicker(notesByBookId.get(selectedBook.id) ?? []) : [];
  const selectedAuthorQuotes = selectedAuthor ? sortNotesForPicker(selectedAuthor.quotes) : [];

  useEffect(() => {
    let cancelled = false;

    fetchAllBookNotes()
      .then((nextNotes) => {
        if (!cancelled) setNotes(nextNotes);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      return;
    }

    let cancelled = false;
    setMessagesLoading(true);
    setError(null);

    Promise.all([getChatMessages(selectedGroupId, user.id), getChatMembers(selectedGroupId)])
      .then(async ([nextMessages, nextMembers]) => {
        if (cancelled) return;
        setMessages(nextMessages);
        setMembers(nextMembers);
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
            .then(setMessages)
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

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupName.trim()) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const group = await createGroupChat({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
      });
      setGroupName("");
      setGroupDescription("");
      setStatusMessage("Group chat created.");
      await loadThreads(group.id);
      setMobileThreadOpen(true);
    } catch (createError) {
      setError(toChatErrorMessage(createError, "Could not create group chat."));
    } finally {
      setSaving(false);
    }
  }

  async function searchProfiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setError(null);
    setStatusMessage(null);

    try {
      const results = await searchPublicProfiles(directSearch);
      setProfileResults(results);
      if (results.length === 0) setStatusMessage("No matching users found.");
    } catch (searchError) {
      setError(toChatErrorMessage(searchError, "Could not search users."));
    }
  }

  async function startDirectChat(profileId: string) {
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const group = await createOrGetDirectChat(profileId);
      setDirectSearch("");
      setProfileResults([]);
      setStatusMessage("Direct chat ready.");
      await loadThreads(group.id);
      setMobileThreadOpen(true);
    } catch (directError) {
      setError(toChatErrorMessage(directError, "Could not start direct chat."));
    } finally {
      setSaving(false);
    }
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

  function openAttachmentPicker(mode: AttachmentPickerMode) {
    setAttachmentPicker(mode);
    setAttachMenuOpen(false);
    setAttachmentSearch("");
    setSelectedBookId("");
    setSelectedNoteId("");
    setSelectedAuthorName("");
    setSelectedIncludedNoteIds([]);
  }

  function toggleIncludedNote(noteId: string) {
    setSelectedIncludedNoteIds((current) => {
      if (current.includes(noteId)) return current.filter((id) => id !== noteId);
      if (current.length >= MAX_INCLUDED_ATTACHMENT_NOTES) return current;
      return [...current, noteId];
    });
  }

  function attachSelectedItem() {
    if (attachmentPicker === "book" && selectedBook) {
      const includedNotes = selectedIncludedNoteIds
        .map((noteId) => notes.find((note) => note.id === noteId))
        .filter((note): note is BookNote => Boolean(note));
      setSelectedAttachment(buildBookAttachment(selectedBook, includedNotes));
    }

    if (attachmentPicker === "note" && selectedNote) {
      setSelectedAttachment(buildNoteAttachment(selectedNote, booksById.get(selectedNote.book_id)));
    }

    if (attachmentPicker === "author" && selectedAuthor) {
      const includedQuotes = selectedIncludedNoteIds
        .map((noteId) => notes.find((note) => note.id === noteId))
        .filter((note): note is BookNote => Boolean(note));
      setSelectedAttachment(
        buildAuthorAttachment({
          authorName: selectedAuthor.name,
          books: selectedAuthor.books,
          includedQuotes,
        }),
      );
    }

    setAttachmentPicker(null);
    setSelectedIncludedNoteIds([]);
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

  async function importBookSnapshot(book: ChatSharedBookSnapshot) {
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      await addBook(bookSnapshotToAddBookPayload(book));
      setStatusMessage("Book saved to your library.");
    } catch (importError) {
      setError(toChatErrorMessage(importError, "Could not save book."));
    } finally {
      setSaving(false);
    }
  }

  async function importNoteAttachment(message: GroupMessage) {
    if (!user || message.attachment_payload?.type !== "note" || !noteImportTargetBookId) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const savedNote = await createBookNote(
        noteSnapshotToCreateInput({
          note: message.attachment_payload.note,
          bookId: noteImportTargetBookId,
          userId: user.id,
        }),
      );
      setNotes((current) => [savedNote, ...current]);
      setNoteImportMessageId(null);
      setNoteImportTargetBookId("");
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
    <div className="overflow-hidden rounded-lg border bg-background shadow-[var(--shadow-card)]">
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
            top: Math.min(messageActionMenu.y, window.innerHeight - 180),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => startReply(actionMenuMessage, actionMenuSenderProfile)}
          >
            <Reply className="h-4 w-4" />
            Reply
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

      <div className="grid h-[calc(100svh-8rem)] min-h-[38rem] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className={cn("min-h-0 border-r bg-muted/20", mobileThreadOpen && "hidden lg:flex", "flex-col")}>
          <div className="space-y-4 border-b p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-medium leading-snug">Start Chat</h2>
                <p className="text-xs text-muted-foreground">Find a reader or create a group.</p>
              </div>
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
            </div>

            <Select value={composeMode} onValueChange={(value) => setComposeMode(value as ComposeMode)}>
              <SelectTrigger aria-label="Chat type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct chat</SelectItem>
                <SelectItem value="group">Group chat</SelectItem>
              </SelectContent>
            </Select>

            {composeMode === "direct" ? (
              <div className="space-y-3">
                <form className="flex gap-2" onSubmit={searchProfiles}>
                  <Input
                    aria-label="Search username"
                    placeholder="Username or display name"
                    value={directSearch}
                    onChange={(event) => setDirectSearch(event.target.value)}
                  />
                  <Button type="submit" size="icon" variant="outline" disabled={directSearch.trim().length < 2}>
                    <Search className="h-4 w-4" />
                  </Button>
                </form>

                {profileResults.length > 0 && (
                  <div className="space-y-2">
                    {profileResults.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => startDirectChat(profile.id)}
                        disabled={saving}
                      >
                        <MessageAvatar profile={profile} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{profileLabel(profile)}</span>
                          <span className="block truncate text-xs text-muted-foreground">{profileSubLabel(profile)}</span>
                        </span>
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form className="space-y-3" onSubmit={submitGroup}>
                <div className="space-y-2">
                  <Label htmlFor="group-name">Name</Label>
                  <Input id="group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-description">Description</Label>
                  <Textarea
                    id="group-description"
                    value={groupDescription}
                    onChange={(event) => setGroupDescription(event.target.value)}
                    rows={3}
                  />
                </div>
                <Button type="submit" disabled={saving || !groupName.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create group
                </Button>
              </form>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="px-2 py-2">
              <h2 className="font-heading text-lg font-medium leading-snug">Chats</h2>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading..." : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
              </p>
            </div>

            {threads.length === 0 && !loading ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                Start a direct chat or create a group chat.
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
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
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
                <div className="min-w-0 text-center">
                  <h1 className="truncate font-heading text-base font-medium leading-snug sm:text-lg">
                    {selectedThread.title}
                  </h1>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedThread.group.kind === "direct"
                      ? "Direct chat"
                      : selectedThread.description || `${members.length} members`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant={settingsOpen ? "secondary" : "ghost"}
                  aria-label="Chat settings"
                  onClick={() => setSettingsOpen((current) => !current)}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>

              <div
                className={cn(
                  "grid min-h-0",
                  settingsOpen ? "lg:grid-cols-[minmax(0,1fr)_19rem]" : "lg:grid-cols-[minmax(0,1fr)]",
                )}
              >
                <div className="flex min-h-[32rem] min-w-0 flex-col">
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background p-4 sm:p-6">
                    {messagesLoading ? (
                      <p className="text-sm text-muted-foreground">Loading messages...</p>
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                    ) : (
                      messages.map((message) => {
                        const mine = message.sender_id === user?.id;
                        const senderProfile = memberProfiles.get(message.sender_id);
                        const editing = editingMessageId === message.id;
                        const heartReaction = message.reactions?.find((reaction) => reaction.reaction === "heart");
                        const canUseActions = !message.deleted_at;

                        return (
                          <div key={message.id} className={cn("flex gap-3", mine && "justify-end")}>
                            {!mine && <MessageAvatar profile={senderProfile} fallback={message.sender_id} />}
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
                                    {message.reply_snapshot && <ReplyPreview reply={message.reply_snapshot} compact />}
                                    {message.deleted_at ? "Message deleted" : message.content}
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
                                    books={books}
                                    noteImportOpen={noteImportMessageId === message.id}
                                    noteImportTargetBookId={noteImportTargetBookId}
                                    onImportBook={importBookSnapshot}
                                    onOpenNoteImport={() => {
                                      setNoteImportMessageId(message.id);
                                      setNoteImportTargetBookId("");
                                    }}
                                    onCancelNoteImport={() => {
                                      setNoteImportMessageId(null);
                                      setNoteImportTargetBookId("");
                                    }}
                                    onNoteTargetChange={setNoteImportTargetBookId}
                                    onImportNote={() => importNoteAttachment(message)}
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

                              <div className={cn("flex items-center gap-2", mine && "justify-end")}>
                                <span className="truncate text-xs font-medium text-muted-foreground">
                                  {mine ? "You" : profileLabel(senderProfile)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatMessageTime(message.created_at)}
                                  {message.edited_at && !message.deleted_at ? " · edited" : ""}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form className="space-y-2 border-t bg-background p-3" onSubmit={submitMessage}>
                    {selectedReply && (
                      <ReplyPreview reply={selectedReply} onCancel={() => setSelectedReply(null)} />
                    )}

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

                    <div className="flex items-end gap-2">
                      <div className="relative">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label="Attach"
                          onClick={() => setAttachMenuOpen((current) => !current)}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        {attachMenuOpen && (
                          <div className="absolute bottom-12 left-0 z-20 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => openAttachmentPicker("book")}
                            >
                              <BookOpen className="h-4 w-4" />
                              Attach Book
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => openAttachmentPicker("note")}
                            >
                              <StickyNote className="h-4 w-4" />
                              Attach Notes
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => openAttachmentPicker("author")}
                            >
                              <UserRound className="h-4 w-4" />
                              Attach Author
                            </button>
                          </div>
                        )}
                      </div>

                      <Textarea
                        aria-label="Message"
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        placeholder="Write a message"
                        rows={2}
                        className="min-h-12 resize-none rounded-full px-4 py-3"
                      />
                      <Button type="submit" size="icon" disabled={saving || (!messageText.trim() && !selectedAttachment)}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </div>

                {settingsOpen && (
                  <aside className="min-h-0 overflow-y-auto border-t bg-muted/20 p-4 lg:border-l lg:border-t-0">
                  <div className="space-y-4">
                    <div>
                      <h2 className="font-heading text-base font-medium leading-snug">Chat Settings</h2>
                      <p className="text-sm text-muted-foreground">
                        {members.length} member{members.length === 1 ? "" : "s"}
                      </p>
                    </div>

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

                    {selectedThread.group.kind === "group" && (
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
                </aside>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[38rem] items-center justify-center">
              <div className="p-6 text-center">
                <MessageCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No chat selected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start a chat or choose a conversation from the list.
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

      <Dialog open={attachmentPicker !== null} onOpenChange={(open) => !open && setAttachmentPicker(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {attachmentPicker === "book"
                ? "Attach Book"
                : attachmentPicker === "note"
                  ? "Attach Notes"
                  : "Attach Author"}
            </DialogTitle>
            <DialogDescription>
              Select what you want to send in this chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              aria-label="Search attachments"
              placeholder="Search"
              value={attachmentSearch}
              onChange={(event) => setAttachmentSearch(event.target.value)}
            />

            {attachmentPicker === "book" && (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {filteredBooks.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted",
                        selectedBookId === book.id && "bg-muted",
                      )}
                      onClick={() => {
                        setSelectedBookId(book.id);
                        setSelectedIncludedNoteIds([]);
                      }}
                    >
                      {book.cover_url ? (
                        <img src={book.cover_url} alt="" className="h-12 w-8 rounded object-cover" />
                      ) : (
                        <div className="flex h-12 w-8 items-center justify-center rounded bg-muted">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{book.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{book.authors.join(", ")}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                  <p className="text-sm font-medium">Include notes, reviews, or quotes</p>
                  {!selectedBook ? (
                    <p className="text-sm text-muted-foreground">Select a book first.</p>
                  ) : selectedBookNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">This book has no notes yet.</p>
                  ) : (
                    selectedBookNotes.map((note) => (
                      <label key={note.id} className="flex gap-2 rounded-md p-2 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={selectedIncludedNoteIds.includes(note.id)}
                          disabled={
                            !selectedIncludedNoteIds.includes(note.id) &&
                            selectedIncludedNoteIds.length >= MAX_INCLUDED_ATTACHMENT_NOTES
                          }
                          onChange={() => toggleIncludedNote(note.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium uppercase text-muted-foreground">
                            {noteLabel(note.label)}
                          </span>
                          <span className="line-clamp-2">{note.content}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {attachmentPicker === "note" && (
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {filteredNotes.map((note) => {
                  const book = booksById.get(note.book_id);
                  return (
                    <button
                      key={note.id}
                      type="button"
                      className={cn(
                        "w-full rounded-md p-3 text-left hover:bg-muted",
                        selectedNoteId === note.id && "bg-muted",
                      )}
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      <span className="block text-xs font-medium uppercase text-muted-foreground">
                        {noteLabel(note.label)}
                      </span>
                      <span className="mt-1 line-clamp-2 text-sm">{note.content}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {book?.title ?? "Unknown book"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {attachmentPicker === "author" && (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {filteredAuthors.map((author) => (
                    <button
                      key={author.name}
                      type="button"
                      className={cn(
                        "w-full rounded-md p-3 text-left hover:bg-muted",
                        selectedAuthorName === author.name && "bg-muted",
                      )}
                      onClick={() => {
                        setSelectedAuthorName(author.name);
                        setSelectedIncludedNoteIds([]);
                      }}
                    >
                      <span className="block truncate text-sm font-medium">{author.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {author.bookCount} book{author.bookCount === 1 ? "" : "s"} · {author.quoteCount} quote{author.quoteCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                  <p className="text-sm font-medium">Include quotes</p>
                  {!selectedAuthor ? (
                    <p className="text-sm text-muted-foreground">Select an author first.</p>
                  ) : selectedAuthorQuotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No quotes for this author yet.</p>
                  ) : (
                    selectedAuthorQuotes.map((quote) => (
                      <label key={quote.id} className="flex gap-2 rounded-md p-2 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={selectedIncludedNoteIds.includes(quote.id)}
                          disabled={
                            !selectedIncludedNoteIds.includes(quote.id) &&
                            selectedIncludedNoteIds.length >= MAX_INCLUDED_ATTACHMENT_NOTES
                          }
                          onChange={() => toggleIncludedNote(quote.id)}
                        />
                        <span className="line-clamp-2">{quote.content}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAttachmentPicker(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={attachSelectedItem}
              disabled={
                (attachmentPicker === "book" && !selectedBook) ||
                (attachmentPicker === "note" && !selectedNote) ||
                (attachmentPicker === "author" && !selectedAuthor)
              }
            >
              Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
