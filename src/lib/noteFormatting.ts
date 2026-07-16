import DOMPurify from "dompurify";
import { Marked, Renderer } from "marked";

export type NoteCalloutType = "note" | "idea" | "question" | "favorite" | "spoiler";

const CALLOUT_TYPES = new Set<NoteCalloutType>(["note", "idea", "question", "favorite", "spoiler"]);

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
    `<div class="journal-callout-title" data-callout-title="${callout.type}">${titleForCallout(callout.type)}</div>`,
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
      "strong",
      "ul",
    ],
    ALLOWED_ATTR: ["class", "data-callout", "data-callout-title", "href", "rel", "target", "title"],
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
