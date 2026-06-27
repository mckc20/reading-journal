import { supabase } from "@/lib/supabase";
import { normalizeGenreName } from "@/lib/genreTree";
import type { Genre } from "@/types";

export * from "@/lib/genreTree";

export type GenreInput = {
  name: string;
  parent_id?: string | null;
  description?: string | null;
};

export async function fetchGenres(): Promise<Genre[]> {
  const { data, error } = await supabase
    .from("genres")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Genre[];
}

export async function createGenre(userId: string, input: GenreInput): Promise<Genre> {
  const name = normalizeGenreName(input.name);
  if (!name) throw new Error("Genre name is required.");

  const { data, error } = await supabase
    .from("genres")
    .insert({
      name,
      parent_id: input.parent_id ?? null,
      description: input.description?.trim() || null,
      user_id: userId,
      is_system: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Genre;
}

export async function updateGenre(id: string, input: GenreInput): Promise<Genre> {
  const name = normalizeGenreName(input.name);
  if (!name) throw new Error("Genre name is required.");

  const { data, error } = await supabase
    .from("genres")
    .update({
      name,
      parent_id: input.parent_id ?? null,
      description: input.description?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Genre;
}

export async function deleteGenre(id: string): Promise<void> {
  const { error } = await supabase.from("genres").delete().eq("id", id);
  if (error) throw error;
}
