import { UserRound } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import AuthorForm from "@/components/AuthorForm";
import { CreationDialogContent } from "@/components/redesign/CreationDialogContent";
import { useAuthorsContext } from "@/context";
import type { Author } from "@/types";

interface AddAuthorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  initialAuthor?: Author | null;
  initialName?: string;
  onSaved?: (author: Author) => void;
}

export default function AddAuthorDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  initialAuthor,
  initialName = "",
  onSaved,
}: AddAuthorDialogProps) {
  const { addAuthor, editAuthor } = useAuthorsContext();
  const isEditing = Boolean(initialAuthor);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CreationDialogContent
        title={isEditing ? "Edit author" : "Add Author"}
        description={isEditing ? "Update the author details shown in your library." : "Create an author profile in your library."}
        icon={UserRound}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <AuthorForm
          key={`${open}-${initialAuthor?.id ?? initialName}`}
          initialAuthor={initialAuthor}
          initialName={initialName}
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
      </CreationDialogContent>
    </Dialog>
  );
}
