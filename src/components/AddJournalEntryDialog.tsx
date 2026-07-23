import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { ImagePlus, PlusCircle, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InlineMarkdownEditor from "@/components/InlineMarkdownEditor";
import MarkdownEditor from "@/components/MarkdownEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useAuthorsContext } from "@/context/AuthorsContext";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { createBookJournalEntryRecord, updateBookJournalEntryRecord } from "@/lib/bookJournal";
import { createAuthorJournalEntryRecord, updateAuthorJournalEntryRecord } from "@/lib/authorJournal";
import {
  detachJournalEntryMediaItem,
  journalParagraphCount,
  nextJournalMediaPosition,
  removeLegacyJournalMediaReferences,
  sourceForJournalEntryRecord,
  updateJournalEntryMediaItem,
  uploadJournalImage,
} from "@/lib/journalMedia";
import { isInternalJournalTag, normalizeJournalTags, visibleJournalTags } from "@/lib/journalTags";
import { createSeriesJournalEntryRecord, updateSeriesJournalEntryRecord } from "@/lib/seriesJournal";
import { cn, getTodayLocalDate } from "@/lib/utils";
import type { AuthorJournalEntryRecord, BookJournalEntryRecord, JournalEntryMediaItem, SeriesJournalEntryRecord } from "@/types";

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
  variant?: "dialog" | "inline";
  heading?: ReactNode;
  hideEntitySelector?: boolean;
  footerStart?: ReactNode;
  autoFocus?: boolean;
  autoSave?: boolean;
  onEditorBlur?: (note?: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord | null) => void;
  onCancel: () => void;
  onSaved?: (note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
  onSubmitSaved?: (note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord) => void;
}

type ManualJournalEntryType = "quote" | "thought";

interface FormValues {
  bookId: string;
  entityId: string;
  entryType: ManualJournalEntryType;
  attribution: string;
  content: string;
  pageStart: string;
  noteDate: string;
  tagDraft: string;
  tags: string[];
}

type JournalEntryDraft = FormValues & {
  savedAt: string;
};

type LegacyJournalEntryDraft = Partial<JournalEntryDraft> & {
  title?: string;
};

const JOURNAL_ENTRY_DRAFT_PREFIX = "reading-journal:journal-entry-draft:v1";
const JOURNAL_ENTRY_DRAFT_PREFIX_V2 = "reading-journal:journal-entry-draft:v2";
const EMPTY_SYSTEM_TAGS: string[] = [];
const EMPTY_SYSTEM_TAG_PREFIXES: string[] = [];

function hasDraftContent(values: FormValues): boolean {
  return Boolean(
    values.content.trim() ||
      values.attribution.trim() ||
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

    const draft = JSON.parse(raw) as LegacyJournalEntryDraft;
    if (!draft || typeof draft !== "object") return null;

    return {
      bookId: typeof draft.bookId === "string" ? draft.bookId : "",
      entityId: typeof draft.entityId === "string" ? draft.entityId : "",
      entryType: draft.entryType === "quote" ? "quote" : "thought",
      attribution:
        typeof draft.attribution === "string"
          ? draft.attribution
          : draft.entryType === "quote" && typeof draft.title === "string"
            ? draft.title
            : "",
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
  initialEntry = null,
  parentEntryId = null,
  initialPageStart = null,
  initialNoteDate = null,
  preferInitialPageAndDate = false,
  systemTags = EMPTY_SYSTEM_TAGS,
  replaceSystemTagPrefixes = EMPTY_SYSTEM_TAG_PREFIXES,
  variant = "dialog",
  heading,
  hideEntitySelector = false,
  footerStart,
  autoFocus = false,
  autoSave = false,
  onEditorBlur,
  onCancel,
  onSaved,
  onSubmitSaved,
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
      attribution: "",
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
  const formRef = useRef<HTMLFormElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const draftSaveReadyRef = useRef(false);
  const autosaveReadyRef = useRef(false);
  const autosaveSignatureRef = useRef("");
  const [autosaveEntry, setAutosaveEntry] = useState<BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord | null>(initialEntry);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<JournalEntryMediaItem[]>(initialEntry?.media ?? []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const isInline = variant === "inline";
  const paragraphCount = useMemo(() => journalParagraphCount(content), [content]);
  const systemTagsKey = systemTags.join("\u0001");
  const replaceSystemTagPrefixesKey = replaceSystemTagPrefixes.join("\u0001");
  const initialEntryResetKey = initialEntry ? `${journalEntryDraftSource(initialEntry)}:${initialEntry.id}` : "new";
  const hiddenInitialTags = useMemo(
    () =>
      normalizeJournalTags(initialEntry?.tags)
        .filter(isInternalJournalTag)
        .filter((tag) => !replaceSystemTagPrefixes.some((prefix) => tag.startsWith(prefix))),
    [initialEntry?.id, replaceSystemTagPrefixesKey],
  );
  const hiddenSystemTags = useMemo(
    () => normalizeJournalTags([...hiddenInitialTags, ...systemTags]),
    [hiddenInitialTags, systemTagsKey],
  );
  const draftKey = useMemo(() => {
    if (initialEntry) {
      return [
        JOURNAL_ENTRY_DRAFT_PREFIX_V2,
        user?.id ?? "anonymous",
        "edit",
        journalEntryDraftSource(initialEntry),
        initialEntry.id,
      ].join(":");
    }

    return [
      JOURNAL_ENTRY_DRAFT_PREFIX_V2,
      user?.id ?? "anonymous",
      "create",
      entityType,
      entityId || initialBookId || "unselected",
      parentEntryId || "root",
      hiddenSystemTags.join(",") || "manual",
    ].join(":");
  }, [entityId, entityType, hiddenSystemTags, initialBookId, initialEntry, parentEntryId, user?.id]);
  const legacyDraftKey = useMemo(
    () => draftKey.replace(JOURNAL_ENTRY_DRAFT_PREFIX_V2, JOURNAL_ENTRY_DRAFT_PREFIX),
    [draftKey],
  );

  useEffect(() => {
    if (!active) return;
    const isBookEntry = initialEntry && "book_id" in initialEntry;
    const isQuote = "label" in (initialEntry ?? {}) && initialEntry?.label === "quote";
    const initialValues: FormValues = {
      bookId: isBookEntry ? initialEntry.book_id : initialBookId,
      entityId,
      entryType: isQuote ? "quote" : "thought",
      attribution: isQuote && initialEntry ? initialEntry.attribution ?? "" : "",
      content: removeLegacyJournalMediaReferences(initialEntry?.content ?? ""),
      pageStart: preferInitialPageAndDate
        ? initialPageStart ? String(initialPageStart) : ""
        : "page_start" in (initialEntry ?? {}) && initialEntry?.page_start ? String(initialEntry.page_start) : initialPageStart ? String(initialPageStart) : "",
      noteDate: preferInitialPageAndDate
        ? initialNoteDate ?? getTodayLocalDate()
        : initialEntry?.entry_date ?? initialNoteDate ?? getTodayLocalDate(),
      tagDraft: "",
      tags: visibleJournalTags(initialEntry?.tags),
    };
    const savedDraft = readJournalEntryDraft(draftKey) ?? readJournalEntryDraft(legacyDraftKey);
    const draft = initialEntry && savedDraft?.content.trim() === "" && initialEntry.content.trim() !== ""
      ? null
      : savedDraft;

    draftSaveReadyRef.current = false;
    autosaveReadyRef.current = false;
    setAutosaveEntry(initialEntry);
    setAutosaveStatus(initialEntry ? "saved" : "idle");
    setAutosaveError(null);
    setMediaItems(initialEntry?.media ?? []);
    setMediaError(null);
    reset(draft ? { ...initialValues, ...draft } : initialValues);
    const timeoutId = window.setTimeout(() => {
      draftSaveReadyRef.current = true;
      autosaveReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [active, draftKey, entityId, initialBookId, initialEntryResetKey, initialNoteDate, initialPageStart, legacyDraftKey, preferInitialPageAndDate, reset]);

  useEffect(() => {
    if (!active || !draftSaveReadyRef.current || !draftKey) return;
    writeJournalEntryDraft(draftKey, formValues, Boolean(initialEntry));
  }, [active, draftKey, formValues, initialEntry]);

  function resetForm() {
    removeJournalEntryDraft(draftKey);
    setMediaItems([]);
    setMediaError(null);
    reset({
      bookId: initialBookId,
      entityId,
      entryType: "thought",
      attribution: "",
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

  async function saveJournalEntry(values: FormValues, entryOverride: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord | null) {
    if (!user) {
      setError("root", { message: "You must be signed in." });
      throw new Error("You must be signed in.");
    }

    const normalizedTags = normalizeJournalTags([...values.tags, values.tagDraft, ...hiddenSystemTags]);
    let note: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord;

    if (entityType === "Series") {
      const selectedSeriesId = values.entityId || entityId;
      const fields = {
        label: values.entryType === "quote" ? ("quote" as const) : ("note" as const),
        attribution: values.entryType === "quote" ? values.attribution || undefined : undefined,
        content: removeLegacyJournalMediaReferences(values.content),
        tags: normalizedTags,
        pageStart: values.pageStart,
        noteDate: values.noteDate,
      };
      note =
        entryOverride && "series_id" in entryOverride
          ? await updateSeriesJournalEntryRecord({
              noteId: entryOverride.id,
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
        attribution: values.entryType === "quote" ? values.attribution || undefined : undefined,
        content: removeLegacyJournalMediaReferences(values.content),
        tags: normalizedTags,
        pageStart: values.pageStart,
        noteDate: values.noteDate,
      };
      note =
        entryOverride && "author_id" in entryOverride
          ? await updateAuthorJournalEntryRecord({
              noteId: entryOverride.id,
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
        content: removeLegacyJournalMediaReferences(values.content),
        attribution: values.entryType === "quote" ? values.attribution || undefined : undefined,
        tags: normalizedTags,
        pageStart: values.pageStart,
        noteDate: values.noteDate,
      };
      note =
        entryOverride && "book_id" in entryOverride
          ? await updateBookJournalEntryRecord({ noteId: entryOverride.id, ...fields })
          : await createBookJournalEntryRecord({
              bookId: values.bookId,
              userId: user.id,
              parentEntryId,
              ...fields,
            });
    }

    setAutosaveEntry(note);
    return note;
  }

  async function onSubmit(values: FormValues) {
    try {
      const note = await saveJournalEntry(values, autosaveEntry ?? initialEntry);
      const noteWithMedia = { ...note, media: mediaItems };
      onSaved?.(noteWithMedia);
      onSubmitSaved?.(noteWithMedia);
      resetForm();
    } catch (submitError) {
      setError("root", {
        message: submitError instanceof Error ? submitError.message : "Failed to add note.",
      });
    }
  }

  useEffect(() => {
    if (!autoSave || !active || !autosaveReadyRef.current) return;
    if (!content.trim()) {
      setAutosaveStatus("idle");
      return;
    }
    if (entityType === "Book" && !(formValues.bookId || entityId || initialBookId)) return;
    if ((entityType === "Series" || entityType === "Author") && !(formValues.entityId || entityId)) return;

    const signature = JSON.stringify({
      ...formValues,
      tags: normalizeJournalTags([...formValues.tags, formValues.tagDraft, ...hiddenSystemTags]),
      entityType,
      entityId,
      autosaveEntryId: autosaveEntry?.id ?? initialEntry?.id ?? null,
    });
    if (signature === autosaveSignatureRef.current) return;

    const timeoutId = window.setTimeout(() => {
      setAutosaveStatus("saving");
      setAutosaveError(null);
      saveJournalEntry(formValues, autosaveEntry ?? initialEntry)
        .then((note) => {
          autosaveSignatureRef.current = JSON.stringify({
            ...formValues,
            tags: normalizeJournalTags([...formValues.tags, formValues.tagDraft, ...hiddenSystemTags]),
            entityType,
            entityId,
            autosaveEntryId: note.id,
          });
          setAutosaveStatus("saved");
          removeJournalEntryDraft(draftKey);
          onSaved?.({ ...note, media: mediaItems });
        })
        .catch((saveError) => {
          setAutosaveStatus("error");
          setAutosaveError(saveError instanceof Error ? saveError.message : "Could not save this entry.");
        });
    }, 850);

    return () => window.clearTimeout(timeoutId);
  }, [active, autoSave, autosaveEntry, content, draftKey, entityId, entityType, formValues, hiddenSystemTags, initialBookId, initialEntry, onSaved]);

  function handleInlineEditorBlur() {
    if (autoSave && formRef.current?.contains(document.activeElement)) {
      return;
    }

    if (!autoSave) {
      onEditorBlur?.(autosaveEntry ?? initialEntry);
      return;
    }

    if (!content.trim()) {
      onEditorBlur?.(autosaveEntry ?? initialEntry);
      return;
    }

    setAutosaveStatus("saving");
    setAutosaveError(null);
    saveJournalEntry(formValues, autosaveEntry ?? initialEntry)
      .then((note) => {
        setAutosaveStatus("saved");
        removeJournalEntryDraft(draftKey);
        onSaved?.({ ...note, media: mediaItems });
        onEditorBlur?.({ ...note, media: mediaItems });
      })
      .catch((saveError) => {
        setAutosaveStatus("error");
        setAutosaveError(saveError instanceof Error ? saveError.message : "Could not save this entry.");
      });
  }

  function handleManualInlineSave() {
    if (!autoSave || !content.trim()) return;

    setAutosaveStatus("saving");
    setAutosaveError(null);
    saveJournalEntry(formValues, autosaveEntry ?? initialEntry)
      .then((note) => {
        autosaveSignatureRef.current = JSON.stringify({
          ...formValues,
          tags: normalizeJournalTags([...formValues.tags, formValues.tagDraft, ...hiddenSystemTags]),
          entityType,
          entityId,
          autosaveEntryId: note.id,
        });
        setAutosaveStatus("saved");
        removeJournalEntryDraft(draftKey);
        onSaved?.({ ...note, media: mediaItems });
        onSubmitSaved?.({ ...note, media: mediaItems });
      })
      .catch((saveError) => {
        setAutosaveStatus("error");
        setAutosaveError(saveError instanceof Error ? saveError.message : "Could not save this entry.");
      });
  }

  function updateSavedEntryMedia(
    nextMedia: JournalEntryMediaItem[],
    entryOverride?: BookJournalEntryRecord | SeriesJournalEntryRecord | AuthorJournalEntryRecord | null,
  ) {
    const currentEntry = entryOverride ?? autosaveEntry ?? initialEntry;
    if (!currentEntry) return;
    const nextEntry = { ...currentEntry, media: nextMedia };
    setAutosaveEntry(nextEntry);
    onSaved?.(nextEntry);
  }

  async function handleImageSelected(file: File | undefined) {
    if (!file) return;

    if (!user) {
      setMediaError("You must be signed in.");
      return;
    }

    if (!content.trim()) {
      setMediaError("Write the journal entry text before adding an image.");
      return;
    }

    setUploadingImage(true);
    setMediaError(null);

    try {
      const note = await saveJournalEntry(formValues, autosaveEntry ?? initialEntry);
      setAutosaveEntry(note);
      onSaved?.(note);

      const uploaded = await uploadJournalImage({
        userId: user.id,
        journalEntrySource: sourceForJournalEntryRecord(note),
        journalEntryId: note.id,
        file,
        position: nextJournalMediaPosition(content),
      });
      const nextMedia = [...(note.media ?? mediaItems), uploaded].sort((a, b) => {
        const positionCompare = a.position - b.position;
        if (positionCompare !== 0) return positionCompare;
        return a.created_at.localeCompare(b.created_at);
      });
      setMediaItems(nextMedia);
      updateSavedEntryMedia(nextMedia, note);
      removeJournalEntryDraft(draftKey);
    } catch (uploadError) {
      setMediaError(uploadError instanceof Error ? uploadError.message : "Could not add this image.");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function updateMediaItem(
    item: JournalEntryMediaItem,
    changes: Partial<Pick<JournalEntryMediaItem, "caption" | "position">>,
  ) {
    const nextItem = {
      ...item,
      ...changes,
    };
    const nextMedia = mediaItems
      .map((mediaItem) => (mediaItem.id === item.id ? nextItem : mediaItem))
      .sort((a, b) => {
        const positionCompare = a.position - b.position;
        if (positionCompare !== 0) return positionCompare;
        return a.created_at.localeCompare(b.created_at);
      });
    setMediaItems(nextMedia);
    updateSavedEntryMedia(nextMedia);
    try {
      await updateJournalEntryMediaItem(nextItem);
    } catch (updateError) {
      setMediaError(updateError instanceof Error ? updateError.message : "Could not update this image.");
    }
  }

  async function removeMediaItem(item: JournalEntryMediaItem) {
    const nextMedia = mediaItems.filter((mediaItem) => mediaItem.id !== item.id);
    setMediaItems(nextMedia);
    updateSavedEntryMedia(nextMedia);
    try {
      await detachJournalEntryMediaItem(item);
    } catch (deleteError) {
      setMediaItems(mediaItems);
      updateSavedEntryMedia(mediaItems);
      setMediaError(deleteError instanceof Error ? deleteError.message : "Could not remove this image.");
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)}>
      <div className={cn(isInline ? "border-y border-border/60 bg-background" : "rounded-lg border-0")}>
            {heading && (
              <div className="border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-medium">{heading}</h3>
              </div>
            )}
            <div className={cn("p-4", isInline && "p-3")}>
              <Label htmlFor="note-content" className="sr-only">
                Note content
              </Label>
              {isInline ? (
                <InlineMarkdownEditor
                  id="note-content"
                  value={content}
                  placeholder={entryType === "quote" ? "Write the quote..." : "Start writing..."}
                  minHeightClassName="min-h-32"
                  autoFocus={autoFocus}
                  onBlur={handleInlineEditorBlur}
                  onChange={(nextContent) => setValue("content", nextContent, { shouldDirty: true, shouldValidate: true })}
                />
              ) : (
                <MarkdownEditor
                  id="note-content"
                  value={content}
                  placeholder={entryType === "quote" ? "Write the quote..." : "Start writing..."}
                  minHeightClassName="min-h-56"
                  media={mediaItems}
                  onChange={(nextContent) => setValue("content", nextContent, { shouldDirty: true, shouldValidate: true })}
                />
              )}
              {errors.content && <p className="mt-1 text-xs text-destructive">{errors.content.message}</p>}

              <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label className="text-xs">Images</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => void handleImageSelected(event.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2"
                      disabled={uploadingImage || !content.trim()}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                      {uploadingImage ? "Adding..." : "Add image"}
                    </Button>
                  </div>
                </div>

                {mediaItems.length > 0 && (
                  <div className="space-y-3">
                    {mediaItems.map((item) => (
                      <div key={item.id} className="grid gap-3 border-l-2 border-primary/30 pl-3 sm:grid-cols-[7rem_1fr]">
                        <img
                          src={item.thumbnailUrl ?? item.url}
                          alt={item.caption?.trim() || item.media_attachment.file_name}
                          className="h-28 w-full rounded-md object-cover"
                        />
                        <div className="min-w-0 space-y-2">
                          <Input
                            value={item.caption ?? ""}
                            placeholder="Caption"
                            className="h-9"
                            onChange={(event) => {
                              const caption = event.target.value;
                              setMediaItems((current) => current.map((mediaItem) => mediaItem.id === item.id ? { ...mediaItem, caption } : mediaItem));
                            }}
                            onBlur={(event) => void updateMediaItem(item, { caption: event.target.value })}
                          />
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Placement</span>
                            <Select
                              value={String(Math.min(Math.max(1, item.position), Math.max(1, paragraphCount)))}
                              onValueChange={(value) => void updateMediaItem(item, { position: Number(value) })}
                            >
                              <SelectTrigger className="h-8 w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: Math.max(1, paragraphCount) }, (_, index) => (
                                  <SelectItem key={index + 1} value={String(index + 1)}>
                                    {paragraphCount === 0 ? "After text" : `After paragraph ${index + 1}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              aria-label="Remove image"
                              onClick={() => void removeMediaItem(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {mediaError && <p className="text-xs text-destructive">{mediaError}</p>}
              </div>

              <details className="group mt-5 border-t border-border/60 pt-4" open={isInline || (!hideEntitySelector && !entityId)}>
                <summary
                  className={cn(
                    "list-none text-sm font-medium text-muted-foreground transition-colors",
                    isInline ? "pointer-events-none cursor-default" : "cursor-pointer hover:text-foreground",
                  )}
                  onClick={(event) => {
                    if (isInline) event.preventDefault();
                  }}
                >
                  Details
                </summary>

                <div className="mt-4 space-y-4">
                  {entityType === "Book" && !hideEntitySelector && (
                    <div>
                      <Label htmlFor="note-book">Book *</Label>
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
                    </div>
                  )}
                  {entityType === "Series" && !hideEntitySelector && (
                    <div>
                      <Label htmlFor="note-series">Series *</Label>
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
                    </div>
                  )}
                  {entityType === "Author" && !hideEntitySelector && (
                    <div>
                      <Label htmlFor="note-author">Author *</Label>
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
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Entry type</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
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

                  {entryType === "quote" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="note-attribution" className="text-xs">
                        Attribution
                      </Label>
                      <Input id="note-attribution" {...register("attribution")} placeholder="Speaker, character, or source" />
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
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
                    <div className="space-y-1.5">
                      <Label htmlFor="note-date" className="text-xs">
                        Date
                      </Label>
                      <Input id="note-date" type="date" {...register("noteDate")} />
                    </div>
                  </div>

                  <div className="space-y-2">
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
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {errors.root && <p className="px-4 pb-3 text-sm text-destructive">{errors.root.message}</p>}
            {isInline && autosaveError && <p className="px-4 pb-3 text-sm text-destructive">{autosaveError}</p>}

            {isInline && autoSave ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-background px-4 py-3 text-xs text-muted-foreground">
                <div>{footerStart}</div>
                <div className="flex items-center gap-3">
                  <span aria-live="polite">
                    {autosaveStatus === "saving" ? "Saving..." : autosaveStatus === "saved" ? "Saved" : autosaveStatus === "error" ? "Not saved" : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4 shadow-sm"
                    disabled={!content.trim() || autosaveStatus === "saving"}
                    onClick={handleManualInlineSave}
                  >
                    {autosaveStatus === "saving" ? "Saving..." : "Save"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
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
            )}
          </div>
    </form>
  );
}

export default function AddJournalEntryDialog({
  open,
  onOpenChange,
  initialBookId = "",
  entity,
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
          onCancel={() => onOpenChange(false)}
          onSaved={(note) => {
            onSaved?.(note);
          }}
          onSubmitSaved={(note) => {
            onSaved?.(note);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
