import { useRef, useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { ImagePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { BookStatus, BookLanguage, BookBelongsTo, BookFormat } from "@/types";

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

interface AddBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS: BookStatus[] = [
  "Not Started",
  "Wishlist",
  "Up Next",
  "Reading",
  "Finished",
  "DNF",
];

export default function AddBookDialog({ open, onOpenChange }: AddBookDialogProps) {
  const { addBook } = useBooksContext();
  const { series, addSeries } = useSeries();

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [addingNewSeries, setAddingNewSeries] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { status: "Not Started" },
  });

  const status = watch("status");
  const seriesId = watch("series_id");

  // Revoke object URL on unmount / change
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleAddNewSeries() {
    if (!newSeriesName.trim()) return;
    try {
      const created = await addSeries(newSeriesName.trim());
      setValue("series_id", created.id);
      setNewSeriesName("");
      setAddingNewSeries(false);
    } catch {
      // ignore — series list will just not update
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      await addBook(
        {
          title: values.title,
          author: values.author,
          status: values.status,
          genre: values.genre || undefined,
          language: (values.language as BookLanguage) || undefined,
          format: (values.format as BookFormat) || undefined,
          belongs_to: (values.belongs_to as BookBelongsTo) || undefined,
          total_pages: values.total_pages ? Number(values.total_pages) : undefined,
          total_chapters: values.total_chapters ? Number(values.total_chapters) : undefined,
          current_page: values.current_page ? Number(values.current_page) : undefined,
          current_chapter: values.current_chapter ? Number(values.current_chapter) : undefined,
          date_started: values.date_started || undefined,
          date_finished: values.date_finished || undefined,
          series_id: values.series_id || undefined,
          volume_number: values.volume_number ? Number(values.volume_number) : undefined,
          is_favorite: false,
        },
        coverFile ?? undefined
      );
      reset();
      setCoverFile(null);
      setCoverPreview(null);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Book</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-1">
              {/* Cover upload */}
              <div className="flex items-center gap-4">
                <label
                  htmlFor="cover-upload"
                  className="flex h-24 w-16 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 hover:border-primary/60 transition-colors overflow-hidden bg-muted"
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
                </label>
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Cover image</p>
                  <p className="text-xs text-muted-foreground">
                    {coverFile ? coverFile.name : "Click to upload"}
                  </p>
                </div>
              </div>

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

              {/* Author */}
              <div className="space-y-1.5">
                <Label htmlFor="author">Author *</Label>
                <Input
                  id="author"
                  {...register("author", { required: "Author is required" })}
                  aria-invalid={!!errors.author}
                />
                {errors.author && (
                  <p className="text-xs text-destructive">{errors.author.message}</p>
                )}
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
                <Label htmlFor="genre">Genre</Label>
                <Input id="genre" {...register("genre")} />
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

              {/* Format */}
              <div className="space-y-1.5">
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

              {/* Belongs to */}
              <div className="space-y-1.5">
                <Label>Belongs to</Label>
                <Controller
                  name="belongs_to"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select owner" />
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
                  <Label htmlFor="total_pages">Total pages</Label>
                  <Input
                    id="total_pages"
                    type="number"
                    min={1}
                    {...register("total_pages")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="total_chapters">Total chapters</Label>
                  <Input
                    id="total_chapters"
                    type="number"
                    min={1}
                    {...register("total_chapters")}
                  />
                </div>
              </div>

              {/* Current progress (Reading only) */}
              {status === "Reading" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="current_page">Current page</Label>
                    <Input
                      id="current_page"
                      type="number"
                      min={0}
                      {...register("current_page")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="current_chapter">Current chapter</Label>
                    <Input
                      id="current_chapter"
                      type="number"
                      min={0}
                      {...register("current_chapter")}
                    />
                  </div>
                </div>
              )}

              {/* Dates (conditional) */}
              {showDateStarted && (
                <div className="space-y-1.5">
                  <Label htmlFor="date_started">Date started</Label>
                  <Input id="date_started" type="date" {...register("date_started")} />
                </div>
              )}
              {showDateFinished && (
                <div className="space-y-1.5">
                  <Label htmlFor="date_finished">Date finished</Label>
                  <Input id="date_finished" type="date" {...register("date_finished")} />
                </div>
              )}

              {/* Series */}
              <div className="space-y-1.5">
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
                    <Button type="button" size="sm" onClick={handleAddNewSeries}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddingNewSeries(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {/* Volume number (conditional) */}
              {seriesId && seriesId !== "__new__" && (
                <div className="space-y-1.5">
                  <Label htmlFor="volume_number">Volume number</Label>
                  <Input
                    id="volume_number"
                    type="number"
                    min={1}
                    {...register("volume_number")}
                  />
                </div>
              )}

              {/* Root error */}
              {errors.root && (
                <p className="text-sm text-destructive">{errors.root.message}</p>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Add Book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
