import { useEffect, useMemo, useState } from "react";
import { PauseCircle, Pencil, Play, Send, Share2, Trash2 } from "lucide-react";
import OverflowMenu from "@/components/OverflowMenu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DetailKind = "book" | "author" | "series";

interface DetailActionsMenuProps {
  kind: DetailKind;
  label: string;
  shareLinkLabel?: string;
  shareAttachmentLabel: string;
  onPause?: () => void;
  pauseTitle?: string;
  pauseDescription?: string;
  onResume?: () => void;
  onEdit?: () => void;
  onDelete: () => void | Promise<void>;
  onSendAttachment: () => void;
  deleteTitle: string;
  deleteDescription: string;
  deleteConfirmLabel?: string;
  className?: string;
  buttonClassName?: string;
}

function entityLabel(kind: DetailKind): string {
  if (kind === "book") return "book";
  if (kind === "author") return "author";
  return "series";
}

export default function DetailActionsMenu({
  kind,
  label,
  shareLinkLabel = "Copy link to this page",
  shareAttachmentLabel,
  onPause,
  pauseTitle = "Pause this book?",
  pauseDescription = "Are you sure you want to pause this book? Reading time will stop until you resume it.",
  onResume,
  onEdit,
  onDelete,
  onSendAttachment,
  deleteTitle,
  deleteDescription,
  deleteConfirmLabel = "Delete",
  className,
  buttonClassName,
}: DetailActionsMenuProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const currentUrl = useMemo(() => window.location.href, []);
  useEffect(() => {
    if (!shareOpen) setCopyStatus(null);
  }, [shareOpen]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopyStatus("Link copied.");
    } catch {
      setCopyStatus("Could not copy link.");
    }
  }

  async function runDelete() {
    setDeleteOpen(false);
    await onDelete();
  }

  async function runPause() {
    setPauseOpen(false);
    onPause?.();
  }

  return (
    <div className={cn("relative", className)}>
      <OverflowMenu label="More actions" className={cn(
          "h-8 w-8 rounded-full border-0 bg-transparent text-foreground/80 shadow-none hover:bg-transparent hover:text-foreground focus-visible:border-transparent focus-visible:ring-0",
          buttonClassName,
        )}>{(close) => <>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              close();
              setShareOpen(true);
            }}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          {onPause && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                close();
                setPauseOpen(true);
              }}
            >
              <PauseCircle className="h-4 w-4" />
              Pause
            </button>
          )}
          {onResume && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                close();
                onResume();
              }}
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                close();
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
            onClick={() => {
              close();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </>}</OverflowMenu>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share this {entityLabel(kind)}</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full justify-start" onClick={copyLink}>
              <Share2 className="mr-2 h-4 w-4" />
              {shareLinkLabel}
            </Button>
            <Button type="button" className="w-full justify-start" onClick={onSendAttachment}>
              <Send className="mr-2 h-4 w-4" />
              {shareAttachmentLabel}
            </Button>
            {copyStatus && <p className="text-xs text-muted-foreground">{copyStatus}</p>}
          </div>
        </DialogContent>
      </Dialog>

      {onPause && (
        <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{pauseTitle}</DialogTitle>
              <DialogDescription>{pauseDescription}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setPauseOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void runPause()}>
                Pause
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleteTitle}</DialogTitle>
            <DialogDescription>{deleteDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="destructive" onClick={() => void runDelete()}>
              {deleteConfirmLabel}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
