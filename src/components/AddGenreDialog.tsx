import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenresContext } from "@/context/GenresContext";
import { getGenrePathLabel } from "@/lib/genreTree";

interface AddGenreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormValues {
  name: string;
  parentId: string;
  description: string;
}

export default function AddGenreDialog({ open, onOpenChange }: AddGenreDialogProps) {
  const { genres, addGenre } = useGenresContext();
  const sortedParents = useMemo(
    () =>
      [...genres].sort((first, second) =>
        getGenrePathLabel(first.id, genres).localeCompare(getGenrePathLabel(second.id, genres)),
      ),
    [genres],
  );
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      parentId: "",
      description: "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await addGenre({
        name: values.name,
        parent_id: values.parentId || null,
        description: values.description.trim() || null,
      });

      reset();
      onOpenChange(false);
    } catch (submitError) {
      setError("root", {
        message: submitError instanceof Error ? submitError.message : "Failed to add genre.",
      });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset({
        name: "",
        parentId: "",
        description: "",
      });
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Genre</DialogTitle>
          <DialogDescription>
            Create a new genre and optionally place it under an existing parent genre.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="genre-name">Genre name *</Label>
              <Input
                id="genre-name"
                {...register("name", { required: "Genre name is required." })}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Parent genre</Label>
              <Controller
                name="parentId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || "__none__"}
                    onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No parent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No parent</SelectItem>
                      {sortedParents.map((genre) => (
                        <SelectItem key={genre.id} value={genre.id}>
                          {getGenrePathLabel(genre.id, genres)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="genre-description">Description</Label>
              <Textarea
                id="genre-description"
                rows={4}
                {...register("description")}
                placeholder="Optional description"
              />
            </div>

            {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Add Genre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
