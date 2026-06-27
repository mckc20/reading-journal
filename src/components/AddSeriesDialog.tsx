import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useSeries } from "@/hooks/useSeries";
import { uploadCover } from "@/lib/books";
import type { SeriesStatus } from "@/types";

interface AddSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SERIES_STATUS_OPTIONS: SeriesStatus[] = ["ongoing", "completed"];

function formatSeriesStatus(value: SeriesStatus): string {
  return value === "ongoing" ? "Ongoing" : "Completed";
}

export default function AddSeriesDialog({ open, onOpenChange }: AddSeriesDialogProps) {
  const { user } = useAuth();
  const { addSeries, editSeries } = useSeries();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<SeriesStatus>("ongoing");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function reset() {
    setName("");
    setStatus("ongoing");
    setDescription("");
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    setError(null);
    setSaving(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;

    setSaving(true);
    setError(null);

    try {
      const created = await addSeries({
        name: trimmedName,
        status,
        description: description.trim() || null,
      });

      if (coverFile && user) {
        try {
          const cover_url = await uploadCover(user.id, created.id, coverFile);
          await editSeries(created.id, { cover_url });
        } catch {
          // Cover upload is optional, so a failure should not block saving the series.
        }
      }

      reset();
      onOpenChange(false);
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Series</DialogTitle>
          <DialogDescription>
            Create a series entry with a description, status, and optional cover image.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label
                htmlFor="series-cover"
                className="flex h-24 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted transition-colors hover:border-primary/60"
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="Series cover preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                )}
              </label>
              <input
                ref={fileInputRef}
                id="series-cover"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Cover image</p>
                <p className="text-xs text-muted-foreground">
                  {coverFile ? coverFile.name : "Click to upload"}
                </p>
              </div>
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
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as SeriesStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERIES_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {formatSeriesStatus(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="series-description">Description</Label>
              <Textarea
                id="series-description"
                rows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this series about?"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Add Series"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
