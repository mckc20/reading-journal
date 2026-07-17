import DOMPurify from "dompurify";
import { Marked, Renderer } from "marked";

export type NoteCalloutType = "note" | "idea" | "question" | "favorite" | "spoiler";

const CALLOUT_TYPES = new Set<NoteCalloutType>(["note", "idea", "question", "favorite", "spoiler"]);

const CALLOUT_ICON_PATHS: Record<NoteCalloutType, string> = {
  note: '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  idea: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  question: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.7 1.5-2.4 2.2-.5.5-.5 1.1-.5 1.8"/><path d="M12 17h.01"/>',
  favorite: '<path d="M11.5 2.6a.5.5 0 0 1 .9 0l2.6 5.3a1 1 0 0 0 .7.5l5.8.8a.5.5 0 0 1 .3.9l-4.2 4.1a1 1 0 0 0-.3.9l1 5.7a.5.5 0 0 1-.7.5l-5.2-2.7a1 1 0 0 0-.9 0l-5.2 2.7a.5.5 0 0 1-.7-.5l1-5.7a1 1 0 0 0-.3-.9L2.2 10a.5.5 0 0 1 .3-.9l5.8-.8a1 1 0 0 0 .7-.5z"/>',
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

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

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
  return `<svg class="journal-callout-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CALLOUT_ICON_PATHS[type]}</svg>`;
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
  if (!isSafeUrl(href)) return label;

  const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
  return `<a href="${escapeAttribute(href)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${label}</a>`;
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
      "path",
      "circle",
      "line",
      "strong",
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
      "fill",
      "href",
      "r",
      "rel",
      "stroke",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-width",
      "target",
      "title",
      "viewBox",
      "x1",
      "x2",
      "y1",
      "y2",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });
}

export function renderNoteMarkdownToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";

  return sanitizeRenderedHtml(renderMarkdownWithoutSanitizing(normalized));
}

export function noteMarkdownToEditorHtml(markdown: string): string {
  return renderNoteMarkdownToHtml(markdown);
}
