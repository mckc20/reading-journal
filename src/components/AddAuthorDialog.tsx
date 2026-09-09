import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AuthorForm from "@/components/AuthorForm";
import { useAuthorsContext } from "@/context";
import type { Author } from "@/types";

interface AddAuthorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAuthor?: Author | null;
  initialName?: string;
  onSaved?: (author: Author) => void;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto pb-24 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Author" : "Add Author"}</DialogTitle>
        </DialogHeader>

        <AuthorForm
          key={`${open}-${initialAuthor?.id ?? initialName}`}
          initialAuthor={initialAuthor}
          initialName={initialName}
          mode="dialog"
          submitLabel={isEditing ? "Save changes" : "Add author"}
          onCancel={() => onOpenChange(false)}
          onSave={(payload) =>
            isEditing && initialAuthor
              ? editAuthor(initialAuthor.id, payload)
              : addAuthor(payload)
          }
          onSaved={(author) => {
            onSaved?.(author);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
