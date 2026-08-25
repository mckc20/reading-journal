import assert from "node:assert/strict";
import test from "node:test";
import { renderNoteMarkdownToHtml } from "../src/lib/noteFormatting";

test("renders common Markdown journal formatting", () => {
  const html = renderNoteMarkdownToHtml("# Title\n\nA **bold** and *quiet* line\n\n- First\n- Second\n\n1. One\n2. Two\n\n---");

  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>quiet<\/em>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<hr>/);
});

test("renders links that open in a new tab", () => {
  assert.match(
    renderNoteMarkdownToHtml("[OpenAI](https://openai.com)"),
    /<a href="https:\/\/openai\.com" target="_blank" rel="noopener noreferrer">OpenAI<\/a>/,
  );
});

test("renders internal journal links in the current tab", () => {
  assert.match(
    renderNoteMarkdownToHtml("[Earlier thought](/books/book-1/journal?entry=entry-1)"),
    /<a href="\/books\/book-1\/journal\?entry=entry-1">Earlier thought<\/a>/,
  );
});

test("auto-links raw web URLs", () => {
  assert.match(
    renderNoteMarkdownToHtml("Visit https://example.com now"),
    /<a href="https:\/\/example\.com" target="_blank" rel="noopener noreferrer">https:\/\/example\.com<\/a>/,
  );
});

test("auto-links common www web URLs", () => {
  assert.match(
    renderNoteMarkdownToHtml("Visit www.example.com now"),
    /<a href="https:\/\/www\.example\.com" target="_blank" rel="noopener noreferrer">www\.example\.com<\/a>/,
  );
});

test("does not double-link URLs inside explicit markdown links", () => {
  assert.equal(
    renderNoteMarkdownToHtml("[www.example.com](https://example.com)").trim(),
    '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">www.example.com</a></p>',
  );
});

test("removes unsafe link targets", () => {
  assert.equal(renderNoteMarkdownToHtml("[bad](javascript:alert(1))").trim(), "<p>bad</p>");
});

test("renders custom reading journal callouts", () => {
  const html = renderNoteMarkdownToHtml("> [!favorite]\n> This mattered.");

  assert.match(html, /journal-callout journal-callout-favorite/);
  assert.match(html, /data-callout="favorite"/);
  assert.match(html, /journal-callout-icon/);
  assert.match(html, /Favorite/);
  assert.match(html, /This mattered\./);
});

test("renders callout icons without svg path elements", () => {
  const html = renderNoteMarkdownToHtml([
    "> [!note]\n> Hi",
    "> [!idea]\n> Hi",
    "> [!question]\n> Hi",
    "> [!favorite]\n> Hi",
    "> [!spoiler]\n> Hi",
  ].join("\n\n"));

  assert.equal(html.match(/journal-callout-icon/g)?.length, 5);
  assert.doesNotMatch(html, /<path\b/);
  assert.match(html, /<rect\b/);
  assert.match(html, /<polygon\b/);
  assert.match(html, /<text\b[^>]*>\?<\/text>/);
});

test("keeps plain text entries backwards compatible", () => {
  assert.equal(renderNoteMarkdownToHtml("A plain journal entry.").trim(), "<p>A plain journal entry.</p>");
});

test("escapes raw HTML before rendering", () => {
  assert.equal(
    renderNoteMarkdownToHtml("<script>alert('x')</script>").trim(),
    "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
  );
});
