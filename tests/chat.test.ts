import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReplySnapshot,
  countUnreadMessages,
  getMessagePreview,
  normalizeChatMessageContent,
  normalizeMessageContent,
  summarizeHeartReactions,
  sortChatThreads,
} from "../src/lib/chatLogic";
import {
  bookSnapshotToAddBookPayload,
  buildBookAttachment,
  buildSeriesAttachment,
  noteSnapshotToCreateInput,
} from "../src/lib/chatAttachments";
import type { Book, BookJournalEntryRecord, Group, GroupMembership, GroupMessage } from "../src/types";

type TestChatThread = {
  group: Group;
  currentMembership: GroupMembership;
  members: GroupMembership[];
  title: string;
  description?: string;
  latestMessage?: GroupMessage;
  unreadCount: number;
};

test("normalizes message content before sending", () => {
  assert.equal(normalizeMessageContent("  Hello there  "), "Hello there");
});

test("rejects blank messages", () => {
  assert.throws(() => normalizeMessageContent("   "), /Message cannot be blank/);
});

test("allows attachment-only messages", () => {
  const attachment = buildBookAttachment(makeBook({ title: "Shared Book" }));
  assert.equal(normalizeChatMessageContent({ content: "   ", attachment }), "");
});

test("rejects empty messages without attachments", () => {
  assert.throws(() => normalizeChatMessageContent({ content: "   " }), /Message cannot be blank/);
});

test("uses a placeholder preview for deleted messages", () => {
  assert.equal(getMessagePreview(makeMessage({ deleted_at: "2026-06-20T10:00:00Z" })), "Message deleted");
});

test("counts unread messages after the member last-read timestamp", () => {
  const messages = [
    makeMessage({
      id: "old",
      sender_id: "other-user",
      created_at: "2026-06-20T09:00:00Z",
    }),
    makeMessage({
      id: "new-own",
      sender_id: "current-user",
      created_at: "2026-06-20T11:00:00Z",
    }),
    makeMessage({
      id: "new-other",
      sender_id: "other-user",
      created_at: "2026-06-20T11:30:00Z",
    }),
  ];

  assert.equal(
    countUnreadMessages({
      messages,
      membership: makeMembership({ last_read_at: "2026-06-20T10:00:00Z" }),
      currentUserId: "current-user",
    }),
    1,
  );
});

test("counts all other-user messages as unread when no last-read timestamp exists", () => {
  assert.equal(
    countUnreadMessages({
      messages: [
        makeMessage({ id: "own", sender_id: "current-user" }),
        makeMessage({ id: "other", sender_id: "other-user" }),
      ],
      membership: makeMembership({ last_read_at: null }),
      currentUserId: "current-user",
    }),
    1,
  );
});

test("sorts chat threads by latest message before group creation date", () => {
  const threads = [
    makeThread({
      group: makeGroup({ id: "older", created_at: "2026-06-20T08:00:00Z" }),
      latestMessage: makeMessage({ id: "older-message", created_at: "2026-06-20T12:00:00Z" }),
    }),
    makeThread({
      group: makeGroup({ id: "newer-created", created_at: "2026-06-20T10:00:00Z" }),
    }),
  ];

  assert.deepEqual(
    sortChatThreads(threads).map((thread) => thread.group.id),
    ["older", "newer-created"],
  );
});

test("builds clean book import payloads without personal reading state", () => {
  const attachment = buildBookAttachment(
    makeBook({
      title: "Private Progress Book",
      status: "Finished",
      rating: 5,
      is_favorite: true,
      current_page: 120,
      date_started: "2026-01-01",
      date_finished: "2026-01-20",
    }),
  );

  const payload = bookSnapshotToAddBookPayload(attachment.book);

  assert.equal(payload.title, "Private Progress Book");
  assert.equal(payload.status, "To Read");
  assert.equal(payload.is_favorite, false);
  assert.equal("rating" in payload, false);
  assert.equal("current_page" in payload, false);
  assert.equal("date_started" in payload, false);
  assert.equal("date_finished" in payload, false);
});

test("maps note snapshots to a selected target book", () => {
  const note = makeNote({ label: "quote", content: "A quote", quote_speaker: "Author" });
  const attachment = buildBookAttachment(makeBook(), [note]);
  const input = noteSnapshotToCreateInput({
    note: attachment.book.included_journalEntries?.[0] as NonNullable<typeof attachment.book.included_journalEntries>[number],
    bookId: "target-book",
    userId: "current-user",
  });

  assert.deepEqual(input, {
    bookId: "target-book",
    userId: "current-user",
    label: "quote",
    title: undefined,
    quoteSpeaker: "Author",
    content: "A quote",
    pageStart: undefined,
    noteDate: "2026-06-20",
    isFavorite: false,
  });
});

test("builds reply snapshots from text messages", () => {
  const snapshot = buildReplySnapshot({
    message: makeMessage({ id: "reply-source", content: "Original message" }),
    senderName: "Sabine",
  });

  assert.deepEqual(snapshot, {
    message_id: "reply-source",
    sender_id: "current-user",
    sender_name: "Sabine",
    text: "Original message",
    attachment_type: null,
    attachment_title: null,
    created_at: "2026-06-20T09:00:00Z",
  });
});

test("builds reply snapshots from attachment-only messages", () => {
  const attachment = buildBookAttachment(makeBook({ title: "Shared Book" }));
  const snapshot = buildReplySnapshot({
    message: makeMessage({ content: "", attachment_type: "book", attachment_payload: attachment }),
    senderName: "Sabine",
  });

  assert.equal(snapshot.text, "Shared Book");
  assert.equal(snapshot.attachment_type, "book");
  assert.equal(snapshot.attachment_title, "Shared Book");
});

test("summarizes heart reactions with participant names", () => {
  const summary = summarizeHeartReactions({
    currentUserId: "current-user",
    profiles: new Map([
      ["current-user", { display_name: "Martina" }],
      ["other-user", { username: "sabine" }],
    ]),
    reactions: [
      {
        message_id: "message-1",
        user_id: "current-user",
        reaction: "heart",
        created_at: "2026-06-20T10:00:00Z",
      },
      {
        message_id: "message-1",
        user_id: "other-user",
        reaction: "heart",
        created_at: "2026-06-20T10:01:00Z",
      },
    ],
  });

  assert.deepEqual(summary, [
    {
      reaction: "heart",
      count: 2,
      reacted_by_current_user: true,
      participants: [
        { user_id: "current-user", display_name: "Martina" },
        { user_id: "other-user", display_name: "sabine" },
      ],
    },
  ]);
});

test("builds series attachments with included quotes", () => {
  const attachment = buildSeriesAttachment({
    seriesName: "The Locked Tomb",
    books: [makeBook({ id: "book-a", title: "Gideon the Ninth" }), makeBook({ id: "book-b", title: "Harrow the Ninth" })],
    includedQuotes: [
      makeNote({ id: "quote-1", label: "quote", content: "The quote", book_id: "book-a" }),
    ],
  });

  assert.equal(attachment.type, "series");
  assert.equal(attachment.series.name, "The Locked Tomb");
  assert.equal(attachment.series.books.length, 2);
  assert.equal(attachment.series.included_quotes?.[0]?.content, "The quote");
});

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: "group-1",
    name: "Book Club",
    description: undefined,
    avatar_url: undefined,
    created_by: "current-user",
    kind: "group",
    direct_pair_key: null,
    created_at: "2026-06-20T08:00:00Z",
    ...overrides,
  };
}

function makeMembership(overrides: Partial<GroupMembership> = {}): GroupMembership {
  return {
    group_id: "group-1",
    user_id: "current-user",
    role: "member",
    status: "active",
    last_read_at: "2026-06-20T08:00:00Z",
    joined_at: "2026-06-20T08:00:00Z",
    ...overrides,
  };
}

function makeMessage(overrides: Partial<GroupMessage> = {}): GroupMessage {
  return {
    id: "message-1",
    group_id: "group-1",
    sender_id: "current-user",
    content: "Hello",
    created_at: "2026-06-20T09:00:00Z",
    updated_at: "2026-06-20T09:00:00Z",
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-1",
    title: "Book One",
    authors: ["Author One"],
    genres: ["Fantasy"],
    status: "To Read",
    cover_url: "https://example.com/cover.jpg",
    rating: null,
    is_favorite: false,
    total_pages: 300,
    language: "English",
    format: "Hardcover",
    isbn: "123",
    publisher: "Publisher",
    publication_date: "2026-01-01",
    publication_date_precision: "day",
    description: "Description",
    metadata_source: "open_library",
    metadata_source_url: "https://example.com",
    user_id: "current-user",
    created_at: "2026-06-20T08:00:00Z",
    ...overrides,
  };
}

function makeNote(overrides: Partial<BookJournalEntryRecord> = {}): BookJournalEntryRecord {
  return {
    id: "note-1",
    user_id: "current-user",
    book_id: "book-1",
    label: "note",
    title: null,
    quote_speaker: null,
    content: "A note",
    page_start: null,
    is_favorite: false,
    entry_date: "2026-06-20",
    created_at: "2026-06-20T08:00:00Z",
    updated_at: "2026-06-20T08:00:00Z",
    ...overrides,
  };
}

function makeThread(overrides: Partial<TestChatThread> = {}): TestChatThread {
  const group = overrides.group ?? makeGroup();
  return {
    group,
    currentMembership: makeMembership({ group_id: group.id }),
    members: [],
    title: group.name,
    description: group.description,
    latestMessage: undefined,
    unreadCount: 0,
    ...overrides,
  };
}
