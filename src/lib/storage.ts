import { supabase } from "./supabase";

const VALID_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"] as const;

function getImageExtension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

export function buildImagePath(userId: string, entityId: string, extension: string): string {
  return `${userId}/${entityId}.${extension}`;
}

export function getValidImageExtensions(): readonly string[] {
  return VALID_IMAGE_EXTENSIONS;
}

export async function uploadPublicImage(
  bucket: string,
  userId: string,
  entityId: string,
  file: File,
): Promise<{ publicUrl: string; extension: string; path: string }> {
  const extension = getImageExtension(file);
  if (!VALID_IMAGE_EXTENSIONS.includes(extension as (typeof VALID_IMAGE_EXTENSIONS)[number])) {
    throw new Error(`Invalid file type ".${extension}". Allowed: ${VALID_IMAGE_EXTENSIONS.join(", ")}`);
  }

  const path = buildImagePath(userId, entityId, extension);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    publicUrl: `${data.publicUrl}?v=${cacheBuster}`,
    extension,
    path,
  };
}

export async function deletePublicImageVariants(
  bucket: string,
  userId: string,
  entityId: string,
  keepExtension?: string | null,
): Promise<void> {
  const paths = VALID_IMAGE_EXTENSIONS.filter((extension) => extension !== keepExtension).map((extension) =>
    buildImagePath(userId, entityId, extension),
  );
  await supabase.storage.from(bucket).remove(paths);
}
