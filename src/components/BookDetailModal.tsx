import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { Heart, Star, BookOpen, ImagePlus, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSeries } from "@/hooks/useSeries";
import { statusVariant } from "@/lib/utils";
import type {
  Book,
  BookStatus,
  BookLanguage,
  BookFormat,
  BookBelongsTo,
} from "@/types";

interface FormValues {
  title: string;
  author: string;
  status: BookStatus;
  genre: string;
  language: BookLanguage | "";
  format: BookFormat | "";
  belongs_to: BookBelongsTo | "";
  total_pages: string;
  total_chapters: string;
  current_page: string;
  current_chapter: string;
  date_started: string;
  date_finished: string;
  series_id: string;
  volume_number: string;
}

interface BookDetailModalProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (id: string, payload: Partial<Book>) => Promise<void>;
  onCoverChanged: (id: string, file: File) => Promise<void>;
  onDeleted: (id: string) => Promise<void>;
}

const STATUS_OPTIONS: BookStatus[] = [
  "Not Started",
  "Wishlist",
  "Up Next",
  "Reading",
  "Finished",
  "DNF",
];

export default function BookDetailModal({
  book,
  open,
  onOpenChange,
  onUpdated,
  onCoverChanged,
  onDeleted,
}: BookDetailModalProps) {
  const { series } = useSeries();
  const [isFavorite, setIsFavorite] = useState(false);
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { isDirty, dirtyFields },
  } = useForm<FormValues>();

  // Reset form whenever the book changes
  useEffect(() => {
    if (book) {
      setIsFavorite(book.is_favorite);
      setLocalRating(book.rating ?? null);
      setConfirmDelete(false);
      setErrorMsg(null);
      reset({
        title: book.title,
        author: book.author,
        status: book.status,
        genre: book.genre ?? "",
        language: book.language ?? "",
        format: book.format ?? "",
        belongs_to: book.belongs_to ?? "",
        total_pages: book.total_pages?.toString() ?? "",
        total_chapters: book.total_chapters?.toString() ?? "",
        current_page: book.current_page?.toString() ?? "",
        current_chapter: book.current_chapter?.toString() ?? "",
        date_started: book.date_started ?? "",
        date_finished: book.date_finished ?? "",
        series_id: book.series_id ?? "",
        volume_number: book.volume_number?.toString() ?? "",
      });
    }
  }, [book, reset]);

  const status = watch("status");
  const seriesId = watch("series_id");
  const showDateStarted = ["Reading", "Finished", "DNF"].includes(status);
  const showDateFinished = ["Finished", "DNF"].includes(status);

  async function toggleFavorite() {
    if (!book) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await onUpdated(book.id, { is_favorite: next });
    } catch {
      setIsFavorite(!next);
    }
  }

  async function handleRating(rating: number) {
    if (!book) return;
    const next = localRating === rating ? null : rating;
    setLocalRating(next);
    await onUpdated(book.id, { rating: next ?? undefined });
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!book) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingCover(true);
      setErrorMsg(null);
      await onCoverChanged(book.id, file);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update cover");
    } finally {
      setUploadingCover(false);
      // Reset input so the same file can be re-selected
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    if (!book) return;
    const payload: Partial<Book> = {};

    // Only send dirty fields
    if (dirtyFields.title) payload.title = values.title;
    if (dirtyFields.author) payload.author = values.author;
    if (dirtyFields.status) payload.status = values.status;
    if (dirtyFields.genre) payload.genre = values.genre || undefined;
    if (dirtyFields.language) payload.language = (values.language as BookLanguage) || undefined;
    if (dirtyFields.format) payload.format = (values.format as BookFormat) || undefined;
    if (dirtyFields.belongs_to) payload.belongs_to = (values.belongs_to as BookBelongsTo) || undefined;
    if (dirtyFields.total_pages) payload.total_pages = values.total_pages ? Number(values.total_pages) : undefined;
    if (dirtyFields.total_chapters) payload.total_chapters = values.total_chapters ? Number(values.total_chapters) : undefined;
    if (dirtyFields.current_page) payload.current_page = values.current_page ? Number(values.current_page) : undefined;
    if (dirtyFields.current_chapter) payload.current_chapter = values.current_chapter ? Number(values.current_chapter) : undefined;
    if (dirtyFields.date_started) payload.date_started = values.date_started || undefined;
    if (dirtyFields.date_finished) payload.date_finished = values.date_finished || undefined;
    if (dirtyFields.series_id) payload.series_id = values.series_id || undefined;
    if (dirtyFields.volume_number) payload.volume_number = values.volume_number ? Number(values.volume_number) : undefined;

    if (Object.keys(payload).length === 0) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      await onUpdated(book.id, payload);
      reset(values); // reset dirty state
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!book) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setDeleting(true);
      setErrorMsg(null);
      await onDeleted(book.id);
      onOpenChange(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete book");
    } finally {
      setDeleting(false);
    }
  }

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90svh] flex flex-col overflow-hidden">
        {/* Fixed header */}
        <DialogHeader className="shrink-0">
          <div className="flex items-start gap-3">
            <label
              htmlFor="cover-change"
              className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted cursor-pointer group"
            >
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingCover ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <ImagePlus className="h-4 w-4 text-white" />
                )}
              </div>
              <input
                id="cover-change"
                type="file"
                accept="image/*"
                className="sr-only"
                ref={coverInputRef}
                onChange={handleCoverChange}
                disabled={uploadingCover}
              />
            </label>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="line-clamp-2 leading-tight">
                {book.title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{book.author}</p>
              {book.isbn && (
                <a
                  href={`https://openlibrary.org/isbn/${book.isbn}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Open Library
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(status)}>{status}</Badge>
                <button
                  type="button"
                  onClick={toggleFavorite}
                  aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  className="rounded p-0.5 hover:bg-muted transition-colors"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      isFavorite
                        ? "fill-rose-500 text-rose-500"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="properties" className="flex flex-col min-h-0 flex-1">
          <TabsList className="shrink-0 w-full">
            <TabsTrigger value="properties" className="flex-1">
              Properties
            </TabsTrigger>
            <TabsTrigger value="journal" className="flex-1">
              Journal
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1">
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Properties tab */}
          <TabsContent value="properties" className="flex-1 min-h-0 flex flex-col">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 min-h-0 pr-2">
                <div className="space-y-4 py-1">
                  {/* Progress update (Reading only) */}
                  {status === "Reading" && (
                    <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                      <p className="text-sm font-medium">Update progress</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="current_page" className="text-xs">
                            Current page
                            {book.total_pages != null && (
                              <span className="text-muted-foreground"> / {book.total_pages}</span>
                            )}
                          </Label>
                          <Input
                            id="current_page"
                            type="number"
                            min={0}
                            max={book.total_pages ?? undefined}
                            {...register("current_page")}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="current_chapter" className="text-xs">
                            Current chapter
                            {book.total_chapters != null && (
                              <span className="text-muted-foreground"> / {book.total_chapters}</span>
                            )}
                          </Label>
                          <Input
                            id="current_chapter"
                            type="number"
                            min={0}
                            max={book.total_chapters ?? undefined}
                            {...register("current_chapter")}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rating */}
                  <div className="space-y-1.5">
                    <Label>Rating</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleRating(n)}
                          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                          className="rounded p-0.5 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`h-5 w-5 ${
                              localRating && n <= localRating
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label htmlFor="detail-title">Title</Label>
                    <Input id="detail-title" {...register("title", { required: true })} />
                  </div>

                  {/* Author */}
                  <div className="space-y-1.5">
                    <Label htmlFor="detail-author">Author</Label>
                    <Input id="detail-author" {...register("author", { required: true })} />
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Genre */}
                  <div className="space-y-1.5">
                    <Label htmlFor="detail-genre">Genre</Label>
                    <Input id="detail-genre" {...register("genre")} />
                  </div>

                  {/* Language */}
                  <div className="space-y-1.5">
                    <Label>Language</Label>
                    <Controller
                      name="language"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not set</SelectItem>
                            {(["German", "Spanish", "English"] as BookLanguage[]).map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Format */}
                  <div className="space-y-1.5">
                    <Label>Format</Label>
                    <Controller
                      name="format"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not set</SelectItem>
                            {(["eBook", "Audiobook", "Paperback", "Hardcover"] as BookFormat[]).map(
                              (f) => (
                                <SelectItem key={f} value={f}>
                                  {f}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Belongs to */}
                  <div className="space-y-1.5">
                    <Label>Belongs to</Label>
                    <Controller
                      name="belongs_to"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not set</SelectItem>
                            {(["Me", "Family", "Friends", "Library"] as BookBelongsTo[]).map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Pages / Chapters */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="detail-total_pages">Total pages</Label>
                      <Input id="detail-total_pages" type="number" min={1} {...register("total_pages")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="detail-total_chapters">Total chapters</Label>
                      <Input id="detail-total_chapters" type="number" min={1} {...register("total_chapters")} />
                    </div>
                  </div>

                  {/* Dates */}
                  {showDateStarted && (
                    <div className="space-y-1.5">
                      <Label htmlFor="detail-date_started">Date started</Label>
                      <Input id="detail-date_started" type="date" {...register("date_started")} />
                    </div>
                  )}
                  {showDateFinished && (
                    <div className="space-y-1.5">
                      <Label htmlFor="detail-date_finished">Date finished</Label>
                      <Input id="detail-date_finished" type="date" {...register("date_finished")} />
                    </div>
                  )}

                  {/* Series */}
                  <div className="space-y-1.5">
                    <Label>Series</Label>
                    <Controller
                      name="series_id"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {series.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Volume number */}
                  {seriesId && (
                    <div className="space-y-1.5">
                      <Label htmlFor="detail-volume_number">Volume number</Label>
                      <Input id="detail-volume_number" type="number" min={1} {...register("volume_number")} />
                    </div>
                  )}
                </div>
              </ScrollArea>

              {errorMsg && (
                <p className="text-sm text-destructive mt-2">{errorMsg}</p>
              )}
              <div className="mt-3 shrink-0 flex justify-between gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "Deleting…" : confirmDelete ? "Are you sure?" : "Delete"}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !isDirty}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Journal stub */}
          <TabsContent value="journal" className="flex-1">
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Journal coming in Phase 4
            </div>
          </TabsContent>

          {/* Analytics stub */}
          <TabsContent value="analytics" className="flex-1">
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Analytics coming in Phase 5
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
