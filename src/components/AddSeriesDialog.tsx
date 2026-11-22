import { useEffect, useState, type FormEvent } from "react";
import { Layers } from "lucide-react";
import { CreationDialogContent } from "@/components/redesign/CreationDialogContent";
import { CoverUploadField } from "@/components/redesign/CoverUploadField";
import { Dialog } from "@/components/ui/dialog";
import SaveCancelBar from "@/components/SaveCancelBar";
import type { AddBookDialogLaunchOptions } from "@/components/AppLayout";
import SeriesBooksEditor, {
  parseVolumeInput,
  type EditableSeriesBook,
} from "@/components/series/SeriesBooksEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useBooksContext } from "@/context/BooksContext";
import { useSeries } from "@/hooks/useSeries";
import { deleteSeriesBanner, uploadSeriesBanner } from "@/lib/books";
import type { Series } from "@/types";

interface AddSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  openAddBook: (options?: AddBookDialogLaunchOptions) => void;
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

export default function AddSeriesDialog({ open, onOpenChange, onCloseAutoFocus, openAddBook, onSaved }: AddSeriesDialogProps) {
  const { user } = useAuth();
  const { addSeries, editSeries } = useSeries();
  const { books, updateBookSeriesPlacement } = useBooksContext();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<EditableSeriesBook[]>([]);
  const [draftSeries, setDraftSeries] = useState<Series | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function reset() {
    setName("");
    setDescription("");
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    setRows([]);
    setDraftSeries(null);
    setError(null);
    setSaving(false);
  }

  function handleFileChange(file: File) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function ensureDraftSeries(): Promise<Series> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Add a series name before creating a book.");

    if (draftSeries) {
      return editSeries(draftSeries.id, {
        name: trimmedName,
        description: description.trim() || null,
      });
    }

    const created = await addSeries({
      name: trimmedName,
      description: description.trim() || null,
    });
    setDraftSeries(created);
    return created;
  }

  async function handleCreateBook() {
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const seriesRecord = await ensureDraftSeries();
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
      });
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
      const created = draftSeries
        ? await editSeries(draftSeries.id, {
            name: trimmedName,
            description: description.trim() || null,
          })
        : await addSeries({
            name: trimmedName,
            description: description.trim() || null,
          });

      if (coverFile && user) {
        try {
          const { publicUrl, extension } = await uploadSeriesBanner(user.id, created.id, coverFile);
          const cover_url = publicUrl;
          await editSeries(created.id, { cover_url });
          await deleteSeriesBanner(user.id, created.id, extension).catch(() => {});
        } catch {
          // Banner upload is optional, so a failure should not block saving the series.
        }
      }

      for (const row of rows) {
        if (row.removed) {
          if (row.book.series_id === created.id) {
            await updateBookSeriesPlacement(row.book.id, {
              series_id: null,
              volume_number: null,
            });
          }
          continue;
        }

        const nextVolume = parseVolumeInput(row.volumeInput);
        if (nextVolume !== null) {
          await updateBookSeriesPlacement(row.book.id, {
            series_id: created.id,
            volume_number: nextVolume,
          });
        }
      }

      reset();
      onOpenChange(false);
      onSaved?.(created);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add series.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <CreationDialogContent
        title="Add Series"
        description="Create a series entry with a description and optional banner image."
        icon={Layers}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <form onSubmit={handleSubmit} className="rj-book-form">
          <div className="rj-book-form-scroll">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="series-cover">Banner image</Label>
                  <CoverUploadField id="series-cover" label="Banner image" shape="banner" preview={coverPreview}
                    fileName={coverFile?.name} onFileChange={handleFileChange} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="series-name">Series name *</Label>
                  <Input
                    id="series-name"
                    value={name}
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
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What is this series about?"
                  />
                </div>
              </div>

              <section className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold">Books in this series</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Search for books, drag by the handle, edit volume numbers, or remove books from this series.
                  </p>
                </div>
                <SeriesBooksEditor
                  rows={rows}
                  allBooks={books}
                  saving={saving}
                  enableSearch
                  emptyLabel="No books are added to this series yet."
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
            saveLabel="Add Series"
          />
        </form>
      </CreationDialogContent>
    </Dialog>
  );
}
