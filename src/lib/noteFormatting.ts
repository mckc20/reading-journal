import DOMPurify from "dompurify";
import { Marked, Renderer } from "marked";
import { isAppRelativeHref } from "@/lib/journalLinks";

export type NoteCalloutType = "note" | "idea" | "question" | "favorite" | "spoiler";

const CALLOUT_TYPES = new Set<NoteCalloutType>(["note", "idea", "question", "favorite", "spoiler"]);

const CALLOUT_ICON_MARKUP: Record<NoteCalloutType, string> = {
  note: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" x2="21" y1="3" y2="9"/><line x1="15" x2="15" y1="3" y2="9"/><line x1="15" x2="21" y1="9" y2="9"/><line x1="8" x2="16" y1="13" y2="13"/><line x1="8" x2="13" y1="17" y2="17"/>',
  idea: '<circle cx="12" cy="9" r="5"/><line x1="12" x2="12" y1="14" y2="16"/><line x1="9" x2="15" y1="18" y2="18"/><line x1="10" x2="14" y1="22" y2="22"/>',
  question: '<circle cx="12" cy="12" r="10"/><text x="12" y="13" dominant-baseline="middle" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" stroke="none">?</text>',
  favorite: '<polygon points="12 3 14.8 8.7 21 9.6 16.5 14 17.6 20.2 12 17.3 6.4 20.2 7.5 14 3 9.6 9.2 8.7 12 3"/>',
  spoiler: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
};

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function externalLinkHtml(href: string, label: string): string {
  return `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isAppRelativeHref(trimmed)) return true;

  try {
    const url = new URL(trimmed, "https://reading-journal.local");
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function titleForCallout(type: NoteCalloutType): string {
  if (type === "note") return "Note";
  if (type === "idea") return "Idea";
  if (type === "question") return "Question";
  if (type === "favorite") return "Favorite";
  return "Spoiler";
}

function iconForCallout(type: NoteCalloutType): string {
  return `<svg class="journal-callout-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CALLOUT_ICON_MARKUP[type]}</svg>`;
}

function getCalloutFromBlockquote(raw: string): { type: NoteCalloutType; markdown: string } | null {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^>\s?/, ""));
  const marker = lines[0]?.trim().match(/^\[!(note|idea|question|favorite|spoiler)\]$/i);

  if (!marker) return null;

  const type = marker[1].toLowerCase() as NoteCalloutType;
  if (!CALLOUT_TYPES.has(type)) return null;

  const contentLines = lines.slice(1);
  if (contentLines[0]?.trim() === "") contentLines.shift();

  return {
    type,
    markdown: contentLines.join("\n").trim(),
  };
}

const renderer = new Renderer();
let marked: Marked;

renderer.html = ({ text }) => escapeHtml(text);

renderer.link = function link({ href, title, tokens }) {
  const label = this.parser.parseInline(tokens);
  const normalizedHref = href.toLowerCase().startsWith("http://www.") ? `https://${href.slice("http://".length)}` : href;
  if (!isSafeUrl(normalizedHref)) return label;

  const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
  const externalAttributes = isAppRelativeHref(normalizedHref) ? "" : ' target="_blank" rel="noopener noreferrer"';
  return `<a href="${escapeAttribute(normalizedHref)}"${titleAttribute}${externalAttributes}>${label}</a>`;
};

renderer.image = function image({ text }) {
  return escapeHtml(text);
};

renderer.blockquote = function blockquote(token) {
  const callout = getCalloutFromBlockquote(token.raw);

  if (!callout) {
    return `<blockquote>${this.parser.parse(token.tokens)}</blockquote>`;
  }

  const body = callout.markdown ? renderMarkdownWithoutSanitizing(callout.markdown) : "";
  return [
    `<aside class="journal-callout journal-callout-${callout.type}" data-callout="${callout.type}">`,
    `<div class="journal-callout-title" data-callout-title="${callout.type}">${iconForCallout(callout.type)}<span>${titleForCallout(callout.type)}</span></div>`,
    body ? `<div class="journal-callout-body">${body}</div>` : "",
    "</aside>",
  ].join("");
};

marked = new Marked({
  breaks: true,
  gfm: true,
  renderer,
});

function renderMarkdownWithoutSanitizing(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

function autolinkPlainWebUrlsInText(text: string): string {
  return text.replace(
    /(^|[\s(])((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,!?;:'"])/gi,
    (match, prefix: string, rawUrl: string) => {
      const href = rawUrl.toLowerCase().startsWith("www.") ? `https://${rawUrl}` : rawUrl;
      if (!isSafeUrl(href)) return match;
      return `${prefix}${externalLinkHtml(href, rawUrl)}`;
    },
  );
}

function autolinkPlainWebUrls(html: string): string {
  const parts = html.split(/(<[^>]+>)/g);
  let anchorDepth = 0;

  return parts.map((part) => {
    if (part.startsWith("<")) {
      if (/^<a\b/i.test(part)) anchorDepth += 1;
      if (/^<\/a\b/i.test(part)) anchorDepth = Math.max(0, anchorDepth - 1);
      return part;
    }

    if (anchorDepth > 0) return part;
    return autolinkPlainWebUrlsInText(part);
  }).join("");
}

function sanitizeRenderedHtml(html: string): string {
  if (typeof window === "undefined") return html;

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a",
      "aside",
      "blockquote",
      "br",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "li",
      "ol",
      "p",
      "span",
      "svg",
      "circle",
      "line",
      "polygon",
      "rect",
      "strong",
      "text",
      "ul",
    ],
    ALLOWED_ATTR: [
      "aria-hidden",
      "class",
      "cx",
      "cy",
      "d",
      "data-callout",
      "data-callout-title",
      "dominant-baseline",
      "fill",
      "font-size",
      "font-weight",
      "href",
      "height",
      "points",
      "r",
      "rel",
      "rx",
      "stroke",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-width",
      "target",
      "text-anchor",
      "title",
      "viewBox",
      "width",
      "x",
      "x1",
      "x2",
      "y",
      "y1",
      "y2",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });
}

export function renderNoteMarkdownToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";

  return sanitizeRenderedHtml(autolinkPlainWebUrls(renderMarkdownWithoutSanitizing(normalized)));
}

export function noteMarkdownToEditorHtml(markdown: string): string {
  return renderNoteMarkdownToHtml(markdown);
}
