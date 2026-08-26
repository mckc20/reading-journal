import { createClient } from "npm:@supabase/supabase-js@2";

type ImageTargetType = "book" | "author" | "series";

type RequestBody = {
  messageId?: string;
  targetType?: ImageTargetType;
  targetId?: string;
  sourceBookId?: string;
  sourceAuthorName?: string;
};

type StorageLocation = {
  bucket: string;
  path: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const destinationBuckets: Record<ImageTargetType, string> = {
  book: "covers",
  author: "author-photos",
  series: "series-banners",
};

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sourceUrlForTarget(
  payload: Record<string, unknown>,
  attachmentType: string,
  targetType: ImageTargetType,
  sourceBookId?: string,
  sourceAuthorName?: string,
): string | null {
  if (targetType === "book") {
    if (attachmentType === "book") {
      const book = payload.book as Record<string, unknown> | undefined;
      return typeof book?.cover_url === "string" ? book.cover_url : null;
    }
    if (attachmentType === "series" && sourceBookId) {
      const series = payload.series as Record<string, unknown> | undefined;
      const books = Array.isArray(series?.books) ? series.books : [];
      const sourceBook = books.find((book) => (
        typeof book === "object" && book !== null && (book as Record<string, unknown>).id === sourceBookId
      )) as Record<string, unknown> | undefined;
      return typeof sourceBook?.cover_url === "string" ? sourceBook.cover_url : null;
    }
    if (attachmentType === "author" && sourceBookId) {
      const author = payload.author as Record<string, unknown> | undefined;
      const books = Array.isArray(author?.books) ? author.books : [];
      const sourceBook = books.find((book) => (
        typeof book === "object" && book !== null && (book as Record<string, unknown>).id === sourceBookId
      )) as Record<string, unknown> | undefined;
      return typeof sourceBook?.cover_url === "string" ? sourceBook.cover_url : null;
    }
    return null;
  }
  if (targetType === "author") {
    if (attachmentType === "author") {
      const author = payload.author as Record<string, unknown> | undefined;
      return typeof author?.photo_url === "string" ? author.photo_url : null;
    }

    const authorPhotoForBook = (book: Record<string, unknown> | undefined): string | null => {
      if (!sourceAuthorName) return null;
      const profiles = Array.isArray(book?.author_profiles) ? book.author_profiles : [];
      const author = profiles.find((profile) => (
        typeof profile === "object"
        && profile !== null
        && typeof (profile as Record<string, unknown>).name === "string"
        && (profile as Record<string, unknown>).name.toLocaleLowerCase() === sourceAuthorName.trim().toLocaleLowerCase()
      )) as Record<string, unknown> | undefined;
      return typeof author?.photo_url === "string" ? author.photo_url : null;
    };

    if (attachmentType === "book") return authorPhotoForBook(payload.book as Record<string, unknown> | undefined);
    if (attachmentType === "series" && sourceBookId) {
      const series = payload.series as Record<string, unknown> | undefined;
      const books = Array.isArray(series?.books) ? series.books : [];
      const book = books.find((item) => (
        typeof item === "object" && item !== null && (item as Record<string, unknown>).id === sourceBookId
      )) as Record<string, unknown> | undefined;
      return authorPhotoForBook(book);
    }
    return null;
  }
  if (attachmentType !== "series") return null;
  const series = payload.series as Record<string, unknown> | undefined;
  return typeof series?.cover_url === "string" ? series.cover_url : null;
}

function parseSourceStorageLocation(sourceUrl: string, projectUrl: string, targetType: ImageTargetType): StorageLocation {
  const source = new URL(sourceUrl);
  if (source.origin !== new URL(projectUrl).origin) {
    throw new Error("Only images stored in this reading journal can be copied.");
  }

  const prefix = "/storage/v1/object/public/";
  if (!source.pathname.startsWith(prefix)) {
    throw new Error("The shared image does not use a public storage URL.");
  }

  const [bucket, ...pathParts] = source.pathname.slice(prefix.length).split("/");
  if (bucket !== destinationBuckets[targetType] || pathParts.length === 0) {
    throw new Error("The shared image does not match this attachment type.");
  }

  return { bucket, path: decodeURIComponent(pathParts.join("/")) };
}

function extensionForImage(path: string, contentType: string): string {
  const fromPath = path.split(".").pop()?.toLowerCase();
  if (fromPath && imageExtensions.has(fromPath)) return fromPath === "jpeg" ? "jpg" : fromPath;

  const fromContentType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const extension = fromContentType[contentType];
  if (!extension) throw new Error("The shared image has an unsupported format.");
  return extension;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication is required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "The image-copy service is not configured." }, 500);
    }

    const body = await request.json() as RequestBody;
    if (!body.messageId || !body.targetId || !body.targetType || !(body.targetType in destinationBuckets)) {
      return json({ error: "A message and valid destination are required." }, 400);
    }

    const requester = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await requester.auth.getUser();
    if (authError || !authData.user) return json({ error: "Authentication is required." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: message, error: messageError } = await admin
      .from("group_messages")
      .select("group_id, attachment_type, attachment_payload")
      .eq("id", body.messageId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message?.attachment_payload) {
      return json({ error: "The requested image is not available for this attachment." }, 404);
    }

    const { data: membership, error: membershipError } = await admin
      .from("group_memberships")
      .select("group_id")
      .eq("group_id", message.group_id)
      .eq("user_id", authData.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "You do not have access to this attachment." }, 403);

    const targetTable = body.targetType === "book" ? "books" : body.targetType === "author" ? "authors" : "series";
    const { data: target, error: targetError } = await admin
      .from(targetTable)
      .select("id")
      .eq("id", body.targetId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return json({ error: "The destination item was not found." }, 404);

    const sourceUrl = sourceUrlForTarget(
      message.attachment_payload as Record<string, unknown>,
      message.attachment_type,
      body.targetType,
      body.sourceBookId,
      body.sourceAuthorName,
    );
    if (!sourceUrl) return json({ error: "This attachment has no image to copy." }, 404);

    const source = parseSourceStorageLocation(sourceUrl, supabaseUrl, body.targetType);
    const { data: image, error: downloadError } = await admin.storage.from(source.bucket).download(source.path);
    if (downloadError) throw downloadError;

    const extension = extensionForImage(source.path, image.type);
    const destinationPath = `${authData.user.id}/${body.targetId}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from(destinationBuckets[body.targetType])
      .upload(destinationPath, image, {
        contentType: image.type || `image/${extension}`,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = admin.storage.from(destinationBuckets[body.targetType]).getPublicUrl(destinationPath);
    return json({ publicUrl: urlData.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not copy the shared image.";
    return json({ error: message }, 500);
  }
});
