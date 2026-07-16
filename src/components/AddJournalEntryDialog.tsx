import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { PlusCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MarkdownEditor from "@/components/MarkdownEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { createBookJournalEntryRecord, updateBookJournalEntryRecord } from "@/lib/bookJournal";
import { createAuthorJournalEntryRecord, updateAuthorJournalEntryRecord } from "@/lib/authorJournal";
import { isInternalJournalTag, normalizeJournalTags, visibleJournalTags } from "@/lib/journalTags";
import { createSeriesJournalEntryRecord, updateSeriesJournalEntryRecord } from "@/lib/seriesJournal";
import { cn, getTodayLocalDate } from "@/lib/utils";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord, SeriesJournalEntryRecord } from "@/types";

interface AddJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBookId?: string;
  entity?: { type: "Book"; id?: string } | { type: "Series"; id: string } | { type: "Author"; id: string };
  initialEntry?: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord | null;
  parentEntryId?: string | null;
  initialPageStart?: string | number | null;
  initialNoteDate?: string | null;
  preferInitialPageAndDate?: boolean;
  systemTags?: string[];
  replaceSystemTagPrefixes?: string[];
  tagSuggestions?: string[];
  onSaved?: (note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
}

interface JournalEntryFormProps {
  active?: boolean;
  initialBookId?: string;
  entity?: { type: "Book"; id?: string } | { type: "Series"; id: string } | { type: "Author"; id: string };
  initialEntry?: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord | null;
  parentEntryId?: string | null;
  initialPageStart?: string | number | null;
  initialNoteDate?: string | null;
  preferInitialPageAndDate?: boolean;
  systemTags?: string[];
  replaceSystemTagPrefixes?: string[];
  tagSuggestions?: string[];
  variant?: "dialog" | "inline";
  heading?: ReactNode;
  hideEntitySelector?: boolean;
  footerStart?: ReactNode;
  onCancel: () => void;
  onSaved?: (note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
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

type JournalEntryDraft = FormValues & {
  savedAt: string;
};

const JOURNAL_ENTRY_DRAFT_PREFIX = "reading-journal:journal-entry-draft:v1";

function hasDraftContent(values: FormValues): boolean {
  return Boolean(
    values.content.trim() ||
      values.title.trim() ||
      values.pageStart.trim() ||
      values.tagDraft.trim() ||
      values.tags.length > 0,
  );
}

function readJournalEntryDraft(key: string | null): FormValues | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const draft = JSON.parse(raw) as Partial<JournalEntryDraft>;
    if (!draft || typeof draft !== "object") return null;

    return {
      bookId: typeof draft.bookId === "string" ? draft.bookId : "",
      entityId: typeof draft.entityId === "string" ? draft.entityId : "",
      entryType: draft.entryType === "quote" ? "quote" : "thought",
      title: typeof draft.title === "string" ? draft.title : "",
      content: typeof draft.content === "string" ? draft.content : "",
      pageStart: typeof draft.pageStart === "string" ? draft.pageStart : "",
      noteDate: typeof draft.noteDate === "string" ? draft.noteDate : getTodayLocalDate(),
      tagDraft: typeof draft.tagDraft === "string" ? draft.tagDraft : "",
      tags: Array.isArray(draft.tags) ? normalizeJournalTags(draft.tags.filter((tag): tag is string => typeof tag === "string")) : [],
    };
  } catch {
    return null;
  }
}

function writeJournalEntryDraft(key: string | null, values: FormValues, preserveEmpty = false) {
  if (!key || typeof window === "undefined") return;

  try {
    if (!preserveEmpty && !hasDraftContent(values)) {
      window.localStorage.removeItem(key);
      return;
    }

    const draft: JournalEntryDraft = {
      ...values,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Draft saving is a convenience feature. Storage can fail in private mode or when full.
  }
}

function journalEntryDraftSource(entry: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord): string {
  if ("book_id" in entry) return "book";
  if ("series_id" in entry) return "series";
  return "author";
}

function removeJournalEntryDraft(key: string | null) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures so journal saving and cancelling are not blocked.
  }
}

export function JournalEntryForm({
  active = true,
  initialBookId = "",
  entity,
  tagSuggestions = [],
  initialEntry = null,
  parentEntryId = null,
  initialPageStart = null,
  initialNoteDate = null,
  preferInitialPageAndDate = false,
  systemTags = [],
  replaceSystemTagPrefixes = [],
  variant = "dialog",
  heading,
  hideEntitySelector = false,
  footerStart,
  onCancel,
  onSaved,
}: JournalEntryFormProps) {
  const { user } = useAuth();
  const { books } = useBooksContext();
  const { authors } = useAuthorsContext();
  const { series } = useSeries();
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
      pageStart: initialPageStart ? String(initialPageStart) : "",
      noteDate: initialNoteDate ?? getTodayLocalDate(),
      tagDraft: "",
      tags: [],
    },
  });

  const entryType = watch("entryType");
  const content = watch("content");
  const tags = watch("tags");
  const tagDraft = watch("tagDraft");
  const formValues = watch();
  const draftSaveReadyRef = useRef(false);
  const isInline = variant === "inline";
  const hiddenInitialTags = useMemo(
    () =>
      normalizeJournalTags(initialEntry?.tags)
        .filter(isInternalJournalTag)
        .filter((tag) => !replaceSystemTagPrefixes.some((prefix) => tag.startsWith(prefix))),
    [initialEntry, replaceSystemTagPrefixes],
  );
  const hiddenSystemTags = useMemo(
    () => normalizeJournalTags([...hiddenInitialTags, ...systemTags]),
    [hiddenInitialTags, systemTags],
  );
  const availableTagSuggestions = useMemo(() => {
    const selected = new Set(normalizeJournalTags(tags).map((tag) => tag.toLocaleLowerCase()));
    return normalizeJournalTags(tagSuggestions).filter((tag) => !selected.has(tag.toLocaleLowerCase()));
  }, [tagSuggestions, tags]);
  const draftKey = useMemo(() => {
    if (initialEntry) {
      return [
        JOURNAL_ENTRY_DRAFT_PREFIX,
        user?.id ?? "anonymous",
        "edit",
        journalEntryDraftSource(initialEntry),
        initialEntry.id,
      ].join(":");
    }

    return [
      JOURNAL_ENTRY_DRAFT_PREFIX,
      user?.id ?? "anonymous",
      "create",
      entityType,
      entityId || initialBookId || "unselected",
      parentEntryId || "root",
      hiddenSystemTags.join(",") || "manual",
    ].join(":");
  }, [entityId, entityType, hiddenSystemTags, initialBookId, initialEntry, parentEntryId, user?.id]);

  useEffect(() => {
    if (!active) return;
    const isBookEntry = initialEntry && "book_id" in initialEntry;
    const isQuote = "label" in (initialEntry ?? {}) && initialEntry?.label === "quote";
    const initialValues: FormValues = {
      bookId: isBookEntry ? initialEntry.book_id : initialBookId,
      entityId,
      entryType: isQuote ? "quote" : "thought",
      title: isQuote && "quote_speaker" in initialEntry ? initialEntry.quote_speaker ?? "" : initialEntry?.title ?? "",
      content: initialEntry?.content ?? "",
      pageStart: preferInitialPageAndDate
        ? initialPageStart ? String(initialPageStart) : ""
        : "page_start" in (initialEntry ?? {}) && initialEntry?.page_start ? String(initialEntry.page_start) : initialPageStart ? String(initialPageStart) : "",
      noteDate: preferInitialPageAndDate
        ? initialNoteDate ?? getTodayLocalDate()
        : initialEntry?.entry_date ?? initialNoteDate ?? getTodayLocalDate(),
      tagDraft: "",
      tags: visibleJournalTags(initialEntry?.tags),
    };
    const draft = readJournalEntryDraft(draftKey);

    reset(draft ? { ...initialValues, ...draft } : initialValues);
    draftSaveReadyRef.current = true;
  }, [active, draftKey, entityId, initialBookId, initialEntry, initialNoteDate, initialPageStart, preferInitialPageAndDate, reset]);

  useEffect(() => {
    if (!active || !draftSaveReadyRef.current || !draftKey) return;
    writeJournalEntryDraft(draftKey, formValues, Boolean(initialEntry));
  }, [active, draftKey, formValues, initialEntry]);

  function resetForm() {
    removeJournalEntryDraft(draftKey);
    reset({
      bookId: initialBookId,
      entityId,
      entryType: "thought",
      title: "",
      content: "",
      pageStart: initialPageStart ? String(initialPageStart) : "",
      noteDate: initialNoteDate ?? getTodayLocalDate(),
      tagDraft: "",
      tags: [],
    });
  }

  function handleCancel() {
    removeJournalEntryDraft(draftKey);
    onCancel();
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
      const normalizedTags = normalizeJournalTags([...values.tags, values.tagDraft, ...hiddenSystemTags]);
      let note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord;

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
            ? await updateSeriesJournalEntryRecord({
                noteId: initialEntry.id,
                ...fields,
              })
            : await createSeriesJournalEntryRecord({
                seriesId: selectedSeriesId,
                userId: user.id,
                parentEntryId,
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
            ? await updateAuthorJournalEntryRecord({
                noteId: initialEntry.id,
                ...fields,
              })
            : await createAuthorJournalEntryRecord({
                authorId: selectedAuthorId,
                userId: user.id,
                parentEntryId,
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
            ? await updateBookJournalEntryRecord({ noteId: initialEntry.id, ...fields })
            : await createBookJournalEntryRecord({
                bookId: values.bookId,
                userId: user.id,
                parentEntryId,
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
      <div className={cn("rounded-lg", isInline ? "border bg-background shadow-sm" : "border-0")}>
            {heading && (
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-medium">{heading}</h3>
              </div>
            )}
            <div className={cn("border-b px-4 py-4", isInline && "py-3")}>
              {entityType === "Book" && !hideEntitySelector && (
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
              {entityType === "Series" && !hideEntitySelector && (
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
              {entityType === "Author" && !hideEntitySelector && (
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
              <div className={cn("flex flex-wrap gap-2", !hideEntitySelector && "mt-4")}>
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

            <div className={cn("border-b p-3", isInline && "py-2")}>
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

            <div className={cn("p-4", isInline && "p-3")}>
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
              <MarkdownEditor
                id="note-content"
                value={content}
                placeholder={entryType === "quote" ? "Write the quote..." : "Write your thought..."}
                minHeightClassName={isInline ? "min-h-32" : "min-h-56"}
                onChange={(nextContent) => setValue("content", nextContent, { shouldDirty: true, shouldValidate: true })}
              />
              {errors.content && <p className="mt-1 text-xs text-destructive">{errors.content.message}</p>}
            </div>

            {errors.root && <p className="px-4 pb-3 text-sm text-destructive">{errors.root.message}</p>}

            <div className="flex flex-col-reverse gap-2 border-t bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>{footerStart}</div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !content.trim()}>
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
    </form>
  );
}

export default function AddJournalEntryDialog({
  open,
  onOpenChange,
  initialBookId = "",
  entity,
  tagSuggestions = [],
  initialEntry = null,
  parentEntryId = null,
  initialPageStart = null,
  initialNoteDate = null,
  preferInitialPageAndDate = false,
  systemTags = [],
  replaceSystemTagPrefixes = [],
  onSaved,
}: AddJournalEntryDialogProps) {
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
          parentEntryId={parentEntryId}
          initialPageStart={initialPageStart}
          initialNoteDate={initialNoteDate}
          preferInitialPageAndDate={preferInitialPageAndDate}
          systemTags={systemTags}
          replaceSystemTagPrefixes={replaceSystemTagPrefixes}
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
