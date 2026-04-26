/**
 * Fill metadata_source and metadata_source_url for existing books with ISBNs.
 *
 * Usage:
 *   npm run backfill:metadata-source
 *
 * Prerequisites:
 *   - VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env
 *   - Run the metadata source database migration first
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { fetchBookMetadataByISBN } from "../src/lib/bookLookup";

interface BookRow {
  id: string;
  isbn: string | null;
  metadata_source_url: string | null;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing env vars. Ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env",
  );
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data, error } = await adminClient
  .from("books")
  .select("id,isbn,metadata_source_url")
  .is("metadata_source_url", null);

if (error) {
  console.error("Failed to fetch books:", error.message);
  process.exit(1);
}

const stats = {
  updated: 0,
  skippedNoIsbn: 0,
  notFound: 0,
  failed: 0,
};

for (const book of (data ?? []) as BookRow[]) {
  const isbn = book.isbn?.trim();
  if (!isbn) {
    stats.skippedNoIsbn += 1;
    continue;
  }

  try {
    const metadata = await fetchBookMetadataByISBN(isbn);
    if (!metadata) {
      stats.notFound += 1;
      console.warn(`No metadata found for book ${book.id} (ISBN ${isbn})`);
      continue;
    }

    const { error: updateError } = await adminClient
      .from("books")
      .update({
        metadata_source: metadata.metadataSource,
        metadata_source_url: metadata.metadataSourceUrl,
      })
      .eq("id", book.id);

    if (updateError) {
      stats.failed += 1;
      console.error(`Failed to update book ${book.id}:`, updateError.message);
      continue;
    }

    stats.updated += 1;
  } catch (err) {
    stats.failed += 1;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to look up book ${book.id} (ISBN ${isbn}):`, message);
  }
}

console.log("Metadata source backfill complete.");
console.log(`Updated: ${stats.updated}`);
console.log(`Skipped without ISBN: ${stats.skippedNoIsbn}`);
console.log(`Not found: ${stats.notFound}`);
console.log(`Failed: ${stats.failed}`);
