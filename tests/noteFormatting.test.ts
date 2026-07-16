import assert from "node:assert/strict";
import test from "node:test";
import {
  noteMarkdownToEditorHtml,
  parseNoteInlineMarkdown,
  parseNoteMarkdown,
} from "../src/lib/noteFormatting";

test("parses bold and italic inline Markdown", () => {
  assert.deepEqual(parseNoteInlineMarkdown("A **bold** and *quiet* line"), [
    { type: "text", text: "A " },
    { type: "bold", children: [{ type: "text", text: "bold" }] },
    { type: "text", text: " and " },
    { type: "italic", children: [{ type: "text", text: "quiet" }] },
    { type: "text", text: " line" },
  ]);
});

test("parses quote blocks visually", () => {
  assert.deepEqual(parseNoteMarkdown("> This stayed with me."), [
    {
      type: "quote",
      children: [{ type: "text", text: "This stayed with me." }],
    },
  ]);
});

test("parses consecutive list items as one list block", () => {
  assert.deepEqual(parseNoteMarkdown("- First\n- **Second**"), [
    {
      type: "list",
      items: [
        [{ type: "text", text: "First" }],
        [{ type: "bold", children: [{ type: "text", text: "Second" }] }],
      ],
    },
  ]);
});

test("converts existing Markdown journalEntries to editor HTML", () => {
  assert.equal(
    noteMarkdownToEditorHtml("A **bold** line\n> quoted\n- listed"),
    "<p>A <strong>bold</strong> line</p><blockquote>quoted</blockquote><ul><li>listed</li></ul>",
  );
});

test("escapes raw HTML before creating editor HTML", () => {
  assert.equal(
    noteMarkdownToEditorHtml("<script>alert('x')</script>"),
    "<p>&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;</p>",
  );
});
