import type { BookMetadataSource } from "@/types";
import { supabase } from "@/lib/supabase";

export interface SeriesVolumeRejection {
  series_id: string;
  candidate_key: string;
}

export async function fetchSeriesVolumeRejections(userId: string): Promise<SeriesVolumeRejection[]> {
  const { data, error } = await supabase
    .from("series_volume_rejections")
    .select("series_id,candidate_key")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function rejectSeriesVolumeCandidate(input: {
  userId: string;
  seriesId: string;
  candidateKey: string;
  title: string;
  source: BookMetadataSource;
}): Promise<void> {
  const { error } = await supabase.from("series_volume_rejections").insert({
    user_id: input.userId,
    series_id: input.seriesId,
    candidate_key: input.candidateKey,
    title: input.title,
    source: input.source,
  });
  if (error) throw error;
}
