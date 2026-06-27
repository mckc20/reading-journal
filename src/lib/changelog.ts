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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripInlineCode(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseVersionLine(value: string): string {
  return stripInlineCode(value.replace(/^Version:\s*/i, ""));
}

function parseSummaryLine(value: string): string {
  return normalizeWhitespace(value.replace(/^Summary:\s*/i, ""));
}

function parseEntryHeading(value: string): { published_at: string; title: string } | null {
  const match = value.match(/^##\s+(\d{4}-\d{2}-\d{2})\s+-\s+(.+)$/);
  if (!match) return null;

  return {
    published_at: match[1],
    title: match[2].trim(),
  };
}

export function parseChangelogMarkdown(markdown: string): ReleaseNote[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const entries: ReleaseNote[] = [];
  let index = 0;

  while (index < lines.length) {
    const heading = parseEntryHeading(lines[index].trim());
    if (!heading) {
      index += 1;
      continue;
    }

    index += 1;

    while (index < lines.length && !lines[index].trim()) index += 1;

    let version = "";
    if (index < lines.length && /^Version:\s*/i.test(lines[index].trim())) {
      version = parseVersionLine(lines[index]);
      index += 1;
    }

    while (index < lines.length && !lines[index].trim()) index += 1;

    const summaryLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      const trimmed = current.trim();

      if (!trimmed) {
        if (summaryLines.length > 0) {
          index += 1;
          break;
        }

        index += 1;
        continue;
      }

      if (trimmed.startsWith("## ")) break;
      if (trimmed.startsWith("- ")) break;
      if (/^Version:\s*/i.test(trimmed)) {
        index += 1;
        continue;
      }

      summaryLines.push(
        /^Summary:\s*/i.test(trimmed) ? parseSummaryLine(trimmed) : normalizeWhitespace(trimmed),
      );
      index += 1;
    }

    const highlights: ReleaseNoteHighlight[] = [];
    while (index < lines.length) {
      const current = lines[index];
      const trimmed = current.trim();

      if (trimmed.startsWith("## ")) break;
      if (!trimmed) {
        index += 1;
        continue;
      }

      if (trimmed.startsWith("- ")) {
        const bulletTitle = normalizeWhitespace(trimmed.slice(2));
        index += 1;

        const descriptionLines: string[] = [];
        while (index < lines.length) {
          const nextLine = lines[index];
          const nextTrimmed = nextLine.trim();

          if (nextTrimmed.startsWith("## ") || nextTrimmed.startsWith("- ")) break;
          if (!nextTrimmed) {
            index += 1;
            if (descriptionLines.length > 0) break;
            continue;
          }

          if (/^\s+/.test(nextLine)) {
            descriptionLines.push(nextTrimmed);
            index += 1;
            continue;
          }

          break;
        }

        const [inlineTitle, inlineDescription = ""] = bulletTitle.split(/\s+[—-]\s+/, 2);
        highlights.push({
          title: normalizeWhitespace(inlineTitle),
          description: normalizeWhitespace(
            descriptionLines.length > 0 ? descriptionLines.join(" ") : inlineDescription || inlineTitle,
          ),
        });
        continue;
      }

      index += 1;
    }

    const summary = normalizeWhitespace(summaryLines.join(" "));
    const versionFallback = `${heading.published_at}-${slugify(heading.title)}`;

    entries.push({
      version: version || versionFallback,
      published_at: heading.published_at,
      title: heading.title,
      summary: summary || heading.title,
      highlights,
    });
  }

  return entries;
}

export function isUnreadReleaseNote(
  lastSeenVersion: string | null | undefined,
  latestVersion: string,
): boolean {
  return lastSeenVersion !== latestVersion;
}

export function formatReleaseNoteDate(publishedAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${publishedAt}T00:00:00Z`));
}
