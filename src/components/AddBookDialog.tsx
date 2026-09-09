import { useRef, useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { ImagePlus, ScanBarcode, Loader2 } from "lucide-react";
import AddAuthorDialog from "@/components/AddAuthorDialog";
import AuthorMultiSelect from "@/components/AuthorMultiSelect";
import BarcodeScanner from "@/components/BarcodeScanner";
import GenreMultiSelect from "@/components/GenreMultiSelect";
import { fetchBookByISBN } from "@/lib/bookLookup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SaveCancelBar from "@/components/SaveCancelBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { useSeries } from "@/hooks/useSeries";
import { mapGenreLabelsToIds } from "@/lib/genres";
import {
  formatPublicationDateInput,
  parsePublicationDateInput,
} from "@/lib/publicationDate";
import { parseVolumeNumberInput } from "@/lib/volumeNumbers";
import type {
  Book,
  BookStatus,
  BookLanguage,
  BookSource,
  BookFormat,
  BookMetadataSource,
} from "@/types";

interface FormValues {
  title: string;
  authors: string[];
  status: BookStatus;
  genres: string[];
  language: BookLanguage | "";
  format: BookFormat | "";
  source: BookSource | "";
  total_pages: string;
  current_page: string;
  publication_date: string;
  description: string;
  date_started: string;
  date_finished: string;
  series_id: string;
  volume_number: string;
}

interface AddBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSeriesId?: string;
  initialVolumeNumber?: number;
  onSaved?: (book: Book) => void;
}

const STATUS_OPTIONS: BookStatus[] = [
  "To Read",
  "Up Next",
  "Reading",
  "Finished",
  "DNF",
];

const SOURCE_OPTIONS: BookSource[] = ["Owned", "Family", "Friends", "Library"];

function getInitialFormValues(initialSeriesId?: string, initialVolumeNumber?: number): Partial<FormValues> {
  return {
    status: "To Read",
    authors: [],
    genres: [],
    series_id: initialSeriesId ?? "",
    volume_number: initialVolumeNumber ? String(initialVolumeNumber) : "",
  };
}

export default function AddBookDialog({
  open,
  onOpenChange,
  initialSeriesId,
  initialVolumeNumber,
  onSaved,
}: AddBookDialogProps) {
  const { addBook } = useBooksContext();
  const { genres } = useGenresContext();
  const { series, addSeries } = useSeries();

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [addingNewSeries, setAddingNewSeries] = useState(false);
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [pendingSeriesSelectionId, setPendingSeriesSelectionId] = useState<string | null>(null);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [authorDialogInitialName, setAuthorDialogInitialName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const [isbnStatus, setIsbnStatus] = useState<"idle" | "looking-up" | "error">("idle");
  const [isbnError, setIsbnError] = useState<string | null>(null);
  const [scannedIsbn, setScannedIsbn] = useState<string | null>(null);
  const [metadataSource, setMetadataSource] = useState<BookMetadataSource | null>(null);
  const [metadataSourceUrl, setMetadataSourceUrl] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: getInitialFormValues(initialSeriesId, initialVolumeNumber),
  });

  const status = watch("status");
  const seriesId = watch("series_id");

  // Revoke object URL on unmount / change
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  useEffect(() => {
    if (!pendingSeriesSelectionId) return;
    if (!series.some((item) => item.id === pendingSeriesSelectionId)) return;

    setValue("series_id", pendingSeriesSelectionId, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    clearErrors("root");
    setPendingSeriesSelectionId(null);
  }, [pendingSeriesSelectionId, series, setValue, clearErrors]);

  useEffect(() => {
    if (!open) return;
    setValue("series_id", initialSeriesId ?? "");
    setValue("volume_number", initialVolumeNumber ? String(initialVolumeNumber) : "");
  }, [initialSeriesId, initialVolumeNumber, open, setValue]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleIsbnLookup(isbn: string) {
    setShowScanner(false);
    setIsbnStatus("looking-up");
    setIsbnError(null);
    setMetadataSource(null);
    setMetadataSourceUrl(null);

    try {
      const bookData = await fetchBookByISBN(isbn.trim());
      if (!bookData) {
        setIsbnStatus("error");
        setIsbnError(`No book found for ISBN ${isbn}`);
        return;
      }

      setScannedIsbn(isbn.trim());
      setMetadataSource(bookData.metadataSource);
      setMetadataSourceUrl(bookData.metadataSourceUrl);
      setValue("title", bookData.title);
      setValue("authors", bookData.authors, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      if (bookData.totalPages) setValue("total_pages", String(bookData.totalPages));
      if (bookData.publicationDate) {
        setValue("publication_date", formatPublicationDateInput(bookData.publicationDate));
      }
      if (bookData.description) setValue("description", bookData.description);
      if (bookData.genres) {
        setValue("genres", mapGenreLabelsToIds(bookData.genres, genres), {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
      if (bookData.language) setValue("language", bookData.language as BookLanguage);
      if (bookData.format) setValue("format", bookData.format as BookFormat);

      // Download cover image as a File for the existing upload flow
      if (bookData.coverUrl) {
        try {
          const res = await fetch(bookData.coverUrl);
          if (res.ok) {
            const blob = await res.blob();
            // Only use the cover if it's a real image (not a 1x1 placeholder)
            if (blob.size > 1000) {
              const file = new File([blob], `cover-${isbn}.jpg`, { type: "image/jpeg" });
              if (coverPreview) URL.revokeObjectURL(coverPreview);
              setCoverFile(file);
              setCoverPreview(URL.createObjectURL(file));
            }
          }
        } catch {
          // Non-critical — text fields are still filled
        }
      }

      setIsbnStatus("idle");
    } catch {
      setIsbnStatus("error");
      setIsbnError("Failed to look up book. Please try again or enter details manually.");
    }
  }

  async function handleAddNewSeries() {
    const trimmedSeriesName = newSeriesName.trim();
    if (!trimmedSeriesName || isCreatingSeries) return;

    setIsCreatingSeries(true);
    try {
      const created = await addSeries(trimmedSeriesName);
      setPendingSeriesSelectionId(created.id);
      setNewSeriesName("");
      setAddingNewSeries(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create series. Please try again.";
      setError("root", { message });
    } finally {
      setIsCreatingSeries(false);
    }
  }

  function handleCreateAuthor(initialName: string) {
    setAuthorDialogInitialName(initialName);
    setAuthorDialogOpen(true);
  }

  function handleSavedAuthor(authorName: string) {
    const currentAuthors = watch("authors");
    const nextAuthors = Array.from(
      new Map(
        [...currentAuthors, authorName]
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => [name.toLowerCase(), name] as const),
      ).values(),
    );
    setValue("authors", nextAuthors, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  async function onSubmit(values: FormValues) {
    try {
      const authors = values.authors.map((author) => author.trim()).filter(Boolean);
      if (authors.length === 0) {
        setError("authors", { message: "At least one author is required" });
        return;
      }
      const parsedPublicationDate = parsePublicationDateInput(values.publication_date);
      if (values.publication_date.trim() && !parsedPublicationDate) {
        setError("publication_date", {
          message: "Use a four-digit year, like 2020.",
        });
        return;
      }
      const parsedVolumeNumber = values.volume_number
        ? parseVolumeNumberInput(values.volume_number)
        : null;
      if (values.volume_number && parsedVolumeNumber === null) {
        setError("volume_number", {
          message: "Use a positive number with at most two decimal places.",
        });
        return;
      }
      const result = await addBook(
        {
          title: values.title,
          authors,
          status: values.status,
          genre_ids: values.genres,
          language: (values.language as BookLanguage) || undefined,
          format: (values.format as BookFormat) || undefined,
          source: (values.source as BookSource) || undefined,
          total_pages: values.total_pages ? Number(values.total_pages) : undefined,
          current_page: values.current_page ? Number(values.current_page) : undefined,
          publication_date: parsedPublicationDate?.date,
          description: values.description.trim() || undefined,
          date_started: values.date_started || undefined,
          date_finished: values.date_finished || undefined,
          series_id: values.series_id || undefined,
          volume_number: parsedVolumeNumber ?? undefined,
          isbn: scannedIsbn || undefined,
          metadata_source: metadataSource || undefined,
          metadata_source_url: metadataSourceUrl || undefined,
          is_favorite: false,
        },
        coverFile ?? undefined
      );

      if (result.warning) {
        onSaved?.(result.book);
        reset(getInitialFormValues(initialSeriesId, initialVolumeNumber));
        setCoverFile(null);
        setCoverPreview(null);
        setShowScanner(false);
        setManualIsbn("");
        setIsbnStatus("idle");
        setIsbnError(null);
        setScannedIsbn(null);
        setMetadataSource(null);
        setMetadataSourceUrl(null);
        setAddingNewSeries(false);
        setNewSeriesName("");
        setIsCreatingSeries(false);
        setPendingSeriesSelectionId(null);
        setError("root", { message: result.warning });
        return;
      }

      onSaved?.(result.book);
      reset(getInitialFormValues(initialSeriesId, initialVolumeNumber));
      setCoverFile(null);
      setCoverPreview(null);
      setShowScanner(false);
      setManualIsbn("");
      setIsbnStatus("idle");
      setIsbnError(null);
      setScannedIsbn(null);
      setMetadataSource(null);
      setMetadataSourceUrl(null);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to add book";
      setError("root", { message });
    }
  }

  const showDateStarted = ["Reading", "Finished", "DNF"].includes(status);
  const showDateFinished = ["Finished", "DNF"].includes(status);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset({
        ...getInitialFormValues(initialSeriesId, initialVolumeNumber),
      });
      setCoverFile(null);
      setCoverPreview(null);
      setShowScanner(false);
      setManualIsbn("");
      setIsbnStatus("idle");
      setIsbnError(null);
      setScannedIsbn(null);
      setMetadataSource(null);
      setMetadataSourceUrl(null);
      setAddingNewSeries(false);
      setNewSeriesName("");
      setIsCreatingSeries(false);
      setPendingSeriesSelectionId(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add Book</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border bg-card p-5 pb-28">
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-1">
              {/* ISBN Scanner */}
              {showScanner ? (
                <BarcodeScanner
                  onScan={handleIsbnLookup}
                  onClose={() => setShowScanner(false)}
                />
              ) : (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => { setShowScanner(true); setIsbnError(null); }}
                    disabled={isbnStatus === "looking-up"}
                  >
                    <ScanBarcode className="h-4 w-4" />
                    Scan ISBN barcode
                  </Button>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Or enter ISBN manually"
                      value={manualIsbn}
                      onChange={(e) => setManualIsbn(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (manualIsbn.trim()) handleIsbnLookup(manualIsbn);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!manualIsbn.trim() || isbnStatus === "looking-up"}
                      onClick={() => handleIsbnLookup(manualIsbn)}
                    >
                      Look up
                    </Button>
                  </div>
                </div>
              )}

              {isbnStatus === "looking-up" && (
                <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up book…
                </p>
              )}

              {isbnError && (
                <p className="text-sm text-destructive text-center">{isbnError}</p>
              )}

              {/* Cover, title, authors, and genres match the Edit book layout. */}
              <div className="grid gap-5 md:grid-cols-[7.5rem_minmax(0,1fr)] lg:grid-cols-[8.5rem_minmax(0,1fr)]">
                <div className="md:row-span-3 md:self-start">
                <label
                  htmlFor="cover-upload"
                  className="group relative flex aspect-[2/3] w-[min(7rem,38vw)] cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-muted shadow-sm sm:w-28 md:w-full"
                >
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <ImagePlus className="h-5 w-5 text-white" />
                  </div>
                </label>
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                {coverFile && <p className="mt-2 truncate text-xs text-muted-foreground">{coverFile.name}</p>}
                </div>

                <div className="min-w-0 space-y-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      {...register("title", { required: "Title is required" })}
                      aria-invalid={!!errors.title}
                    />
                    {errors.title && (
                      <p className="text-xs text-destructive">{errors.title.message}</p>
                    )}
                  </div>

                  {/* Authors */}
                  <div className="space-y-1.5">
                    <Label>Authors *</Label>
                    <Controller
                      name="authors"
                      control={control}
                      rules={{
                        validate: (value) => (value?.length ?? 0) > 0 || "At least one author is required",
                      }}
                      render={({ field }) => (
                        <AuthorMultiSelect
                          value={field.value ?? []}
                          onChange={field.onChange}
                          onCreateNew={handleCreateAuthor}
                        />
                      )}
                    />
                  {errors.authors && (
                      <p className="text-xs text-destructive">{errors.authors.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Genres</Label>
                    <Controller
                      name="genres"
                      control={control}
                      render={({ field }) => (
                        <GenreMultiSelect value={field.value ?? []} onChange={field.onChange} />
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Status is Add-only, but follows the same Edit metadata grid. */}
                <div className="order-0 space-y-1.5">
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

              {/* Language */}
              <div className="order-1 space-y-1.5">
                <Label>Language</Label>
                <Controller
                  name="language"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
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

              {/* Secondary metadata */}
              <div className="contents">
                <div className="order-3 space-y-1.5">
                  <Label htmlFor="publication_date">Publication year</Label>
                  <Input
                    id="publication_date"
                    placeholder="YYYY"
                    inputMode="numeric"
                    maxLength={4}
                    aria-invalid={!!errors.publication_date}
                    {...register("publication_date", {
                      onChange: () => clearErrors("publication_date"),
                    })}
                  />
                  {errors.publication_date && (
                    <p className="text-xs text-destructive">
                      {errors.publication_date.message}
                    </p>
                  )}
                </div>

                <div className="order-4 space-y-1.5">
                  <Label>Format</Label>
                  <Controller
                    name="format"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select format" />
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

                <div className="order-5 space-y-1.5">
                  <Label>Source</Label>
                  <Controller
                    name="source"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not set</SelectItem>
                          {SOURCE_OPTIONS.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="order-6 space-y-1.5">
                  <Label>ISBN</Label>
                  <Input value={scannedIsbn ?? manualIsbn} readOnly placeholder="Scanned or looked up ISBN" />
                </div>
              </div>

              <div className="order-12 space-y-1.5 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={5} {...register("description")} />
              </div>

              {/* Pages */}
              <div className="order-2 space-y-1.5">
                <Label htmlFor="total_pages">Total pages</Label>
                <Input
                  id="total_pages"
                  type="number"
                  min={1}
                  {...register("total_pages")}
                />
              </div>

              {/* Current progress (Reading only) */}
              {status === "Reading" && (
                <div className="order-7 space-y-1.5">
                  <Label htmlFor="current_page">Current page</Label>
                  <Input
                    id="current_page"
                    type="number"
                    min={0}
                    {...register("current_page")}
                  />
                </div>
              )}

              {/* Dates (conditional) */}
              {showDateStarted && (
                <div className="order-8 space-y-1.5">
                  <Label htmlFor="date_started">Date started</Label>
                  <Input id="date_started" type="date" {...register("date_started")} />
                </div>
              )}
              {showDateFinished && (
                <div className="order-9 space-y-1.5">
                  <Label htmlFor="date_finished">Date finished</Label>
                  <Input id="date_finished" type="date" {...register("date_finished")} />
                </div>
              )}

              {/* Series */}
              <div className="order-10 space-y-1.5">
                <Label>Series</Label>
                <Controller
                  name="series_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={(v) => {
                        if (v === "__new__") {
                          setAddingNewSeries(true);
                        } else if (v === "__none__") {
                          field.onChange("");
                        } else {
                          field.onChange(v);
                        }
                      }}
                    >
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
                        <SelectItem value="__new__">+ Add new series…</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {addingNewSeries && (
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="Series name"
                      value={newSeriesName}
                      onChange={(e) => setNewSeriesName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddNewSeries())}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddNewSeries}
                      disabled={isCreatingSeries || !newSeriesName.trim()}
                    >
                      {isCreatingSeries ? "Adding..." : "Add"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isCreatingSeries}
                      onClick={() => setAddingNewSeries(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {/* Volume number (conditional) */}
              {seriesId && seriesId !== "__new__" && (
                <div className="order-11 space-y-1.5 sm:max-w-[10rem]">
                  <Label htmlFor="volume_number">Volume number</Label>
                  <Input
                    id="volume_number"
                    type="number"
                    min={0.01}
                    step="0.01"
                    {...register("volume_number")}
                  />
                  {errors.volume_number && (
                    <p className="text-xs text-destructive">{errors.volume_number.message}</p>
                  )}
                </div>
              )}

              {/* Root error */}
              {errors.root && (
                <p className="order-[13] text-sm text-destructive">{errors.root.message}</p>
              )}
              </div>
            </div>
          </ScrollArea>

          <SaveCancelBar
            mode="dialog"
            onCancel={() => onOpenChange(false)}
            saving={isSubmitting}
            saveLabel="Add Book"
          />
        </form>
      </DialogContent>
      <AddAuthorDialog
        open={authorDialogOpen}
        onOpenChange={setAuthorDialogOpen}
        initialName={authorDialogInitialName}
        onSaved={(author) => handleSavedAuthor(author.name)}
      />
    </Dialog>
  );
}
