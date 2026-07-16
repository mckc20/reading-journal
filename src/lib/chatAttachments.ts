import type {
  Book,
  BookJournalEntryRecord,
  ChatAttachmentPayload,
  ChatAuthorAttachment,
  ChatBookAttachment,
  ChatNoteAttachment,
  ChatSeriesAttachment,
  ChatSharedBookSnapshot,
  ChatSharedNoteSnapshot,
} from "@/types";
import type { AddBookPayload } from "@/hooks/useBooks";
import type { CreateBookJournalEntryRecordInput } from "@/lib/bookJournal";

export const MAX_INCLUDED_ATTACHMENT_NOTES = 3;

export function buildSharedNoteSnapshot(
  note: BookJournalEntryRecord,
  book?: Book | null,
): ChatSharedNoteSnapshot {
  return {
    id: note.id,
    label: note.label,
    title: note.title ?? null,
    content: note.content,
    quote_speaker: note.quote_speaker ?? null,
    page_start: note.page_start ?? null,
    entry_date: note.entry_date ?? null,
    book_id: note.book_id,
    book_title: book?.title ?? null,
    book_authors: book?.authors ?? [],
  };
}

export function buildSharedBookSnapshot(
  book: Book,
  includedJournalEntries: BookJournalEntryRecord[] = [],
): ChatSharedBookSnapshot {
  return {
    id: book.id,
    title: book.title,
    authors: book.authors,
    cover_url: book.cover_url ?? null,
    genres: book.genres ?? [],
    total_pages: book.total_pages ?? null,
    language: book.language ?? null,
    format: book.format ?? null,
    isbn: book.isbn ?? null,
    publisher: book.publisher ?? null,
    publication_date: book.publication_date ?? null,
    publication_date_precision: book.publication_date_precision ?? null,
    description: book.description ?? null,
    metadata_source: book.metadata_source ?? null,
    metadata_source_url: book.metadata_source_url ?? null,
    volume_number: book.volume_number ?? null,
    included_journalEntries: includedJournalEntries
      .slice(0, MAX_INCLUDED_ATTACHMENT_NOTES)
      .map((note) => buildSharedNoteSnapshot(note, book)),
  };
}

export function buildBookAttachment(
  book: Book,
  includedJournalEntries: BookJournalEntryRecord[] = [],
): ChatBookAttachment {
  return {
    type: "book",
    book: buildSharedBookSnapshot(book, includedJournalEntries),
  };
}

export function buildNoteAttachment(note: BookJournalEntryRecord, book?: Book | null): ChatNoteAttachment {
  return {
    type: "note",
    note: buildSharedNoteSnapshot(note, book),
    book: book ? buildSharedBookSnapshot(book) : null,
  };
}

export function buildAuthorAttachment({
  authorId,
  authorName,
  books,
  includedQuotes,
}: {
  authorId?: string;
  authorName: string;
  books: Book[];
  includedQuotes: BookJournalEntryRecord[];
}): ChatAuthorAttachment {
  return {
    type: "author",
    author: {
      id: authorId,
      name: authorName,
      books: books.map((book) => buildSharedBookSnapshot(book)),
      included_quotes: includedQuotes
        .slice(0, MAX_INCLUDED_ATTACHMENT_NOTES)
        .map((note) => buildSharedNoteSnapshot(note, books.find((book) => book.id === note.book_id))),
    },
  };
}

export function buildSeriesAttachment({
  seriesId,
  seriesName,
  books,
  includedQuotes,
}: {
  seriesId?: string | null;
  seriesName: string;
  books: Book[];
  includedQuotes: BookJournalEntryRecord[];
}): ChatSeriesAttachment {
  return {
    type: "series",
    series: {
      id: seriesId ?? undefined,
      name: seriesName,
      books: books.map((book) => buildSharedBookSnapshot(book)),
      included_quotes: includedQuotes
        .slice(0, MAX_INCLUDED_ATTACHMENT_NOTES)
        .map((note) => buildSharedNoteSnapshot(note, books.find((book) => book.id === note.book_id))),
    },
  };
}

export function bookSnapshotToAddBookPayload(
  book: ChatSharedBookSnapshot,
  overrides: { series_id?: string | null } = {},
): AddBookPayload {
  return {
    title: book.title,
    authors: book.authors.length > 0 ? book.authors : ["Unknown"],
    genres: book.genres,
    status: "To Read",
    total_pages: book.total_pages ?? undefined,
    language: book.language ?? undefined,
    format: book.format ?? undefined,
    isbn: book.isbn ?? undefined,
    publisher: book.publisher ?? null,
    publication_date: book.publication_date ?? null,
    publication_date_precision: book.publication_date_precision ?? null,
    description: book.description ?? null,
    metadata_source: book.metadata_source ?? null,
    metadata_source_url: book.metadata_source_url ?? null,
    series_id: overrides.series_id ?? undefined,
    volume_number: book.volume_number ?? undefined,
    is_favorite: false,
  };
}

export function noteSnapshotToCreateInput({
  note,
  bookId,
  userId,
}: {
  note: ChatSharedNoteSnapshot;
  bookId: string;
  userId: string;
}): CreateBookJournalEntryRecordInput {
  return {
    bookId,
    userId,
    label: note.label,
    title: note.title ?? undefined,
    quoteSpeaker: note.quote_speaker ?? undefined,
    content: note.content,
    pageStart: note.page_start ?? undefined,
    noteDate: note.entry_date ?? undefined,
    isFavorite: false,
  };
}

export function attachmentTitle(attachment: ChatAttachmentPayload): string {
  if (attachment.type === "book") return attachment.book.title;
  if (attachment.type === "note") return attachment.note.title || attachment.note.book_title || "Shared note";
  if (attachment.type === "author") return attachment.author.name;
  return attachment.series.name;
}
