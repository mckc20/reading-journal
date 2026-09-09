import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import SaveCancelBar from "@/components/SaveCancelBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Author } from "@/types";

export type AuthorFormValues = {
  name: string;
  bio: string;
  is_favorite: boolean;
};

export type AuthorFormPayload = Omit<AuthorFormValues, "bio"> & {
  bio: string | null;
  photo_file: File | null;
  remove_photo: boolean;
};

interface AuthorFormProps {
  initialAuthor?: Author | null;
  initialName?: string;
  onSave: (payload: AuthorFormPayload) => Promise<Author>;
  onCancel: () => void;
  onSaved?: (author: Author) => void;
  submitLabel: string;
  mode?: "page" | "dialog";
}

function toFormValues(author?: Author | null, initialName = ""): AuthorFormValues {
  return {
    name: author?.name ?? initialName,
    bio: author?.bio ?? "",
    is_favorite: author?.is_favorite ?? false,
  };
}

export default function AuthorForm({
  initialAuthor,
  initialName = "",
  onSave,
  onCancel,
  onSaved,
  submitLabel,
  mode = "page",
}: AuthorFormProps) {
  const [values, setValues] = useState<AuthorFormValues>(() => toFormValues(initialAuthor, initialName));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(toFormValues(initialAuthor, initialName));
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setRemovePhoto(false);
    setError(null);
  }, [initialAuthor, initialName]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }

    const preview = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photoFile]);

  const currentPhotoUrl = removePhoto ? null : photoPreviewUrl ?? initialAuthor?.photo_url ?? null;
  const photoAlt = initialAuthor?.name ?? initialName ?? "Author photo";

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
    setRemovePhoto(false);
    event.target.value = "";
  }

  function handleRemovePhoto() {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setRemovePhoto(true);
  }

  function handleCancel() {
    if (saving) return;
    onCancel();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.name.trim() || saving) return;

    setSaving(true);
    setError(null);
    try {
      const saved = await onSave({
        name: values.name,
        bio: values.bio.trim() || null,
        is_favorite: values.is_favorite,
        photo_file: photoFile,
        remove_photo: removePhoto,
      });
      onSaved?.(saved);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save author.");
    } finally {
      setSaving(false);
    }
  }

  const photoField = (
    <div className="space-y-2">
      <Label>Photo</Label>
      <div className="flex flex-col items-start gap-2">
        <label className="group relative flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-muted">
          {currentPhotoUrl ? (
            <img src={currentPhotoUrl} alt={photoAlt} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-8 w-8 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground/70" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <ImagePlus className="h-5 w-5 text-white" />
          </div>
          <Input
            type="file"
            accept="image/*"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={handlePhotoChange}
            disabled={saving}
          />
        </label>
        {(currentPhotoUrl || photoFile) && (
          mode === "page" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Remove photo"
              onClick={handleRemovePhoto}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={handleRemovePhoto} className="gap-2 px-2" disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          )
        )}
        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, or AVIF. Click the image to upload.</p>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 pb-24">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
          {photoField}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="author-name">Name *</Label>
              <Input
                id="author-name"
                value={values.name}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                aria-invalid={!values.name.trim()}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="author-bio">Bio</Label>
          <Textarea
            id="author-bio"
            rows={5}
            value={values.bio}
            onChange={(event) => setValues((current) => ({ ...current, bio: event.target.value }))}
            disabled={saving}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <SaveCancelBar
        mode={mode === "dialog" ? "dialog" : "page"}
        onCancel={handleCancel}
        saving={saving}
        saveDisabled={!values.name.trim()}
        saveLabel={submitLabel}
        savingLabel="Saving..."
      />
    </form>
  );
}
