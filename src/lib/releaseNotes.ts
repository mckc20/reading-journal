import changelogMarkdown from "@/content/changelog.md?raw";
import {
  formatReleaseNoteDate,
  isUnreadReleaseNote,
  parseChangelogMarkdown,
  type ReleaseNote,
  type ReleaseNoteHighlight,
} from "@/lib/changelog";

const CHANGELOG_ENTRIES = parseChangelogMarkdown(changelogMarkdown);

export type { ReleaseNote, ReleaseNoteHighlight };

export function getChangelogEntries(): ReleaseNote[] {
  return [...CHANGELOG_ENTRIES];
}

export function getLatestReleaseNote(): ReleaseNote {
  const [latestReleaseNote] = CHANGELOG_ENTRIES;
  if (!latestReleaseNote) {
    throw new Error("Changelog is empty.");
  }

  return latestReleaseNote;
}

export function hasUnreadReleaseNote(lastSeenVersion?: string | null): boolean {
  return isUnreadReleaseNote(lastSeenVersion, getLatestReleaseNote().version);
}

export { formatReleaseNoteDate };
