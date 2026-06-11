import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bold,
  Heart,
  Italic,
  List,
  MessageSquarePlus,
  Pencil,
  Quote,
  RefreshCw,
  Trash2,
} from "lucide-react";
import FormattedNoteContent from "@/components/FormattedNoteContent";
import QuoteBlock from "@/components/QuoteBlock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context";
import {
  createBookNote,
  deleteBookNote,
  fetchBookNotes,
  formatBookNotePageRange,
  sortBookNotes,
  updateBookNote,
  updateBookNoteFavorite,
} from "@/lib/bookNotes";
import {
  noteMarkdownToEditorHtml,
} from "@/lib/noteFormatting";
import { cn } from "@/lib/utils";
import type { Book, BookNote, BookNoteLabel } from "@/types";

interface BookNotesPanelProps {
  book: Book;
  initialComposerOpen?: boolean;
}

const NOTE_LABELS: BookNoteLabel[] = ["quote", "review", "note"];

const LABEL_STYLES: Record<BookNoteLabel, string> = {
  quote: "border-quote/25 bg-quote/10 text-quote",
  review:
    "border-insight/25 bg-insight/10 text-insight",
  note: "border-note/25 bg-note/10 text-note",
};

function formatNoteDate(value: string): string {
  const dateValue = value.includes("T") ? value : `${value}T00:00:00`;

  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTodayLocalDate(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function labelText(label: BookNoteLabel): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function inlineNodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\u00a0/g, " ");
  }

  if (!(node instanceof HTMLElement)) return "";

  const children = Array.from(node.childNodes).map(inlineNodeToMarkdown).join("");
  const tagName = node.tagName.toLowerCase();

  if (tagName === "br") return "\n";
  if (tagName === "strong" || tagName === "b") return `**${children}**`;
  if (tagName === "em" || tagName === "i") return `*${children}*`;
  return children;
}

function blockNodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return inlineNodeToMarkdown(node);
  if (!(node instanceof HTMLElement)) return "";

  const tagName = node.tagName.toLowerCase();

  if (tagName === "blockquote") {
    const quote = Array.from(node.childNodes).map(inlineNodeToMarkdown).join("").trim();
    if (!quote) return "";
    return quote
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (tagName === "ul" || tagName === "ol") {
    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child) => Array.from(child.childNodes).map(inlineNodeToMarkdown).join("").trim())
      .filter((item) => item)
      .map((item) => `- ${item}`)
      .join("\n");
  }

  if (tagName === "div" || tagName === "p") {
    return Array.from(node.childNodes).map(inlineNodeToMarkdown).join("").trim();
  }

  return Array.from(node.childNodes).map(inlineNodeToMarkdown).join("").trim();
}

function editorHtmlToMarkdown(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;

  return Array.from(container.childNodes)
    .map(blockNodeToMarkdown)
    .filter((block) => block.trim())
    .join("\n")
    .trim();
}

function CollapsibleNoteContent({
  markdown,
  className,
  footerLeft,
  footerRight,
}: {
  markdown: string;
  className?: string;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canCollapse, setCanCollapse] = useState(false);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const checkOverflow = () => {
      setCanCollapse(content.scrollHeight > 145);
    };

    checkOverflow();
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [markdown, isExpanded]);

  return (
    <div>
      <div
        ref={contentRef}
        className={cn(
          "overflow-hidden transition-[max-height]",
          isExpanded ? "max-h-none" : "max-h-36",
        )}
      >
        <FormattedNoteContent markdown={markdown} className={className} />
      </div>
      {(canCollapse || footerLeft || footerRight) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {footerLeft}
            {canCollapse && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-7 px-0"
                onClick={() => setIsExpanded((current) => !current)}
              >
                {isExpanded ? "Show less" : "Show more"}
              </Button>
            )}
          </div>
          {footerRight}
        </div>
      )}
    </div>
  );
}

export default function BookNotesPanel({ book, initialComposerOpen = false }: BookNotesPanelProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<BookNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isComposerOpen, setIsComposerOpen] = useState(initialComposerOpen);
  const [label, setLabel] = useState<BookNoteLabel>("note");
  const [title, setTitle] = useState("");
  const [quoteSpeaker, setQuoteSpeaker] = useState("");
  const [content, setContent] = useState("");
  const [pageStart, setPageStart] = useState("");
  const [noteDate, setNoteDate] = useState(getTodayLocalDate());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  async function loadNotes() {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await fetchBookNotes(book.id);
      setNotes(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await fetchBookNotes(book.id);
        if (!cancelled) setNotes(data);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to load notes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [book.id]);

  function resetComposer() {
    setLabel("note");
    setTitle("");
    setQuoteSpeaker("");
    setContent("");
    setPageStart("");
    setNoteDate(getTodayLocalDate());
    setEditingNoteId(null);
  }

  function closeComposer() {
    setIsComposerOpen(false);
    resetComposer();
  }

  function syncEditorFromMarkdown(markdown: string) {
    window.requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.innerHTML = noteMarkdownToEditorHtml(markdown);
      editorRef.current.focus();
    });
  }

  function openCreateComposer() {
    setErrorMsg(null);
    resetComposer();
    setIsComposerOpen(true);
    syncEditorFromMarkdown("");
  }

  function openEditComposer(note: BookNote) {
    setErrorMsg(null);
    setEditingNoteId(note.id);
    setLabel(note.label);
    setTitle(note.title ?? "");
    setQuoteSpeaker(note.quote_speaker ?? "");
    setContent(note.content);
    setPageStart(note.page_start ? String(note.page_start) : "");
    setNoteDate(note.note_date ?? getTodayLocalDate());
    setIsComposerOpen(true);
    syncEditorFromMarkdown(note.content);
  }

  function syncMarkdownFromEditor() {
    if (!editorRef.current) return;
    setContent(editorHtmlToMarkdown(editorRef.current.innerHTML));
  }

  function runEditorCommand(command: "bold" | "italic" | "formatBlock" | "insertUnorderedList") {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    if (command === "formatBlock") {
      document.execCommand(command, false, "blockquote");
    } else {
      document.execCommand(command);
    }

    window.requestAnimationFrame(() => {
      syncMarkdownFromEditor();
    });
  }

  async function handleSave() {
    const editorContent = editorRef.current
      ? editorHtmlToMarkdown(editorRef.current.innerHTML)
      : content;
    if (!user || !editorContent.trim()) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      if (editingNoteId) {
        const note = await updateBookNote({
          noteId: editingNoteId,
          label,
          title: label === "quote" ? "" : title,
          quoteSpeaker: label === "quote" ? quoteSpeaker : "",
          content: editorContent,
          pageStart,
          noteDate,
          isFavorite: notes.find((note) => note.id === editingNoteId)?.is_favorite,
        });
        setNotes((current) =>
          sortBookNotes(
            current.map((currentNote) =>
              currentNote.id === editingNoteId ? note : currentNote,
            ),
          ),
        );
      } else {
        const note = await createBookNote({
          bookId: book.id,
          userId: user.id,
          label,
          title: label === "quote" ? "" : title,
          quoteSpeaker: label === "quote" ? quoteSpeaker : "",
          content: editorContent,
          pageStart,
          noteDate,
        });
        setNotes((current) => sortBookNotes([note, ...current]));
      }
      closeComposer();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingNoteId || deleting) return;

    const shouldDelete = window.confirm("Delete this note? This cannot be undone.");
    if (!shouldDelete) return;

    try {
      setDeleting(true);
      setErrorMsg(null);
      await deleteBookNote(editingNoteId);
      setNotes((current) =>
        current.filter((currentNote) => currentNote.id !== editingNoteId),
      );
      closeComposer();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete note");
    } finally {
      setDeleting(false);
    }
  }

  async function toggleQuoteFavorite(note: BookNote) {
    if (note.label !== "quote") return;

    const next = !note.is_favorite;
    setNotes((current) =>
      current.map((currentNote) =>
        currentNote.id === note.id ? { ...currentNote, is_favorite: next } : currentNote,
      ),
    );

    try {
      setErrorMsg(null);
      const updatedNote = await updateBookNoteFavorite(note.id, next);
      setNotes((current) =>
        current.map((currentNote) =>
          currentNote.id === note.id ? updatedNote : currentNote,
        ),
      );
    } catch (err) {
      setNotes((current) =>
        current.map((currentNote) =>
          currentNote.id === note.id ? { ...currentNote, is_favorite: note.is_favorite } : currentNote,
        ),
      );
      setErrorMsg(err instanceof Error ? err.message : "Failed to update favorite");
    }
  }

  function renderComposer(className = "mb-4") {
    return (
      <div className={cn("rounded-lg border bg-muted/20", className)}>
        {label !== "quote" && (
          <div className="border-b p-3">
            <Label htmlFor="note-title" className="sr-only">
              Title
            </Label>
            <Input
              id="note-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title"
              className="border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0"
            />
          </div>
        )}

        {label === "quote" && (
          <div className="border-b p-3">
            <Label htmlFor="note-quote-speaker" className="sr-only">
              Quote speaker
            </Label>
            <Input
              id="note-quote-speaker"
              value={quoteSpeaker}
              onChange={(event) => setQuoteSpeaker(event.target.value)}
              placeholder="Who said this?"
              className="border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 border-b p-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bold"
            title="Bold"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runEditorCommand("bold")}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Italic"
            title="Italic"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runEditorCommand("italic")}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Quote"
            title="Quote"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runEditorCommand("formatBlock")}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="List"
            title="List"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runEditorCommand("insertUnorderedList")}
          >
            <List className="h-4 w-4" />
          </Button>

          <div className="ml-1 h-5 w-px bg-border" />

          <div className="flex flex-wrap gap-1">
            {NOTE_LABELS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setLabel(option);
                  if (option === "quote") setTitle("");
                  if (option !== "quote") setQuoteSpeaker("");
                }}
                className={cn(
                  "h-7 rounded-lg border px-2 text-xs font-medium transition-colors",
                  label === option
                    ? LABEL_STYLES[option]
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {labelText(option)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="note-page-start" className="text-xs">
                Page
              </Label>
              <Input
                id="note-page-start"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={pageStart}
                onChange={(event) => setPageStart(event.target.value)}
                placeholder="42"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-date" className="text-xs">
                Date
              </Label>
              <Input
                id="note-date"
                type="date"
                value={noteDate}
                onChange={(event) => setNoteDate(event.target.value)}
              />
            </div>
          </div>
          <Label htmlFor="note-content" className="sr-only">
            Note content
          </Label>
          <div
            id="note-content"
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write your note..."
            onInput={syncMarkdownFromEditor}
            onBlur={syncMarkdownFromEditor}
            className="min-h-40 rounded-md border-0 bg-transparent px-0 py-2 text-sm leading-6 shadow-none outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:ring-0 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3">
          <div>
            {editingNoteId && (
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                aria-label="Delete note"
                title="Delete note"
                disabled={saving || deleting}
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || deleting}
              onClick={closeComposer}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || deleting || !content.trim()}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-heading leading-snug font-medium">Notes</h2>
          <p className="text-xs text-muted-foreground">
            Keep quotes, reviews, and reading notes for this book.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={saving || deleting}
          onClick={openCreateComposer}
        >
          <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
          Add entry
        </Button>
      </div>

      {isComposerOpen && !editingNoteId && renderComposer()}

      {errorMsg && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p>{errorMsg}</p>
          {!isComposerOpen && (
            <Button type="button" variant="outline" size="sm" onClick={loadNotes}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No notes yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const pageRangeLabel = formatBookNotePageRange(note);
            const visibleDate = note.note_date ?? note.created_at;

            if (editingNoteId === note.id) {
              return <div key={note.id}>{renderComposer("mb-0")}</div>;
            }

            if (note.label === "quote") {
              return (
                <article
                  key={note.id}
                  className="relative rounded-lg border bg-background p-3 dark:bg-card"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit quote"
                    title="Edit quote"
                    className="absolute bottom-2 right-3 text-muted-foreground hover:text-foreground"
                    disabled={saving || deleting}
                    onClick={() => openEditComposer(note)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <div className="absolute right-3 top-3 flex items-center gap-1 bg-background pl-2 dark:bg-card">
                    <button
                      type="button"
                      onClick={() => toggleQuoteFavorite(note)}
                      aria-label={note.is_favorite ? "Remove from favorites" : "Add to favorites"}
                      className="rounded p-0.5 transition-colors hover:bg-muted"
                      disabled={saving || deleting}
                    >
                      <Heart
                        className={`h-5 w-5 ${
                          note.is_favorite
                            ? "fill-favorite text-favorite"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                    <time className="text-xs text-muted-foreground" dateTime={visibleDate}>
                      {formatNoteDate(visibleDate)}
                    </time>
                  </div>
                  <div className="pr-36 sm:pr-44">
                    <QuoteBlock
                      attribution={
                        <div className="flex flex-wrap items-center gap-2">
                          {note.quote_speaker && (
                            <span className="font-serif italic">
                              - {note.quote_speaker}
                            </span>
                          )}
                          {pageRangeLabel && (
                            <span className="text-xs font-medium">{pageRangeLabel}</span>
                          )}
                        </div>
                      }
                    >
                      <CollapsibleNoteContent
                        markdown={note.content}
                      />
                    </QuoteBlock>
                  </div>
                </article>
              );
            }

            return (
              <article key={note.id} className="rounded-lg border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={LABEL_STYLES[note.label]}>
                      {labelText(note.label)}
                    </Badge>
                    {pageRangeLabel && (
                      <span className="text-xs font-medium text-muted-foreground">
                        {pageRangeLabel}
                      </span>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={visibleDate}>
                    {formatNoteDate(visibleDate)}
                  </time>
                </div>
                {note.title && (
                  <h3 className="mb-1 text-sm font-heading leading-snug font-medium">
                    {note.title}
                  </h3>
                )}
                <CollapsibleNoteContent
                  markdown={note.content}
                  className="text-sm leading-6 text-foreground"
                  footerRight={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit note"
                      title="Edit note"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={saving || deleting}
                      onClick={() => openEditComposer(note)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  }
                />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
