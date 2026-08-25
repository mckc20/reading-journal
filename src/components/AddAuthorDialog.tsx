import { useEffect, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { ImagePlus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthorsContext } from "@/context";
import type { Author } from "@/types";

type AuthorFormValues = {
  name: string;
  bio: string;
  is_favorite: boolean;
};

interface AddAuthorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAuthor?: Author | null;
  initialName?: string;
  onSaved?: (author: Author) => void;
}

function toFormValues(author?: Author | null, initialName = ""): AuthorFormValues {
  return {
    name: author?.name ?? initialName,
    bio: author?.bio ?? "",
    is_favorite: author?.is_favorite ?? false,
  };
}

export default function AddAuthorDialog({
  open,
  onOpenChange,
  initialAuthor,
  initialName = "",
  onSaved,
}: AddAuthorDialogProps) {
  const { addAuthor, editAuthor } = useAuthorsContext();
  const isEditing = Boolean(initialAuthor);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AuthorFormValues>({
    defaultValues: toFormValues(initialAuthor, initialName),
  });

  useEffect(() => {
    if (!open) {
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setRemovePhoto(false);
      return;
    }
    reset(toFormValues(initialAuthor, initialName));
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setRemovePhoto(false);
  }, [open, initialAuthor, initialName, reset]);

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

  async function onSubmit(values: AuthorFormValues) {
    const payload = {
      name: values.name,
      bio: values.bio.trim() || null,
      is_favorite: values.is_favorite,
      photo_file: photoFile,
      remove_photo: removePhoto,
    };

    const saved = isEditing && initialAuthor
      ? await editAuthor(initialAuthor.id, payload)
      : await addAuthor(payload);

    onSaved?.(saved);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Author" : "Add Author"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="author-name">Name *</Label>
            <Input
              id="author-name"
              {...register("name", { required: "Author name is required" })}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <div className="space-y-2">
              <Label>Photo</Label>
              <div className="flex flex-col items-start gap-2">
                <label className="group relative flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-muted">
                  {currentPhotoUrl ? (
                    <img src={currentPhotoUrl} alt={photoAlt} className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground/70" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                    <span className="sr-only">Upload photo</span>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={handlePhotoChange}
                  />
                </label>
                {(currentPhotoUrl || removePhoto || photoFile) && (
                  <Button type="button" variant="ghost" onClick={handleRemovePhoto} className="gap-2 px-2">
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, or AVIF. Click the image to upload.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    {...register("is_favorite")}
                  />
                  Favorite
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="author-bio">Bio</Label>
            <Textarea id="author-bio" rows={5} {...register("bio")} />
          </div>

          <DialogFooter showCloseButton={false}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add author"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
