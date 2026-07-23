import assert from "node:assert/strict";
import test from "node:test";
import {
  JOURNAL_MEDIA_MAX_FILE_SIZE_BYTES,
  journalParagraphCount,
  normalizeJournalMediaCaption,
  nextJournalMediaPosition,
  removeLegacyJournalMediaReferences,
  sourceForJournalEntryRecord,
  splitMarkdownIntoJournalBlocks,
  validateJournalImageFile,
} from "../src/lib/journalMedia";

test("validateJournalImageFile accepts supported image types under the size limit", () => {
  assert.doesNotThrow(() => validateJournalImageFile({
    name: "reading-spot.webp",
    type: "image/webp",
    size: JOURNAL_MEDIA_MAX_FILE_SIZE_BYTES,
  }));
});

test("validateJournalImageFile rejects unsupported file types", () => {
  assert.throws(
    () => validateJournalImageFile({ name: "notes.pdf", type: "application/pdf", size: 100 }),
    /JPG, PNG, or WebP/,
  );
});

test("validateJournalImageFile rejects oversized images", () => {
  assert.throws(
    () => validateJournalImageFile({
      name: "large.jpg",
      type: "image/jpeg",
      size: JOURNAL_MEDIA_MAX_FILE_SIZE_BYTES + 1,
    }),
    /10 MB/,
  );
});

test("normalizeJournalMediaCaption trims empty captions to null", () => {
  assert.equal(normalizeJournalMediaCaption("  Summer reading  "), "Summer reading");
  assert.equal(normalizeJournalMediaCaption("   "), null);
  assert.equal(normalizeJournalMediaCaption(null), null);
});

test("journal paragraph helpers count paragraphs and choose the last paragraph for new media", () => {
  assert.equal(journalParagraphCount("One\n\nTwo\n\n\nThree"), 3);
  assert.equal(journalParagraphCount("   "), 0);
  assert.equal(nextJournalMediaPosition("One\n\nTwo"), 2);
  assert.equal(nextJournalMediaPosition("   "), 1);
});

test("removeLegacyJournalMediaReferences strips old internal markdown image tokens", () => {
  assert.equal(
    removeLegacyJournalMediaReferences("Before\n\n![One](journal-media:media-1)\n\nAfter\n\n\\![Two]( journal-media:media-2 )"),
    "Before\n\nAfter",
  );
});

test("splitMarkdownIntoJournalBlocks places media after their assigned paragraph", () => {
  const media = [
    { id: "media-2", position: 2, created_at: "2026-01-02T00:00:00Z" },
    { id: "media-1", position: 1, created_at: "2026-01-01T00:00:00Z" },
  ];
  const blocks = splitMarkdownIntoJournalBlocks(
    "First paragraph.\n\nSecond paragraph.",
    media as never,
  );

  assert.deepEqual(blocks.map((block) => ({
    markdown: block.markdown,
    mediaIds: block.media.map((item) => item.id),
  })), [
    { markdown: "First paragraph.", mediaIds: ["media-1"] },
    { markdown: "Second paragraph.", mediaIds: ["media-2"] },
  ]);
});

test("sourceForJournalEntryRecord maps journal records to media sources", () => {
  assert.equal(sourceForJournalEntryRecord({ book_id: "book-1" }), "book_note");
  assert.equal(sourceForJournalEntryRecord({ series_id: "series-1" }), "series_note");
  assert.equal(sourceForJournalEntryRecord({ author_id: "author-1" }), "author_note");
});
