import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Heart,
  ImagePlus,
  RefreshCw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import {
  formatAuthorsInput,
  formatGenresInput,
  parseAuthorsInput,
  parseGenresInput,
} from "@/lib/utils";
import ReadingProgressDialog from "@/components/ReadingProgressDialog";
import BookAnalyticsPanel from "@/components/BookAnalyticsPanel";
import GenreTags from "@/components/GenreTags";
import type {
  Book,
  BookStatus,
  BookLanguage,
  BookFormat,
  BookBelongsTo,
} from "@/types";

interface FormValues {
  title: string;
  authorsInput: string;
  status: BookStatus;
  genresInput: string;
  isbn: string;
  language: BookLanguage | "";
  format: BookFormat | "";
  belongs_to: BookBelongsTo | "";
  total_pages: string;
  date_started: string;
  date_finished: string;
  series_id: string;
  volume_number: string;
}

const STATUS_OPTIONS: BookStatus[] = [
  "Not Started",
  "Wishlist",
  "Up Next",
  "Reading",
  "Finished",
  "DNF",
];

function bookToFormValues(book: Book): FormValues {
  return {
    title: book.title,
    authorsInput: formatAuthorsInput(book.authors),
    status: book.status,
    genresInput: formatGenresInput(book.genres),
    isbn: book.isbn ?? "",
    language: book.language ?? "",
    format: book.format ?? "",
    belongs_to: book.belongs_to ?? "",
    total_pages: book.total_pages?.toString() ?? "",
    date_started: book.date_started ?? "",
    date_finished: book.date_finished ?? "",
    series_id: book.series_id ?? "",
    volume_number: book.volume_number?.toString() ?? "",
  };
}

export default function BookDetails() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { books, loading, error, updateBook, updateCover, deleteBook, reload } = useBooksContext();
  const { series } = useSeries();

  const book = bookId ? books.find((item) => item.id === bookId) ?? null : null;
  const seriesName = book?.series_id
    ? series.find((item) => item.id === book.series_id)?.name
    : undefined;

  const [isFavorite, setIsFavorite] = useState(false);
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
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
    formState: { isDirty, dirtyFields, errors },
  } = useForm<FormValues>();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [bookId]);

  useEffect(() => {
    if (!book) return;
    setIsFavorite(book.is_favorite);
    setLocalRating(book.rating ?? null);
    setIsEditMode(false);
    setConfirmDelete(false);
    setErrorMsg(null);
    reset(bookToFormValues(book));
  }, [book, reset]);

  const status = watch("status") ?? book?.status ?? "Not Started";
  const seriesId = watch("series_id");
  const genresInput = watch("genresInput") ?? "";
  const parsedGenres = parseGenresInput(genresInput);
  const showDateStarted = ["Reading", "Finished", "DNF"].includes(status);
  const showDateFinished = ["Finished", "DNF"].includes(status);

  const currentPage = book?.current_page ?? 0;
  const totalPages = book?.total_pages ?? 0;
  const progressPercent =
    totalPages > 0
      ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)))
      : 0;

  function exitEditMode() {
    if (!book) return;
    reset(bookToFormValues(book));
    setConfirmDelete(false);
    setErrorMsg(null);
    setIsEditMode(false);
  }

  async function toggleFavorite() {
    if (!book) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await updateBook(book.id, { is_favorite: next });
    } catch {
      setIsFavorite(!next);
    }
  }

  async function handleRating(rating: number) {
    if (!book) return;
    const next = localRating === rating ? null : rating;
    setLocalRating(next);
    await updateBook(book.id, { rating: next ?? undefined });
  }

  async function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    if (!book) return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingCover(true);
      setErrorMsg(null);
      await updateCover(book.id, file);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update cover");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    if (!book) return;
    const payload: Partial<Book> = {};

    if (dirtyFields.title) payload.title = values.title;
    if (dirtyFields.authorsInput) {
      const authors = parseAuthorsInput(values.authorsInput);
      if (authors.length === 0) {
        setErrorMsg("At least one author is required");
        return;
      }
      payload.authors = authors;
    }
    if (dirtyFields.status) payload.status = values.status;
    if (dirtyFields.genresInput) {
      const genres = parseGenresInput(values.genresInput);
      payload.genres = genres.length > 0 ? genres : undefined;
    }
    if (dirtyFields.isbn) payload.isbn = values.isbn.trim() || undefined;
    if (dirtyFields.language) payload.language = (values.language as BookLanguage) || undefined;
    if (dirtyFields.format) payload.format = (values.format as BookFormat) || undefined;
    if (dirtyFields.belongs_to) payload.belongs_to = (values.belongs_to as BookBelongsTo) || undefined;
    if (dirtyFields.total_pages) payload.total_pages = values.total_pages ? Number(values.total_pages) : undefined;
    if (dirtyFields.date_started) payload.date_started = values.date_started || undefined;
    if (dirtyFields.date_finished) payload.date_finished = values.date_finished || undefined;
    if (dirtyFields.series_id) payload.series_id = values.series_id || undefined;
    if (dirtyFields.volume_number) payload.volume_number = values.volume_number ? Number(values.volume_number) : undefined;

    if (Object.keys(payload).length === 0) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      await updateBook(book.id, payload);
      reset(values);
      setIsEditMode(false);
      setConfirmDelete(false);
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
      await deleteBook(book.id);
      navigate("/library", { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete book");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
          <div className="space-y-3">
            <div className="h-8 w-4/5 animate-pulse rounded-md bg-muted" />
            <div className="h-5 w-2/3 animate-pulse rounded-md bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="text-lg font-heading leading-snug font-medium">Book not found</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          This book may not exist, may have been deleted, or you may not have access.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link to="/library">Back to Library</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="px-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
        <div className="mx-auto w-full max-w-[220px]">
          <label
            htmlFor="cover-change"
            className={`relative block aspect-[2/3] overflow-hidden rounded-xl border bg-muted group ${
              isEditMode ? "cursor-pointer" : "cursor-default"
            }`}
          >
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${
                isEditMode ? "opacity-0 group-hover:opacity-100" : "opacity-0"
              }`}
            >
              {uploadingCover ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <ImagePlus className="h-5 w-5 text-white" />
              )}
            </div>
            <input
              id="cover-change"
              type="file"
              accept="image/*"
              className="sr-only"
              ref={coverInputRef}
              onChange={handleCoverChange}
              disabled={uploadingCover || !isEditMode}
            />
          </label>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            {seriesName && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="w-fit">
                  {seriesName}
                </Badge>
                {book.volume_number != null && (
                  <Badge variant="secondary" className="w-fit">
                    Vol. {book.volume_number}
                  </Badge>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-start gap-2">
              <h1 className="text-3xl font-heading leading-snug font-medium">
                {book.title}
              </h1>
              <button
                type="button"
                onClick={toggleFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                className="mt-2 shrink-0 rounded p-0.5 hover:bg-muted transition-colors"
              >
                <Heart
                  className={`h-5 w-5 ${
                    isFavorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
            <p className="text-base text-muted-foreground">{book.authors.join(", ")}</p>

            {book.isbn && (
              <a
                href={`https://books.google.com/books?vid=ISBN${book.isbn}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Open in Google Books
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            <div className="flex items-center gap-1">
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

          <section className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <h2 className="text-sm font-heading leading-snug font-medium">Reading progress</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border bg-background/80 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="text-sm font-medium">{status}</p>
              </div>
              <div className="rounded-md border bg-background/80 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current page</p>
                <p className="text-sm font-medium">{currentPage}</p>
              </div>
              <div className="rounded-md border bg-background/80 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total pages</p>
                <p className="text-sm font-medium">{totalPages || "-"}</p>
              </div>
              <div className="rounded-md border bg-background/80 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Progress</p>
                <p className="text-sm font-medium">{progressPercent}%</p>
              </div>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
            {status === "Reading" && (
              <ReadingProgressDialog
                book={book}
                onProgressSaved={async (newPage) => {
                  await updateBook(book.id, { current_page: newPage });
                }}
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    Update progress
                  </Button>
                }
              />
            )}
          </section>
        </div>
      </div>

      <Tabs defaultValue="properties" className="flex flex-col min-h-0">
        <TabsList className="w-full">
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

        <TabsContent value="properties">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-xl border p-4">
              <ScrollArea className="max-h-[62svh] pr-2">
                <div className="grid gap-4 md:grid-cols-2 py-1">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="detail-title">Title</Label>
                    <Input
                      id="detail-title"
                      readOnly={!isEditMode}
                      {...register("title", { required: true })}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="detail-authors">Authors</Label>
                    <Input
                      id="detail-authors"
                      readOnly={!isEditMode}
                      {...register("authorsInput", {
                        validate: (value) =>
                          parseAuthorsInput(value).length > 0 || "At least one author is required",
                      })}
                    />
                    {errors.authorsInput && (
                      <p className="text-xs text-destructive">{errors.authorsInput.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!isEditMode}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="detail-total_pages">Total pages</Label>
                    <Input
                      id="detail-total_pages"
                      type="number"
                      min={1}
                      readOnly={!isEditMode}
                      {...register("total_pages")}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="detail-genresInput">Genres</Label>
                    {isEditMode ? (
                      <Input id="detail-genresInput" {...register("genresInput")} />
                    ) : (
                      <div className="min-h-9 rounded-md px-0.5 py-1">
                        <GenreTags genres={parsedGenres} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Language</Label>
                    <Controller
                      name="language"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value || "__none__"}
                          onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                          disabled={!isEditMode}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not set</SelectItem>
                            {(["German", "Spanish", "English"] as BookLanguage[]).map((language) => (
                              <SelectItem key={language} value={language}>
                                {language}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Format</Label>
                    <Controller
                      name="format"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value || "__none__"}
                          onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                          disabled={!isEditMode}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not set</SelectItem>
                            {(["eBook", "Audiobook", "Paperback", "Hardcover"] as BookFormat[]).map((format) => (
                              <SelectItem key={format} value={format}>
                                {format}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Belongs to</Label>
                    <Controller
                      name="belongs_to"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value || "__none__"}
                          onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                          disabled={!isEditMode}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not set</SelectItem>
                            {(["Me", "Family", "Friends", "Library"] as BookBelongsTo[]).map((belongsTo) => (
                              <SelectItem key={belongsTo} value={belongsTo}>
                                {belongsTo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {showDateStarted && (
                    <div className="space-y-1.5">
                      <Label htmlFor="detail-date_started">Date started</Label>
                      <Input
                        id="detail-date_started"
                        type="date"
                        readOnly={!isEditMode}
                        {...register("date_started")}
                      />
                    </div>
                  )}

                  {showDateFinished && (
                    <div className="space-y-1.5">
                      <Label htmlFor="detail-date_finished">Date finished</Label>
                      <Input
                        id="detail-date_finished"
                        type="date"
                        readOnly={!isEditMode}
                        {...register("date_finished")}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Series</Label>
                    <Controller
                      name="series_id"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value || "__none__"}
                          onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                          disabled={!isEditMode}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {series.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {seriesId && (
                    <div className="space-y-1.5">
                      <Label htmlFor="detail-volume_number">Volume number</Label>
                      <Input
                        id="detail-volume_number"
                        type="number"
                        min={0.5}
                        step="any"
                        readOnly={!isEditMode}
                        {...register("volume_number")}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="detail-isbn">ISBN</Label>
                    <Input
                      id="detail-isbn"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="978..."
                      readOnly={!isEditMode}
                      {...register("isbn")}
                    />
                  </div>
                </div>
              </ScrollArea>

              {errorMsg && <p className="mt-3 text-sm text-destructive">{errorMsg}</p>}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                {isEditMode ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleting}
                      onClick={handleDelete}
                    >
                      {deleting ? "Deleting..." : confirmDelete ? "Are you sure?" : "Delete"}
                    </Button>
                    <div className="ml-auto flex items-center gap-2">
                      <Button type="submit" size="sm" disabled={saving || !isDirty}>
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving || deleting}
                        onClick={exitEditMode}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="ml-auto">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setConfirmDelete(false);
                        setErrorMsg(null);
                        setIsEditMode(true);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="journal">
          <div className="flex h-32 items-center justify-center rounded-xl border text-sm text-muted-foreground">
            Journal coming in Phase 4
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="min-h-0">
          <div className="rounded-xl border p-2 sm:p-3">
            <BookAnalyticsPanel book={book} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
