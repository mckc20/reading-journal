import { supabase } from "@/lib/supabase";
import type { Genre } from "@/types";

export * from "@/lib/genreTree";

export async function fetchGenres(): Promise<Genre[]> {
  const { data, error } = await supabase
    .from("genres")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Genre[];
}
