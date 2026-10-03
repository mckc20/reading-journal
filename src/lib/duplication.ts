import { createAuthor, type AuthorInput } from "@/lib/authors";
import { createBook, type BookInsert, createSeries, type SeriesInput } from "@/lib/books";
import { supabase } from "@/lib/supabase";
import type { Author, Book, Series } from "@/types";

export interface DuplicateOptions {
  copyJournalEntries: boolean;
  copyBooks?: boolean;
}

type JournalSource = "book_note" | "series_note" | "author_note";
type JournalTable = "book_journal" | "series_journal" | "author_journal";

const JOURNAL_TABLES: Record<JournalSource, { table: JournalTable; foreignKey: "book_id" | "series_id" | "author_id" }> = {
  book_note: { table: "book_journal", foreignKey: "book_id" },
  series_note: { table: "series_journal", foreignKey: "series_id" },
  author_note: { table: "author_journal", foreignKey: "author_id" },
};

function copyName(value: string): string {
  return `Copy of ${value}`;
}

function cleanBookPayload(book: Book, userId: string, id: string, overrides: Partial<Book> = {}): BookInsert {
  return {
    id,
    user_id: userId,
    title: copyName(book.title),
    authors: overrides.authors ?? book.authors,
    genre_ids: book.genre_ids ?? [],
    status: book.status,
    cover_url: book.cover_url ?? null,
    rating: book.rating ?? null,
    is_favorite: book.is_favorite,
    current_page: book.current_page,
    total_pages: book.total_pages,
    date_started: book.date_started,
    date_finished: book.date_finished,
    language: book.language,
    source: book.source,
    format: book.format,
    isbn: book.isbn,
    publication_date: book.publication_date ?? null,
    description: book.description ?? null,
    metadata_source: book.metadata_source ?? null,
    metadata_source_url: book.metadata_source_url ?? null,
    price: book.price ?? null,
    purchase_url: book.purchase_url ?? null,
    series_id: overrides.series_id ?? book.series_id,
    volume_number: book.volume_number,
  } as BookInsert;
}

async function copyJournalEntries(
  source: JournalSource,
  sourceId: string,
  targetId: string,
  userId: string,
): Promise<void> {
  const config = JOURNAL_TABLES[source];
  const { data, error } = await supabase
    .from(config.table)
    .select("*")
    .eq(config.foreignKey, sourceId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const sourceEntries = (data ?? []) as Record<string, unknown>[];
  const idMap = new Map<string, string>();

  for (const entry of sourceEntries) {
    const sourceEntryId = String(entry.id);
    const newEntryId = crypto.randomUUID();
    const parentId = typeof entry.parent_entry_id === "string"
      ? idMap.get(entry.parent_entry_id) ?? null
      : null;
    const { id: _id, public_id: _publicId, created_at: _createdAt, updated_at: _updatedAt, ...fields } = entry;
    const payload = {
      ...fields,
      id: newEntryId,
      [config.foreignKey]: targetId,
      user_id: userId,
      parent_entry_id: parentId,
    };
    const { error: insertError } = await supabase.from(config.table).insert(payload);
    if (insertError) throw insertError;
    idMap.set(sourceEntryId, newEntryId);
  }

  if (sourceEntries.length === 0) return;

  const sourceIds = sourceEntries.map((entry) => String(entry.id));
  const { data: mediaRows, error: mediaError } = await supabase
    .from("journal_entry_media")
    .select("journal_entry_source,journal_entry_id,media_attachment_id,position,caption")
    .eq("journal_entry_source", source)
    .in("journal_entry_id", sourceIds);
  if (mediaError) throw mediaError;

  const mediaPayload = ((mediaRows ?? []) as Record<string, unknown>[])
    .map((row) => ({
      ...row,
      id: crypto.randomUUID(),
      journal_entry_id: idMap.get(String(row.journal_entry_id)),
    }))
    .filter((row) => row.journal_entry_id);
  if (mediaPayload.length > 0) {
    const { error: mediaInsertError } = await supabase.from("journal_entry_media").insert(mediaPayload);
    if (mediaInsertError) throw mediaInsertError;
  }
}

export async function duplicateBookRecord(
  book: Book,
  userId: string,
  options: DuplicateOptions,
  overrides: Partial<Book> = {},
): Promise<Book> {
  const duplicate = await createBook(cleanBookPayload(book, userId, crypto.randomUUID(), overrides));
  if (options.copyJournalEntries) {
    await copyJournalEntries("book_note", book.id, duplicate.id, userId);
  }
  return duplicate;
}

export async function duplicateAuthorRecord(
  author: Author,
  books: Book[],
  userId: string,
  options: DuplicateOptions,
): Promise<Author> {
  const authorInput: AuthorInput = {
    name: copyName(author.name),
    photo_url: author.photo_url ?? null,
    bio: author.bio ?? null,
    is_favorite: author.is_favorite,
  };
  const duplicate = await createAuthor(userId, authorInput);

  if (options.copyJournalEntries) {
    await copyJournalEntries("author_note", author.id, duplicate.id, userId);
  }

  if (options.copyBooks) {
    const sourceBooks = books.filter((book) =>
      book.authors.some((name) => name.trim().toLocaleLowerCase() === author.name.trim().toLocaleLowerCase()),
    );
    for (const book of sourceBooks) {
      await duplicateBookRecord(book, userId, {
        copyJournalEntries: options.copyJournalEntries,
      }, { authors: [duplicate.name] });
    }
  }

  return duplicate;
}

export async function duplicateSeriesRecord(
  series: Series,
  books: Book[],
  userId: string,
  options: DuplicateOptions,
): Promise<Series> {
  const seriesInput: SeriesInput = {
    name: copyName(series.name),
    description: series.description ?? null,
    status: series.status,
    is_favorite: series.is_favorite,
    cover_url: series.cover_url ?? null,
    journal_content: series.journal_content ?? null,
  };
  const duplicate = await createSeries(userId, seriesInput);

  if (options.copyJournalEntries) {
    await copyJournalEntries("series_note", series.id, duplicate.id, userId);
  }

  if (options.copyBooks) {
    const sourceBooks = books.filter((book) => book.series_id === series.id);
    for (const book of sourceBooks) {
      await duplicateBookRecord(book, userId, {
        copyJournalEntries: options.copyJournalEntries,
      }, { series_id: duplicate.id });
    }
  }

  return duplicate;
}
