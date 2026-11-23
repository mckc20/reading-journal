import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import SaveCancelBar from "@/components/SaveCancelBar";
import { CoverUploadField } from "@/components/redesign/CoverUploadField";
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
  const photoAlt = initialAuthor?.name || initialName || "Author photo";

  function handlePhotoChange(file: File) {
    setPhotoFile(file);
    setRemovePhoto(false);
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

  return (
    <form onSubmit={handleSubmit} className="rj-book-form">
      <div className="rj-book-form-scroll space-y-4">
        <div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
          <div className="max-w-40 space-y-2">
            <Label htmlFor="author-photo">Photo</Label>
            <CoverUploadField id="author-photo" label="Photo" shape="portrait" preview={currentPhotoUrl}
              previewAlt={photoAlt} fileName={photoFile?.name} disabled={saving} onFileChange={handlePhotoChange} />
            {currentPhotoUrl && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={handleRemovePhoto} disabled={saving}>
                <Trash2 aria-hidden="true" /> Remove photo
              </Button>
            )}
          </div>

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
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>

      <SaveCancelBar
        mode="creation-dialog"
        onCancel={handleCancel}
        saving={saving}
        saveDisabled={!values.name.trim()}
        saveLabel={submitLabel}
        savingLabel="Saving..."
      />
    </form>
  );
}
