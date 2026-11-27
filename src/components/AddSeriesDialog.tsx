import { AppHeading } from "@/components/design";
import { useEffect, useState, type FormEvent } from "react";
import { Layers, Trash2 } from "lucide-react";
import { CreationDialogContent } from "@/components/redesign/CreationDialogContent";
import { CoverUploadField } from "@/components/redesign/CoverUploadField";
import { Dialog } from "@/components/ui/dialog";
import SaveCancelBar from "@/components/SaveCancelBar";
import type { AddBookDialogLaunchOptions } from "@/components/AppLayout";
import SeriesBooksEditor, {
  buildEditableSeriesBooks,
  parseVolumeInput,
  type EditableSeriesBook,
} from "@/components/series/SeriesBooksEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { deleteSeriesBanner, uploadSeriesBanner, type SeriesInput } from "@/lib/books";
import type { Series } from "@/types";

interface AddSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  openAddBook: (options?: AddBookDialogLaunchOptions, trigger?: HTMLElement) => void;
  initialSeries?: Series;
  onUpdateSeries?: (id: string, payload: Partial<SeriesInput>) => Promise<Series>;
  onSaved?: (series: Series) => void;
}

function getNextVolume(rows: EditableSeriesBook[]): number {
  const visibleRows = rows.filter((row) => !row.removed);
  const largestVolume = visibleRows.reduce((largest, row) => {
    const volume = parseVolumeInput(row.volumeInput);
    return volume === null ? largest : Math.max(largest, volume);
  }, 0);
  return largestVolume + 1 || visibleRows.length + 1;
}

export default function AddSeriesDialog({ open, onOpenChange, onCloseAutoFocus, openAddBook, initialSeries, onUpdateSeries, onSaved }: AddSeriesDialogProps) {
  const { user } = useAuth();
  const { addSeries, editSeries } = useSeries();
  const { books, updateBookSeriesPlacement, updateBookVolumeNumber } = useBooksContext();
  const updateSeries = onUpdateSeries ?? editSeries;
  const [name, setName] = useState(initialSeries?.name ?? "");
  const [description, setDescription] = useState(initialSeries?.description ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [rows, setRows] = useState<EditableSeriesBook[]>(() => initialSeries
    ? buildEditableSeriesBooks(books.filter((book) => book.series_id === initialSeries.id))
    : []);
  const [draftSeries, setDraftSeries] = useState<Series | null>(initialSeries ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownCover = coverPreview ?? (removeCover ? null : draftSeries?.cover_url ?? null);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function handleFileChange(file: File) {
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);
  }

  function handleRemoveBanner() {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
  }

  async function saveSeriesFields(series: Series, coverUrl?: string | null) {
    const payload: Partial<SeriesInput> = {};
    if (name.trim() !== series.name) payload.name = name.trim();
    const bio = description.trim() || null;
    if (bio !== (series.description ?? null)) payload.description = bio;
    if (coverUrl !== undefined && coverUrl !== (series.cover_url ?? null)) payload.cover_url = coverUrl;
    if (!Object.keys(payload).length) return series;

    const saved = await updateSeries(series.id, payload);
    setDraftSeries(saved);
    return saved;
  }

  async function ensureDraftSeries(): Promise<Series> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Add a series name before creating a book.");

    if (draftSeries) {
      return saveSeriesFields(draftSeries);
    }

    const created = await addSeries({
      name: trimmedName,
      description: description.trim() || null,
    });
    setDraftSeries(created);
    return created;
  }

  async function handleCreateBook(trigger: HTMLButtonElement) {
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const seriesRecord = initialSeries ?? await ensureDraftSeries();
      const nextVolume = getNextVolume(rows);
      openAddBook({
        initialSeriesId: seriesRecord.id,
        initialVolumeNumber: nextVolume,
        onSaved: (book) => {
          setRows((currentRows) => {
            if (currentRows.some((row) => row.book.id === book.id)) return currentRows;
            return [
              ...currentRows,
              {
                book,
                volumeInput: book.volume_number ? String(book.volume_number) : String(nextVolume),
                removed: false,
              },
            ];
          });
        },
      }, initialSeries ? trigger : undefined);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to prepare series.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;

    const invalidRow = rows.find((row) => !row.removed && parseVolumeInput(row.volumeInput) === null);
    if (invalidRow) {
      setError(`Add a positive volume number with at most two decimal places for "${invalidRow.book.title}" before saving.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let saved = initialSeries ? (draftSeries ?? initialSeries) : await ensureDraftSeries();
      let coverUrl: string | null | undefined = removeCover ? null : undefined;
      let keepExtension: string | undefined;

      if (coverFile) {
        try {
          if (!user) throw new Error("You must be signed in to upload a banner.");
          const upload = await uploadSeriesBanner(user.id, saved.id, coverFile);
          coverUrl = upload.publicUrl;
          keepExtension = upload.extension;
        } catch (uploadError) {
          if (initialSeries) throw uploadError;
        }
      }

      try {
        saved = await saveSeriesFields(saved, coverUrl);
      } catch (updateError) {
        if (initialSeries || !coverUrl) throw updateError;
        // Saving an optional banner should not prevent a new series from being added.
      }

      const booksById = new Map(books.map((book) => [book.id, book]));
      for (const row of rows) {
        const book = booksById.get(row.book.id) ?? row.book;
        if (row.removed) {
          if (book.series_id === saved.id) {
            await updateBookSeriesPlacement(book.id, {
              series_id: null,
              volume_number: null,
            });
          }
          continue;
        }

        const nextVolume = parseVolumeInput(row.volumeInput);
        if (book.series_id !== saved.id) {
          await updateBookSeriesPlacement(book.id, {
            series_id: saved.id,
            volume_number: nextVolume,
          });
        } else if (nextVolume !== null && nextVolume !== book.volume_number) {
          await updateBookVolumeNumber(book.id, nextVolume);
        }
      }

      if (user && (removeCover || (coverUrl && saved.cover_url === coverUrl))) {
        await deleteSeriesBanner(user.id, saved.id, keepExtension).catch(() => {});
      }
      onOpenChange(false);
      onSaved?.(saved);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save series.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <CreationDialogContent
        title={initialSeries ? "Edit series" : "Add Series"}
        description={initialSeries ? "Update the series details shown in your library." : "Create a series entry with a description and optional banner image."}
        icon={Layers}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <form onSubmit={handleSubmit} className="rj-book-form">
          <div className="rj-book-form-scroll">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="series-cover">Banner image</Label>
                  <CoverUploadField id="series-cover" label="Banner image" shape="banner" preview={shownCover}
                    fileName={coverFile?.name} disabled={saving} onFileChange={handleFileChange} />
                  {shownCover && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={handleRemoveBanner} disabled={saving}>
                      <Trash2 aria-hidden="true" /> Remove banner
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="series-name">Series name *</Label>
                  <Input
                    id="series-name"
                    value={name}
                    disabled={saving}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Series name"
                    aria-invalid={!name.trim() && saving ? true : undefined}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="series-description">Description</Label>
                  <Textarea
                    id="series-description"
                    rows={6}
                    value={description}
                    disabled={saving}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What is this series about?"
                  />
                </div>
              </div>

              <section className="space-y-3">
                <AppHeading level={4} as="h2" className="font-semibold"
                  info="Search for books, drag by the handle, edit volume numbers, or remove books from this series.">
                  Books in this series
                </AppHeading>
                <SeriesBooksEditor
                  rows={rows}
                  allBooks={books}
                  saving={saving}
                  enableSearch
                  emptyLabel={initialSeries ? "No books will remain in this series." : "No books are added to this series yet."}
                  removedLabel={(count) =>
                    `${count} book${count === 1 ? "" : "s"} will be removed from this series when you save.`
                  }
                  onRowsChange={setRows}
                  onCreateBook={handleCreateBook}
                />
              </section>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <SaveCancelBar
            mode="creation-dialog"
            onCancel={() => handleOpenChange(false)}
            saving={saving}
            saveDisabled={!name.trim()}
            saveLabel={initialSeries ? "Save changes" : "Add Series"}
          />
        </form>
      </CreationDialogContent>
    </Dialog>
  );
}
