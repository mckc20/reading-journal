export interface JournalLinkTarget {
  id: string;
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
  if (!isAppRelativeHref(href)) return false;

  try {
    const url = new URL(href, "https://reading-journal.local");
    return (
      /^\/books\/[^/]+\/journal$/.test(url.pathname) ||
      /^\/series\/[^/]+\/journal$/.test(url.pathname) ||
      /^\/authors\/[^/]+\/journal$/.test(url.pathname)
    ) && Boolean(url.searchParams.get("entry"));
  } catch {
    return false;
  }
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
