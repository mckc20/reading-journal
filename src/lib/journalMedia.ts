import type {
  JournalEntryMedia,
  JournalEntryMediaItem,
  ManualJournalEntrySource,
  MediaAttachment,
} from "@/types";

export const JOURNAL_MEDIA_BUCKET = "journal-media";
export const JOURNAL_MEDIA_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const JOURNAL_MEDIA_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const DISPLAY_MAX_EDGE = 1600;
const THUMBNAIL_MAX_EDGE = 320;
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;

type AcceptedJournalMediaType = (typeof JOURNAL_MEDIA_ACCEPTED_TYPES)[number];

export interface JournalMediaFileLike {
  name: string;
  type: string;
  size: number;
}

interface StoredImageVariant {
  blob: Blob;
  width: number;
  height: number;
}

type JournalMediaRow = JournalEntryMedia & {
  media_attachment: MediaAttachment | MediaAttachment[] | null;
};

async function getSupabase() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export function validateJournalImageFile(file: JournalMediaFileLike): void {
  if (!JOURNAL_MEDIA_ACCEPTED_TYPES.includes(file.type as AcceptedJournalMediaType)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }

  if (file.size > JOURNAL_MEDIA_MAX_FILE_SIZE_BYTES) {
    throw new Error("Journal images must be 10 MB or smaller.");
  }
}

export function normalizeJournalMediaCaption(value: string | null | undefined): string | null {
  const caption = value?.trim();
  return caption ? caption : null;
}

const LEGACY_JOURNAL_MEDIA_REFERENCE_PATTERN = /\\?!\[[^\]\n]*\]\(\s*journal-media:[^) \n]+\s*\)/g;

export function removeLegacyJournalMediaReferences(markdown: string): string {
  return markdown
    .replace(LEGACY_JOURNAL_MEDIA_REFERENCE_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface JournalContentBlock {
  key: string;
  markdown: string;
  media: JournalEntryMediaItem[];
}

export function journalParagraphCount(markdown: string): number {
  return removeLegacyJournalMediaReferences(markdown)
    .trim()
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim().length > 0)
    .length;
}

export function nextJournalMediaPosition(markdown: string): number {
  return Math.max(1, journalParagraphCount(markdown));
}

export function splitMarkdownIntoJournalBlocks(
  markdown: string,
  media: JournalEntryMediaItem[] = [],
): JournalContentBlock[] {
  const paragraphs = removeLegacyJournalMediaReferences(markdown)
    .trim()
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim().length > 0);
  const blocks: JournalContentBlock[] = paragraphs.length > 0
    ? paragraphs.map((paragraph, index) => ({
      key: `paragraph-${index + 1}`,
      markdown: paragraph,
      media: [],
    }))
    : [{ key: "media-only", markdown: "", media: [] }];

  const sortedMedia = [...media].sort((a, b) => {
    const positionCompare = a.position - b.position;
    if (positionCompare !== 0) return positionCompare;
    return a.created_at.localeCompare(b.created_at);
  });

  sortedMedia.forEach((item) => {
    const targetIndex = paragraphs.length === 0
      ? 0
      : Math.min(Math.max(1, item.position), paragraphs.length) - 1;
    blocks[targetIndex].media.push(item);
  });

  return blocks.filter((block) => block.markdown.trim() || block.media.length > 0);
}

export function sourceForJournalEntryRecord(record: {
  book_id?: string;
  series_id?: string;
  author_id?: string;
}): ManualJournalEntrySource {
  if (record.book_id) return "book_note";
  if (record.series_id) return "series_note";
  return "author_note";
}

function mediaErrorToError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return new Error(message);
  }
  return new Error("Journal image request failed.");
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image."));
    };
    image.src = url;
  });
}

function getScaledSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function resizeImage(file: File, maxEdge: number, quality: number): Promise<StoredImageVariant> {
  const image = await loadImage(file);
  const size = getScaledSize(image.naturalWidth || image.width, image.naturalHeight || image.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare this image.");
  context.drawImage(image, 0, 0, size.width, size.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("Could not optimize this image.");

  return { blob, ...size };
}

async function createSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase.storage
    .from(JOURNAL_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS);
  if (error) throw mediaErrorToError(error);
  return data.signedUrl;
}

async function mediaRowToItem(row: JournalMediaRow): Promise<JournalEntryMediaItem | null> {
  const attachment = Array.isArray(row.media_attachment)
    ? row.media_attachment[0]
    : row.media_attachment;
  if (!attachment) return null;

  const [url, thumbnailUrl] = await Promise.all([
    createSignedUrl(attachment.file_path),
    createSignedUrl(attachment.thumbnail_path),
  ]);
  if (!url) return null;

  return {
    id: row.id,
    journal_entry_source: row.journal_entry_source,
    journal_entry_id: row.journal_entry_id,
    media_attachment_id: row.media_attachment_id,
    position: row.position,
    caption: row.caption,
    created_at: row.created_at,
    media_attachment: attachment,
    url,
    thumbnailUrl,
  };
}

export async function fetchJournalMediaForEntries(
  source: ManualJournalEntrySource,
  entryIds: string[],
): Promise<Record<string, JournalEntryMediaItem[]>> {
  if (entryIds.length === 0) return {};
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("journal_entry_media")
    .select("*, media_attachment:media_attachments(*)")
    .eq("journal_entry_source", source)
    .in("journal_entry_id", entryIds)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw mediaErrorToError(error);

  const items = await Promise.all(((data ?? []) as JournalMediaRow[]).map(mediaRowToItem));
  return items.reduce<Record<string, JournalEntryMediaItem[]>>((groups, item) => {
    if (!item) return groups;
    groups[item.journal_entry_id] = [...(groups[item.journal_entry_id] ?? []), item];
    return groups;
  }, {});
}

export async function withJournalMedia<T extends { id: string }>(
  source: ManualJournalEntrySource,
  records: T[],
): Promise<Array<T & { media?: JournalEntryMediaItem[] }>> {
  const mediaByEntryId = await fetchJournalMediaForEntries(source, records.map((record) => record.id));
  return records.map((record) => ({
    ...record,
    media: mediaByEntryId[record.id] ?? [],
  }));
}

export async function uploadJournalImage(input: {
  userId: string;
  journalEntrySource: ManualJournalEntrySource;
  journalEntryId: string;
  file: File;
  position: number;
  caption?: string | null;
}): Promise<JournalEntryMediaItem> {
  validateJournalImageFile(input.file);
  const supabase = await getSupabase();

  const mediaId = crypto.randomUUID();
  const display = await resizeImage(input.file, DISPLAY_MAX_EDGE, 0.86);
  const thumbnail = await resizeImage(input.file, THUMBNAIL_MAX_EDGE, 0.78);
  const filePath = `${input.userId}/${mediaId}/image.webp`;
  const thumbnailPath = `${input.userId}/${mediaId}/thumbnail.webp`;

  const displayUpload = await supabase.storage
    .from(JOURNAL_MEDIA_BUCKET)
    .upload(filePath, display.blob, { contentType: "image/webp", upsert: false });
  if (displayUpload.error) throw mediaErrorToError(displayUpload.error);

  const thumbnailUpload = await supabase.storage
    .from(JOURNAL_MEDIA_BUCKET)
    .upload(thumbnailPath, thumbnail.blob, { contentType: "image/webp", upsert: false });
  if (thumbnailUpload.error) {
    await supabase.storage.from(JOURNAL_MEDIA_BUCKET).remove([filePath]);
    throw mediaErrorToError(thumbnailUpload.error);
  }

  const { data: attachment, error: attachmentError } = await supabase
    .from("media_attachments")
    .insert({
      id: mediaId,
      user_id: input.userId,
      file_path: filePath,
      thumbnail_path: thumbnailPath,
      file_name: input.file.name,
      file_type: "image/webp",
      file_size: display.blob.size,
      width: display.width,
      height: display.height,
    })
    .select()
    .single();

  if (attachmentError) {
    await supabase.storage.from(JOURNAL_MEDIA_BUCKET).remove([filePath, thumbnailPath]);
    throw mediaErrorToError(attachmentError);
  }

  const { data: relation, error: relationError } = await supabase
    .from("journal_entry_media")
    .insert({
      journal_entry_source: input.journalEntrySource,
      journal_entry_id: input.journalEntryId,
      media_attachment_id: mediaId,
      position: input.position,
      caption: normalizeJournalMediaCaption(input.caption),
    })
    .select()
    .single();

  if (relationError) {
    await supabase.storage.from(JOURNAL_MEDIA_BUCKET).remove([filePath, thumbnailPath]);
    await supabase.from("media_attachments").delete().eq("id", mediaId);
    throw mediaErrorToError(relationError);
  }

  const item = await mediaRowToItem({
    ...(relation as JournalEntryMedia),
    media_attachment: attachment as MediaAttachment,
  });
  if (!item) throw new Error("Could not load uploaded image.");
  return item;
}

export async function updateJournalEntryMediaItem(
  item: Pick<JournalEntryMedia, "id"> & {
    position: number;
    caption?: string | null;
  },
): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("journal_entry_media")
    .update({
      position: item.position,
      caption: normalizeJournalMediaCaption(item.caption),
    })
    .eq("id", item.id);

  if (error) throw mediaErrorToError(error);
}

export async function detachJournalEntryMediaItem(item: JournalEntryMediaItem): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from("journal_entry_media").delete().eq("id", item.id);
  if (error) throw mediaErrorToError(error);

  const { count, error: countError } = await supabase
    .from("journal_entry_media")
    .select("id", { count: "exact", head: true })
    .eq("media_attachment_id", item.media_attachment_id);
  if (countError) throw mediaErrorToError(countError);
  if ((count ?? 0) > 0) return;

  const paths = [item.media_attachment.file_path, item.media_attachment.thumbnail_path].filter(
    (path): path is string => Boolean(path),
  );
  if (paths.length > 0) {
    await supabase.storage.from(JOURNAL_MEDIA_BUCKET).remove(paths);
  }
  const { error: deleteError } = await supabase
    .from("media_attachments")
    .delete()
    .eq("id", item.media_attachment_id);
  if (deleteError) throw mediaErrorToError(deleteError);
}
