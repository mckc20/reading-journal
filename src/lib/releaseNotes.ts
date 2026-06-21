export type ReleaseNoteHighlight = {
  title: string;
  description: string;
};

export type ReleaseNote = {
  version: string;
  published_at: string;
  title: string;
  summary: string;
  highlights: ReleaseNoteHighlight[];
};

export const CURRENT_RELEASE_NOTE: ReleaseNote = {
  version: "2026-06-21-chat-groups",
  published_at: "2026-06-21",
  title: "Chat and groups are here",
  summary:
    "You can now chat with other readers and organize conversations into groups.",
  highlights: [
    {
      title: "Direct chats and groups",
      description:
        "Start one-to-one conversations or create group spaces for reading clubs and friends.",
    },
    {
      title: "Attachments and library saves",
      description:
        "Share books, notes, authors, and series in chat, then save shared items to your own library.",
    },
  ],
};

export function getLatestReleaseNote(): ReleaseNote {
  return CURRENT_RELEASE_NOTE;
}

export function hasUnreadReleaseNote(lastSeenVersion?: string | null): boolean {
  return lastSeenVersion !== CURRENT_RELEASE_NOTE.version;
}

export function formatReleaseNoteDate(publishedAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${publishedAt}T00:00:00Z`));
}
