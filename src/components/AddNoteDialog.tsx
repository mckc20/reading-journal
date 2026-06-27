import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useBooksContext } from "@/context/BooksContext";
import { createBookNote } from "@/lib/bookNotes";
import type { BookNoteLabel } from "@/types";

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormValues {
  bookId: string;
  label: BookNoteLabel;
  content: string;
  secondaryText: string;
  tags: string;
}

const NOTE_LABEL_OPTIONS: Array<{ value: BookNoteLabel; label: string }> = [
  { value: "quote", label: "Quote" },
  { value: "note", label: "Note" },
  { value: "review", label: "Review" },
];

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export default function AddNoteDialog({ open, onOpenChange }: AddNoteDialogProps) {
  const { user } = useAuth();
  const { books } = useBooksContext();
  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title)),
    [books],
  );
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    defaultValues: {
      bookId: "",
      label: "note",
      content: "",
      secondaryText: "",
      tags: "",
    },
  });

  const label = watch("label");

  async function onSubmit(values: FormValues) {
    if (!user) {
      setError("root", { message: "You must be signed in." });
      return;
    }

    try {
      await createBookNote({
        bookId: values.bookId,
        userId: user.id,
        label: values.label,
        content: values.content,
        title: values.label === "quote" ? undefined : values.secondaryText || undefined,
        quoteSpeaker: values.label === "quote" ? values.secondaryText || undefined : undefined,
        tags: parseTags(values.tags),
      });

      reset();
      onOpenChange(false);
    } catch (submitError) {
      setError("root", {
        message: submitError instanceof Error ? submitError.message : "Failed to add note.",
      });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset({
        bookId: "",
        label: "note",
        content: "",
        secondaryText: "",
        tags: "",
      });
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>
            Save a quote, note, or review and link it to one of your books.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="note-book">Related book *</Label>
              <Controller
                name="bookId"
                control={control}
                rules={{ required: "Choose a book." }}
                render={({ field }) => (
                  <Select
                    value={field.value || "__none__"}
                    onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a book" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Choose a book</SelectItem>
                      {sortedBooks.map((book) => (
                        <SelectItem key={book.id} value={book.id}>
                          {book.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.bookId && <p className="text-xs text-destructive">{errors.bookId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Controller
                name="label"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => field.onChange(value as BookNoteLabel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTE_LABEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note-secondary">
                {label === "quote" ? "Who said this?" : "Title"}
              </Label>
              <Input
                id="note-secondary"
                {...register("secondaryText")}
                placeholder={label === "quote" ? "Author or speaker" : "Optional title"}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note-content">Content *</Label>
              <Textarea
                id="note-content"
                rows={6}
                {...register("content", { required: "Note content is required." })}
                aria-invalid={!!errors.content}
              />
              {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note-tags">Tags</Label>
              <Input
                id="note-tags"
                {...register("tags")}
                placeholder="tag one, tag two"
              />
            </div>

            {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Add Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
