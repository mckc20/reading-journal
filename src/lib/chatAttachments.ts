import type {
  AuthorJournalEntryRecord,
  Author,
  Book,
  BookJournalEntryRecord,
  ChatAttachmentPayload,
  ChatAuthorAttachment,
  ChatBookAttachment,
  ChatNoteAttachment,
  ChatSeriesAttachment,
  ChatSharedBookSnapshot,
  ChatSharedNoteSnapshot,
  SeriesJournalEntryRecord,
} from "@/types";
import type { AddBookPayload } from "@/hooks/useBooks";
import type { CreateBookJournalEntryRecordInput } from "@/lib/bookJournal";

type ShareableJournalEntry = BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord;

export type SharedJournalSource = {
  type: "book" | "series" | "author";
  id: string;
  title: string;
  authors?: string[];
  imageUrl?: string | null;
};

export const MAX_INCLUDED_ATTACHMENT_NOTES = 3;

export function buildSharedNoteSnapshot(
  note: ShareableJournalEntry,
  source?: SharedJournalSource,
): ChatSharedNoteSnapshot {
  const isBookSource = source?.type === "book" || "book_id" in note;
  const bookId = "book_id" in note ? note.book_id : null;
  return {
    id: note.id,
    label: note.label,
    content: note.content,
    attribution: note.attribution ?? null,
    page_start: note.page_start ?? null,
    entry_date: note.entry_date ?? null,
    tags: note.tags ?? null,
    book_id: bookId,
    book_title: isBookSource ? source?.title ?? null : null,
    book_authors: isBookSource ? source?.authors ?? [] : [],
    source_type: source?.type ?? (isBookSource ? "book" : undefined),
    source_id: source?.id ?? bookId,
    source_title: source?.title ?? null,
    source_authors: source?.authors ?? [],
    source_image_url: source?.imageUrl ?? null,
  };
}

export function buildSharedBookSnapshot(
  book: Book,
  includedJournalEntries: BookJournalEntryRecord[] = [],
  authorProfiles: Author[] = [],
): ChatSharedBookSnapshot {
  const authorPhotosByName = new Map(
    authorProfiles.map((author) => [author.name.trim().toLocaleLowerCase(), author.photo_url ?? null]),
  );
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
    publication_date: book.publication_date ?? null,
    description: book.description ?? null,
    metadata_source: book.metadata_source ?? null,
    metadata_source_url: book.metadata_source_url ?? null,
    volume_number: book.volume_number ?? null,
    author_profiles: book.authors.map((name) => ({
      name,
      photo_url: authorPhotosByName.get(name.trim().toLocaleLowerCase()) ?? null,
    })),
    included_journalEntries: includedJournalEntries
      .slice(0, MAX_INCLUDED_ATTACHMENT_NOTES)
      .map((note) => buildSharedNoteSnapshot(note, {
        type: "book",
        id: book.id,
        title: book.title,
        authors: book.authors,
        imageUrl: book.cover_url,
      })),
  };
}

export function buildBookAttachment(
  book: Book,
  includedJournalEntries: BookJournalEntryRecord[] = [],
  authorProfiles: Author[] = [],
): ChatBookAttachment {
  return {
    type: "book",
    book: buildSharedBookSnapshot(book, includedJournalEntries, authorProfiles),
  };
}

export function buildNoteAttachment(note: ShareableJournalEntry, source: SharedJournalSource): ChatNoteAttachment {
  return {
    type: "note",
    note: buildSharedNoteSnapshot(note, source),
    book: source.type === "book" ? {
      id: source.id,
      title: source.title,
      authors: source.authors ?? [],
      cover_url: source.imageUrl ?? null,
    } : null,
  };
}

export function buildAuthorAttachment({
  authorId,
  authorName,
  authorPhotoUrl,
  authorBio,
  books,
  includedQuotes,
}: {
  authorId?: string;
  authorName: string;
  authorPhotoUrl?: string | null;
  authorBio?: string | null;
  books: Book[];
  includedQuotes: BookJournalEntryRecord[];
}): ChatAuthorAttachment {
  return {
    type: "author",
    author: {
      id: authorId,
      name: authorName,
      photo_url: authorPhotoUrl ?? null,
      bio: authorBio ?? null,
      books: books.map((book) => buildSharedBookSnapshot(book)),
      included_quotes: includedQuotes
        .slice(0, MAX_INCLUDED_ATTACHMENT_NOTES)
        .map((note) => {
          const book = books.find((item) => item.id === note.book_id);
          return buildSharedNoteSnapshot(note, book ? {
            type: "book",
            id: book.id,
            title: book.title,
            authors: book.authors,
            imageUrl: book.cover_url,
          } : undefined);
        }),
    },
  };
}

export function buildSeriesAttachment({
  seriesId,
  seriesName,
  seriesCoverUrl,
  seriesDescription,
  books,
  authorProfiles = [],
  includedQuotes,
}: {
  seriesId?: string | null;
  seriesName: string;
  seriesCoverUrl?: string | null;
  seriesDescription?: string | null;
  books: Book[];
  authorProfiles?: Author[];
  includedQuotes: BookJournalEntryRecord[];
}): ChatSeriesAttachment {
  return {
    type: "series",
    series: {
      id: seriesId ?? undefined,
      name: seriesName,
      cover_url: seriesCoverUrl ?? null,
      authors: Array.from(new Set(books.flatMap((book) => book.authors))),
      description: seriesDescription ?? null,
      books: books.map((book) => buildSharedBookSnapshot(book, [], authorProfiles)),
      included_quotes: includedQuotes
        .slice(0, MAX_INCLUDED_ATTACHMENT_NOTES)
        .map((note) => {
          const book = books.find((item) => item.id === note.book_id);
          return buildSharedNoteSnapshot(note, book ? {
            type: "book",
            id: book.id,
            title: book.title,
            authors: book.authors,
            imageUrl: book.cover_url,
          } : undefined);
        }),
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
    cover_url: book.cover_url ?? undefined,
    genres: book.genres,
    status: "To Read",
    total_pages: book.total_pages ?? undefined,
    language: book.language ?? undefined,
    format: book.format ?? undefined,
    isbn: book.isbn ?? undefined,
    publication_date: book.publication_date ?? null,
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
    attribution: note.attribution ?? undefined,
    content: note.content,
    pageStart: note.page_start ?? undefined,
    ...(note.tags?.length ? { tags: note.tags } : {}),
    noteDate: note.entry_date ?? undefined,
    isFavorite: false,
  };
}

export function attachmentTitle(attachment: ChatAttachmentPayload): string {
  if (attachment.type === "book") return attachment.book.title;
  if (attachment.type === "note") return attachment.note.book_title || "Shared note";
  if (attachment.type === "author") return attachment.author.name;
  return attachment.series.name;
}
