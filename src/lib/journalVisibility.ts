import type { JournalEntityType, JournalEntrySource, JournalEntryVisibility } from "@/types";

export interface JournalVisibilityKey {
  entityType: JournalEntityType;
  entityId: string;
  source: JournalEntrySource;
  sourceId: string;
}

export function getJournalVisibilityKey(key: JournalVisibilityKey): string {
  return [key.entityType, key.entityId, key.source, key.sourceId].join(":");
}

export function getHiddenJournalEntryKeys(hiddenEntries: JournalEntryVisibility[]): Set<string> {
  return new Set(
    hiddenEntries.map((entry) =>
      getJournalVisibilityKey({
        entityType: entry.entity_type,
        entityId: entry.entity_id,
        source: entry.source,
        sourceId: entry.source_id,
      }),
    ),
  );
}

export async function fetchHiddenJournalEntries(
  entityType: JournalEntityType,
  entityId: string,
): Promise<JournalEntryVisibility[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("journal_entry_visibility")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) throw new Error(error.message);
  return (data ?? []) as JournalEntryVisibility[];
}

export async function hideJournalEntry(
  input: JournalVisibilityKey & { userId: string },
): Promise<JournalEntryVisibility> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase
    .from("journal_entry_visibility")
    .upsert(
      {
        user_id: input.userId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        source: input.source,
        source_id: input.sourceId,
        hidden_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entity_type,entity_id,source,source_id" },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as JournalEntryVisibility;
}

export async function restoreJournalEntry(input: JournalVisibilityKey): Promise<void> {
  const { supabase } = await import("./supabase");
  const { error } = await supabase
    .from("journal_entry_visibility")
    .delete()
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .eq("source", input.source)
    .eq("source_id", input.sourceId);

  if (error) throw new Error(error.message);
}
