import { supabase } from "@/lib/supabase";

export interface CustomCollection {
  id: string;
  name: string;
  description: string | null;
}

export interface CollectionMembership {
  collection_id: string;
  book_id: string;
  position: number | null;
  added_at: string;
}

export interface CollectionBookChanges {
  orderedIds: string[];
  addedIds: string[];
  removedIds: string[];
}

const collectionFields = "id,name,description";
const membershipFields = "collection_id,book_id,position,added_at";

async function readPages<T>(read: (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: unknown;
}>): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await read(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

export async function fetchCustomCollections(userId: string, bookId?: string) {
  const [collections, memberships] = await Promise.all([
    readPages<CustomCollection>((from, to) => supabase.from("collections").select(collectionFields)
      .eq("user_id", userId).order("id").range(from, to)),
    readPages<CollectionMembership>((from, to) => {
      const query = supabase.from("collection_books").select(membershipFields);
      if (bookId) query.eq("book_id", bookId);
      return query.order("collection_id").order("book_id").range(from, to);
    }),
  ]);
  return { collections, memberships };
}

export async function saveCustomCollection(name: string, description: string, id?: string): Promise<CustomCollection> {
  const fields = { name: name.trim(), description: description.trim() || null };
  if (!fields.name || [...fields.name].length > 80) throw new Error("Enter a name between 1 and 80 characters.");
  if ([...(fields.description ?? "")].length > 500) throw new Error("Enter a description of 500 characters or fewer.");

  const table = supabase.from("collections");
  const query = id ? table.update(fields).eq("id", id) : table.insert(fields);
  const { data, error } = await query.select(collectionFields).single();
  if (error?.code === "23505") throw new Error("You already have a collection with that name.");
  if (error) throw error;
  return data;
}

export async function deleteCustomCollection(id: string) {
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw error;
}

export async function setCollectionMembership(collectionId: string, bookId: string, included: boolean) {
  const membership = { collection_id: collectionId, book_id: bookId };
  const table = supabase.from("collection_books");
  if (!included) {
    const { error } = await table.delete().match(membership);
    if (error) throw error;
    return null;
  }
  const { data, error } = await table.upsert(membership, { onConflict: "collection_id,book_id", ignoreDuplicates: true })
    .select(membershipFields).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const existing = await table.select(membershipFields).match(membership).maybeSingle();
  if (existing.error) throw existing.error;
  return existing.data;
}

export async function saveCollectionBooks(collectionId: string, changes: CollectionBookChanges) {
  const { error } = await supabase.rpc("save_collection_books", {
    target_collection: collectionId,
    ordered_books: changes.orderedIds,
    added_books: changes.addedIds,
    removed_books: changes.removedIds,
  });
  if (error) throw error;
}
