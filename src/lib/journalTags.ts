export const INTERNAL_JOURNAL_TAG_PREFIX = "__journal:";
export const GENERATED_EVENT_NOTE_TAG_PREFIX = `${INTERNAL_JOURNAL_TAG_PREFIX}generated-event:`;
export const READING_LOG_NOTE_TAG_PREFIX = `${INTERNAL_JOURNAL_TAG_PREFIX}reading-log:`;

function normalizeTagKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function isInternalJournalTag(tag: string): boolean {
  return normalizeTagKey(tag).startsWith(INTERNAL_JOURNAL_TAG_PREFIX);
}

export function normalizeJournalTags(tags: string[] | null | undefined): string[] {
  const unique = new Map<string, string>();
  (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const key = normalizeTagKey(tag);
      if (!unique.has(key)) unique.set(key, tag);
    });
  return [...unique.values()];
}

export function visibleJournalTags(tags: string[] | null | undefined): string[] {
  return normalizeJournalTags(tags).filter((tag) => !isInternalJournalTag(tag));
}
