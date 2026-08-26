export interface JournalLinkTarget {
  id: string;
  publicId: string;
  label: string;
  description: string;
  href: string;
}

export interface MarkdownLinkRange {
  start: number;
  end: number;
  textStart: number;
  textEnd: number;
  hrefStart: number;
  hrefEnd: number;
  text: string;
  href: string;
}

export function isAppRelativeHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function isInternalJournalHref(href: string): boolean {
  if (isInternalJournalProtocolHref(href)) return true;
  if (!isAppRelativeHref(href)) return false;

  try {
    const url = new URL(href, "https://reading-journal.local");
    return /^\/journal\/[^/]+$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function isInternalJournalProtocolHref(href: string): boolean {
  return /^journal:\/\/entry\/[A-Za-z0-9_-]+$/.test(href.trim());
}

export function journalPublicIdFromHref(href: string): string | null {
  const trimmed = href.trim();
  const protocolMatch = trimmed.match(/^journal:\/\/entry\/([A-Za-z0-9_-]+)$/);
  if (protocolMatch) return protocolMatch[1];

  try {
    const url = new URL(trimmed, "https://reading-journal.local");
    const pathMatch = url.pathname.match(/^\/journal\/([A-Za-z0-9_-]+)$/);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}

export function journalHrefForPublicId(publicId: string): string {
  return `journal://entry/${publicId}`;
}

export function journalRouteForPublicId(publicId: string): string {
  return `/journal/${encodeURIComponent(publicId)}`;
}

export function extractJournalEntryPublicIds(markdown: string): string[] {
  const ids = new Set<string>();
  const linkPattern = /\[[^\]\n]+]\(([^)\s]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(markdown)) !== null) {
    const publicId = journalPublicIdFromHref(match[1]);
    if (publicId) ids.add(publicId);
  }

  return [...ids];
}

export function escapeMarkdownLinkText(value: string): string {
  return value.replace(/[\\[\]]/g, "\\$&");
}

export function findMarkdownLinkAtSelection(markdown: string, selectionStart: number, selectionEnd = selectionStart): MarkdownLinkRange | null {
  const linkPattern = /\[([^\]\n]+)]\(([^)\s]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(markdown)) !== null) {
    const fullMatch = match[0];
    const text = match[1];
    const href = match[2];
    const start = match.index;
    const end = start + fullMatch.length;
    const textStart = start + 1;
    const textEnd = textStart + text.length;
    const hrefStart = textEnd + 2;
    const hrefEnd = hrefStart + href.length;
    const cursorTouchesLink = selectionStart >= start && selectionEnd <= end;

    if (cursorTouchesLink) {
      return { start, end, textStart, textEnd, hrefStart, hrefEnd, text, href };
    }
  }

  return null;
}

export function applyJournalEntryLinkToMarkdown(markdown: string, selectionStart: number, selectionEnd: number, target: JournalLinkTarget): {
  markdown: string;
  selection: { start: number; end: number };
} {
  const selectedText = markdown.slice(selectionStart, selectionEnd);
  const label = escapeMarkdownLinkText(selectedText || target.label);
  const nextText = `[${label}](${target.href})`;
  const nextMarkdown = markdown.slice(0, selectionStart) + nextText + markdown.slice(selectionEnd);
  const cursor = selectionStart + nextText.length;

  return {
    markdown: nextMarkdown,
    selection: { start: cursor, end: cursor },
  };
}

export function removeMarkdownLink(markdown: string, link: MarkdownLinkRange): {
  markdown: string;
  selection: { start: number; end: number };
} {
  const nextMarkdown = markdown.slice(0, link.start) + link.text + markdown.slice(link.end);
  const cursor = link.start + link.text.length;

  return {
    markdown: nextMarkdown,
    selection: { start: cursor, end: cursor },
  };
}
