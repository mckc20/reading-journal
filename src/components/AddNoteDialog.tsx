import { useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { Bold, Italic, PlusCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { createBookNote, updateBookNote } from "@/lib/bookNotes";
import { createAuthorNote, updateAuthorNote } from "@/lib/authorNotes";
import { normalizeJournalTags } from "@/lib/journalTags";
import { noteMarkdownToEditorHtml } from "@/lib/noteFormatting";
import { createSeriesNote, updateSeriesNote } from "@/lib/seriesNotes";
import { cn, getTodayLocalDate } from "@/lib/utils";
import type { AuthorNote, BookNote, SeriesNote } from "@/types";

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBookId?: string;
  entity?: { type: "Book"; id?: string } | { type: "Series"; id: string } | { type: "Author"; id: string };
  initialEntry?: BookNote | SeriesNote | AuthorNote | null;
  tagSuggestions?: string[];
  onSaved?: (note: BookNote | SeriesNote | AuthorNote) => void;
}

interface JournalEntryFormProps {
  active?: boolean;
  initialBookId?: string;
  entity?: { type: "Book"; id?: string } | { type: "Series"; id: string } | { type: "Author"; id: string };
  initialEntry?: BookNote | SeriesNote | AuthorNote | null;
  tagSuggestions?: string[];
  onCancel: () => void;
  onSaved?: (note: BookNote | SeriesNote | AuthorNote) => void;
}

type ManualJournalEntryType = "quote" | "thought";

interface FormValues {
  bookId: string;
  entityId: string;
  entryType: ManualJournalEntryType;
  title: string;
  content: string;
  pageStart: string;
  noteDate: string;
  tagDraft: string;
  tags: string[];
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

export function JournalEntryForm({
  active = true,
  initialBookId = "",
  entity,
  tagSuggestions = [],
  initialEntry = null,
  onCancel,
  onSaved,
}: JournalEntryFormProps) {
  const { user } = useAuth();
  const { books } = useBooksContext();
  const { authors } = useAuthorsContext();
  const { series } = useSeries();
  const editorRef = useRef<HTMLDivElement>(null);
  const entityType = entity?.type ?? (initialEntry && "series_id" in initialEntry ? "Series" : initialEntry && "author_id" in initialEntry ? "Author" : "Book");
  const entityId =
    entity?.id ??
    (initialEntry && "series_id" in initialEntry
      ? initialEntry.series_id
      : initialEntry && "author_id" in initialEntry
        ? initialEntry.author_id
        : initialEntry && "book_id" in initialEntry
          ? initialEntry.book_id
          : initialBookId);
  const supportsQuotes = true;
  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title)),
    [books],
  );
  const sortedSeries = useMemo(
    () => [...series].sort((a, b) => a.name.localeCompare(b.name)),
    [series],
  );
  const sortedAuthors = useMemo(
    () => [...authors].sort((a, b) => a.name.localeCompare(b.name)),
    [authors],
  );
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      bookId: initialBookId,
      entityId: entityId ?? "",
      entryType: "thought",
      title: "",
      content: "",
      pageStart: "",
      noteDate: getTodayLocalDate(),
      tagDraft: "",
      tags: [],
    },
  });

  const entryType = watch("entryType");
  const content = watch("content");
  const tags = watch("tags");
  const tagDraft = watch("tagDraft");
  const availableTagSuggestions = useMemo(() => {
    const selected = new Set(normalizeJournalTags(tags).map((tag) => tag.toLocaleLowerCase()));
    return normalizeJournalTags(tagSuggestions).filter((tag) => !selected.has(tag.toLocaleLowerCase()));
  }, [tagSuggestions, tags]);

  useEffect(() => {
    if (!active) return;
    const isBookEntry = initialEntry && "book_id" in initialEntry;
    const isQuote = "label" in (initialEntry ?? {}) && initialEntry?.label === "quote";
    reset({
      bookId: isBookEntry ? initialEntry.book_id : initialBookId,
      entityId,
      entryType: isQuote ? "quote" : "thought",
      title: isQuote && "quote_speaker" in initialEntry ? initialEntry.quote_speaker ?? "" : initialEntry?.title ?? "",
      content: initialEntry?.content ?? "",
      pageStart: "page_start" in (initialEntry ?? {}) && initialEntry?.page_start ? String(initialEntry.page_start) : "",
      noteDate: initialEntry?.note_date ?? getTodayLocalDate(),
      tagDraft: "",
      tags: normalizeJournalTags(initialEntry?.tags),
    });
    if (editorRef.current) {
      editorRef.current.innerHTML = noteMarkdownToEditorHtml(initialEntry?.content ?? "");
    }
  }, [active, entityId, initialBookId, initialEntry, reset]);

  function resetForm() {
    reset({
      bookId: initialBookId,
      entityId,
      entryType: "thought",
      title: "",
      content: "",
      pageStart: "",
      noteDate: getTodayLocalDate(),
      tagDraft: "",
      tags: [],
    });
    if (editorRef.current) editorRef.current.innerHTML = "";
  }

  function syncMarkdownFromEditor() {
    if (!editorRef.current) return;
    setValue("content", editorHtmlToMarkdown(editorRef.current.innerHTML), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function runEditorCommand(command: "bold" | "italic") {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand(command);

    window.requestAnimationFrame(syncMarkdownFromEditor);
  }

  function setEntryType(value: ManualJournalEntryType) {
    if (value === "quote" && !supportsQuotes) return;
    setValue("entryType", value, { shouldDirty: true });
  }

  function addTag(tag: string) {
    const nextTags = normalizeJournalTags([...tags, tag]);
    setValue("tags", nextTags, { shouldDirty: true });
    setValue("tagDraft", "");
  }

  function removeTag(tag: string) {
    setValue(
      "tags",
      tags.filter((item) => item.toLocaleLowerCase() !== tag.toLocaleLowerCase()),
      { shouldDirty: true },
    );
  }

  async function onSubmit(values: FormValues) {
    if (!user) {
      setError("root", { message: "You must be signed in." });
      return;
    }

    try {
      const normalizedTags = normalizeJournalTags([...values.tags, values.tagDraft]);
      let note: BookNote | SeriesNote | AuthorNote;

      if (entityType === "Series") {
        const selectedSeriesId = values.entityId || entityId;
        const fields = {
          label: values.entryType === "quote" ? ("quote" as const) : ("note" as const),
          title: values.entryType === "thought" ? values.title || undefined : undefined,
          quoteSpeaker: values.entryType === "quote" ? values.title || undefined : undefined,
          content: values.content,
          tags: normalizedTags,
          pageStart: values.pageStart,
          noteDate: values.noteDate,
        };
        note =
          initialEntry && "series_id" in initialEntry
            ? await updateSeriesNote({
                noteId: initialEntry.id,
                ...fields,
              })
            : await createSeriesNote({
                seriesId: selectedSeriesId,
                userId: user.id,
                ...fields,
              });
      } else if (entityType === "Author") {
        const selectedAuthorId = values.entityId || entityId;
        const fields = {
          label: values.entryType === "quote" ? ("quote" as const) : ("note" as const),
          title: values.entryType === "thought" ? values.title || undefined : undefined,
          quoteSpeaker: values.entryType === "quote" ? values.title || undefined : undefined,
          content: values.content,
          tags: normalizedTags,
          pageStart: values.pageStart,
          noteDate: values.noteDate,
        };
        note =
          initialEntry && "author_id" in initialEntry
            ? await updateAuthorNote({
                noteId: initialEntry.id,
                ...fields,
              })
            : await createAuthorNote({
                authorId: selectedAuthorId,
                userId: user.id,
                ...fields,
              });
      } else {
        const fields = {
          label: values.entryType === "quote" ? ("quote" as const) : ("note" as const),
          content: values.content,
          title: values.entryType === "thought" ? values.title || undefined : undefined,
          quoteSpeaker: values.entryType === "quote" ? values.title || undefined : undefined,
          tags: normalizedTags,
          pageStart: values.pageStart,
          noteDate: values.noteDate,
        };
        note =
          initialEntry && "book_id" in initialEntry
            ? await updateBookNote({ noteId: initialEntry.id, ...fields })
            : await createBookNote({
                bookId: values.bookId,
                userId: user.id,
                ...fields,
              });
      }

      onSaved?.(note);
      resetForm();
    } catch (submitError) {
      setError("root", {
        message: submitError instanceof Error ? submitError.message : "Failed to add note.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-lg border-0">
            <div className="border-b px-4 py-4">
              {entityType === "Book" && (
                <>
                  <Label htmlFor="note-book">Related book *</Label>
                  <Controller
                    name="bookId"
                    control={control}
                    rules={{ required: "Choose a book." }}
                    render={({ field }) => (
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                      >
                        <SelectTrigger id="note-book" className="mt-2">
                          <SelectValue placeholder="Choose a book" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Choose a book</SelectItem>
                          {sortedBooks.map((book) => (
                            <SelectItem key={book.id} value={book.id}>
                              {book.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.bookId && <p className="mt-1 text-xs text-destructive">{errors.bookId.message}</p>}
                </>
              )}
              {entityType === "Series" && (
                <>
                  <Label htmlFor="note-series">Related series *</Label>
                  <Controller
                    name="entityId"
                    control={control}
                    rules={{ required: "Choose a series." }}
                    render={({ field }) => (
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                      >
                        <SelectTrigger id="note-series" className="mt-2">
                          <SelectValue placeholder="Choose a series" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Choose a series</SelectItem>
                          {sortedSeries.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.entityId && <p className="mt-1 text-xs text-destructive">{errors.entityId.message}</p>}
                </>
              )}
              {entityType === "Author" && (
                <>
                  <Label htmlFor="note-author">Related author *</Label>
                  <Controller
                    name="entityId"
                    control={control}
                    rules={{ required: "Choose an author." }}
                    render={({ field }) => (
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                      >
                        <SelectTrigger id="note-author" className="mt-2">
                          <SelectValue placeholder="Choose an author" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Choose an author</SelectItem>
                          {sortedAuthors.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.entityId && <p className="mt-1 text-xs text-destructive">{errors.entityId.message}</p>}
                </>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {supportsQuotes && (
                  <button
                    type="button"
                    onClick={() => setEntryType("quote")}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      entryType === "quote"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-primary",
                    )}
                  >
                    Quote
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEntryType("thought")}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    entryType === "thought"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-primary",
                  )}
                >
                  Thought
                </button>
              </div>
            </div>

            <div className="border-b p-3">
              <Label htmlFor="note-title" className="sr-only">
                {entryType === "quote" ? "Speaker" : "Title"}
              </Label>
              <Input
                id="note-title"
                {...register("title")}
                placeholder={entryType === "quote" ? "Speaker" : "Title"}
                className="border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0"
              />
            </div>

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
            </div>

            <div className="p-4">
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                {supportsQuotes && (
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
                      {...register("pageStart")}
                      placeholder="42"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="note-date" className="text-xs">
                    Date
                  </Label>
                  <Input id="note-date" type="date" {...register("noteDate")} />
                </div>
              </div>

              <div className="mb-4 space-y-2">
                <Label className="text-xs">Tags</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium">
                      {tag}
                      <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1 rounded-full border bg-background px-2 py-1">
                    <PlusCircle className="h-4 w-4 text-primary" aria-hidden />
                    <Input
                      {...register("tagDraft")}
                      placeholder="Add tag"
                      className="h-6 w-24 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTag(tagDraft);
                        }
                      }}
                    />
                  </div>
                  {availableTagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {tag}
                    </button>
                  ))}
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
                data-placeholder={entryType === "quote" ? "Write the quote..." : "Write your thought..."}
                onInput={syncMarkdownFromEditor}
                onBlur={syncMarkdownFromEditor}
                className="min-h-56 rounded-md border-0 bg-transparent px-0 py-2 text-sm leading-6 shadow-none outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:ring-0"
              />
              {errors.content && <p className="mt-1 text-xs text-destructive">{errors.content.message}</p>}
            </div>

            {errors.root && <p className="px-4 pb-3 text-sm text-destructive">{errors.root.message}</p>}

            <div className="flex flex-col-reverse gap-2 border-t bg-background p-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !content.trim()}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
    </form>
  );
}

export default function AddNoteDialog({
  open,
  onOpenChange,
  initialBookId = "",
  entity,
  tagSuggestions = [],
  initialEntry = null,
  onSaved,
}: AddNoteDialogProps) {
  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Add journal entry</DialogTitle>
        </DialogHeader>

        <JournalEntryForm
          active={open}
          initialBookId={initialBookId}
          entity={entity}
          initialEntry={initialEntry}
          tagSuggestions={tagSuggestions}
          onCancel={() => onOpenChange(false)}
          onSaved={(note) => {
            onSaved?.(note);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
