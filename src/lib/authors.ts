import { supabase } from "@/lib/supabase";
import { parsePublicationDate, parsePublicationDateInput } from "@/lib/publicationDate";
import { deletePublicImageVariants, uploadPublicImage } from "@/lib/storage";
import type { Author, PublicationDatePrecision } from "@/types";

export interface AuthorInput {
  name: string;
  photo_url?: string | null;
  photo_file?: File | null;
  remove_photo?: boolean;
  birth_date?: string | null;
  birth_date_precision?: PublicationDatePrecision | null;
  death_date?: string | null;
  death_date_precision?: PublicationDatePrecision | null;
  bio?: string | null;
  is_favorite?: boolean;
  nationality?: string | null;
}

function normalizeAuthorName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value?: string | null): { date: string | null; precision: "year" | "month" | "day" | null } {
  const parsed = parsePublicationDate(value ?? undefined);
  return {
    date: parsed?.date ?? null,
    precision: parsed?.precision ?? null,
  };
}

function normalizeOptionalDateWithPrecision(
  value?: string | null,
  precision?: PublicationDatePrecision | null,
): { date: string | null; precision: PublicationDatePrecision | null } {
  if (value && precision) {
    const parsed = parsePublicationDateInput(value, precision);
    if (parsed) return parsed;
  }

  const parsed = normalizeOptionalDate(value);
  return {
    date: parsed.date,
    precision: parsed.precision,
  };
}

function authorKey(name: string): string {
  return normalizeAuthorName(name).toLocaleLowerCase();
}

function normalizeAuthorInput(input: AuthorInput): Omit<AuthorInput, "name"> & { name: string } {
  const name = normalizeAuthorName(input.name);
  if (!name) throw new Error("Author name is required.");
  const birth = normalizeOptionalDateWithPrecision(input.birth_date, input.birth_date_precision);
  const death = normalizeOptionalDateWithPrecision(input.death_date, input.death_date_precision);

  return {
    name,
    photo_url: normalizeOptionalText(input.photo_url),
    photo_file: input.photo_file ?? null,
    remove_photo: input.remove_photo ?? false,
    birth_date: birth.date,
    birth_date_precision: birth.precision,
    death_date: death.date,
    death_date_precision: death.precision,
    bio: normalizeOptionalText(input.bio),
    is_favorite: input.is_favorite ?? false,
    nationality: normalizeOptionalText(input.nationality),
  };
}

function withoutPhotoFields(input: ReturnType<typeof normalizeAuthorInput>) {
  const { photo_url: _photoUrl, photo_file: _photoFile, remove_photo: _removePhoto, ...rest } = input;
  return rest;
}

async function saveAuthorPhoto(userId: string, authorId: string, file: File): Promise<{ photoUrl: string; extension: string }> {
  const { publicUrl, extension } = await uploadPublicImage("author-photos", userId, authorId, file);
  return { photoUrl: publicUrl, extension };
}

async function deleteAuthorPhotos(userId: string, authorId: string, keepExtension?: string | null): Promise<void> {
  await deletePublicImageVariants("author-photos", userId, authorId, keepExtension);
}

async function fetchAuthorRowsByUser(userId: string): Promise<Author[]> {
  const { data, error } = await supabase
    .from("authors")
    .select("*")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Author[];
}

export async function fetchAuthors(): Promise<Author[]> {
  const { data, error } = await supabase
    .from("authors")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Author[];
}

export async function fetchAuthorById(id: string): Promise<Author> {
  const { data, error } = await supabase.from("authors").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Author;
}

export async function createAuthor(userId: string, input: AuthorInput): Promise<Author> {
  const normalized = normalizeAuthorInput(input);
  const { data: existing, error: existingError } = await supabase
    .from("authors")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", normalized.name)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as Author;

  const { data, error } = await supabase
    .from("authors")
    .insert({
      user_id: userId,
      ...withoutPhotoFields(normalized),
      photo_url: input.photo_url !== undefined ? normalized.photo_url : null,
    })
    .select()
    .single();

  if (error) {
    const { data: retry, error: retryError } = await supabase
      .from("authors")
      .select("*")
      .eq("user_id", userId)
      .ilike("name", normalized.name)
      .maybeSingle();
    if (!retryError && retry) return retry as Author;
    throw error;
  }

  const created = data as Author;
  if (!normalized.photo_file) return created;

  try {
    await deleteAuthorPhotos(userId, created.id).catch(() => {});
    const { photoUrl, extension } = await saveAuthorPhoto(userId, created.id, normalized.photo_file);
    const { data: updated, error: updateError } = await supabase
      .from("authors")
      .update({ photo_url: photoUrl })
      .eq("id", created.id)
      .select()
      .single();
    if (updateError) throw updateError;
    await deleteAuthorPhotos(userId, created.id, extension).catch(() => {});
    return updated as Author;
  } catch (photoError) {
    console.warn("Author photo upload failed after creating author:", photoError);
    return created;
  }
}

export async function updateAuthor(id: string, input: AuthorInput): Promise<Author> {
  const normalized = normalizeAuthorInput(input);
  const { data: existing, error: existingError } = await supabase
    .from("authors")
    .select("id,user_id,photo_url")
    .eq("id", id)
    .single();
  if (existingError) throw existingError;

  const { data, error } = await supabase
    .from("authors")
    .update({
      ...withoutPhotoFields(normalized),
      ...(normalized.remove_photo
        ? { photo_url: null }
        : input.photo_url !== undefined && !normalized.photo_file
          ? { photo_url: normalized.photo_url }
          : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  const updated = data as Author;
  if (normalized.remove_photo) {
    await deleteAuthorPhotos(existing.user_id, id).catch(() => {});
    return updated;
  }

  if (!normalized.photo_file) return updated;

  try {
    const { photoUrl, extension } = await saveAuthorPhoto(existing.user_id, id, normalized.photo_file);
    const { data: savedPhoto, error: photoUpdateError } = await supabase
      .from("authors")
      .update({ photo_url: photoUrl })
      .eq("id", id)
      .select()
      .single();
    if (photoUpdateError) throw photoUpdateError;
    await deleteAuthorPhotos(existing.user_id, id, extension).catch(() => {});
    return savedPhoto as Author;
  } catch (photoError) {
    console.warn("Author photo upload failed while updating author:", photoError);
    return updated;
  }
}

export async function deleteAuthor(id: string): Promise<void> {
  const { error: detachError } = await supabase.from("book_authors").delete().eq("author_id", id);
  if (detachError) throw detachError;

  const { error } = await supabase.from("authors").delete().eq("id", id);
  if (error) throw error;
}

export async function ensureAuthorsForNames(
  userId: string,
  names: string[],
): Promise<Author[]> {
  const uniqueNames = Array.from(
    new Map(
      names
        .map((name) => normalizeAuthorName(name))
        .filter(Boolean)
        .map((name) => [authorKey(name), name] as const),
    ).values(),
  );

  if (uniqueNames.length === 0) return [];

  const existingAuthors = await fetchAuthorRowsByUser(userId);
  const authorsByKey = new Map(existingAuthors.map((author) => [authorKey(author.name), author] as const));
  const resolved: Author[] = [];

  for (const name of uniqueNames) {
    const key = authorKey(name);
    const existing = authorsByKey.get(key);
    if (existing) {
      resolved.push(existing);
      continue;
    }

    const created = await createAuthor(userId, { name });
    authorsByKey.set(key, created);
    resolved.push(created);
  }

  return resolved;
}

export async function replaceBookAuthors(
  bookId: string,
  userId: string,
  authorNames: string[],
): Promise<void> {
  const authors = await ensureAuthorsForNames(userId, authorNames);

  const { error: deleteError } = await supabase
    .from("book_authors")
    .delete()
    .eq("book_id", bookId);
  if (deleteError) throw deleteError;

  if (authors.length === 0) return;

  const { error: insertError } = await supabase.from("book_authors").insert(
    authors.map((author, index) => ({
      book_id: bookId,
      author_id: author.id,
      position: index,
    })),
  );
  if (insertError) throw insertError;
}
