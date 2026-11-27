import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bookmark, Copy, ExternalLink, MoreHorizontal, PauseCircle, Pencil, Play, Send, Share2, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import DeleteSeriesBooksOption from "@/components/DeleteSeriesBooksOption";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DetailKind = "book" | "author" | "series" | "genre";

interface DetailActionsMenuProps {
  kind: DetailKind;
  label: string;
  shareLinkLabel?: string;
  shareAttachmentLabel?: string;
  showShare?: boolean;
  beforeMore?: ReactNode;
  sourceUrl?: string;
  onRemove?: () => void;
  onPause?: () => void;
  pauseTitle?: string;
  pauseDescription?: string;
  onResume?: () => void;
  onEdit?: (trigger?: HTMLElement) => void;
  onDuplicate?: (trigger?: HTMLElement) => void;
  onWishlist?: () => void;
  onDelete?: (deleteLinkedBooks?: boolean) => void | Promise<void>;
  onSendAttachment?: () => void;
  deleteTitle?: string;
  deleteDescription?: string;
  deleteConfirmLabel?: string;
  deleteMenuLabel?: string;
  className?: string;
}

export default function DetailActionsMenu({
  kind,
  label,
  shareLinkLabel = "Copy link to this page",
  shareAttachmentLabel,
  showShare = true,
  beforeMore,
  sourceUrl,
  onRemove,
  onPause,
  pauseTitle = "Pause this book?",
  pauseDescription = "Are you sure you want to pause this book? Reading time will stop until you resume it.",
  onResume,
  onEdit,
  onDuplicate,
  onWishlist,
  onDelete,
  onSendAttachment,
  deleteTitle,
  deleteDescription,
  deleteConfirmLabel = "Delete",
  deleteMenuLabel = "Delete",
  className,
}: DetailActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const shareTriggerRef = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLinkedBooks, setDeleteLinkedBooks] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const hasMoreActions = Boolean(onPause || onResume || onDuplicate || onWishlist || onDelete || sourceUrl || onRemove);

  useEffect(() => {
    if (!shareOpen) setCopyStatus(null);
  }, [shareOpen]);

  function openDialog(open: () => void) {
    openingDialog.current = true;
    open();
  }

  function restoreTriggerFocus(event: Event) {
    event.preventDefault();
    triggerRef.current?.focus({ preventScroll: true });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("Link copied.");
    } catch {
      setCopyStatus("Could not copy link.");
    }
  }

  async function runDelete() {
    setDeleteOpen(false);
    await onDelete?.(kind === "series" && deleteLinkedBooks);
  }

  async function runPause() {
    setPauseOpen(false);
    onPause?.();
  }

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      {onEdit && (
        <Button type="button" variant="ghost" size="icon-lg" className="size-11" aria-label={`Edit ${kind}`} onClick={(event) => onEdit(event.currentTarget)}>
          <Pencil aria-hidden="true" />
        </Button>
      )}
      {showShare && <Button ref={shareTriggerRef} type="button" variant="ghost" size="icon-lg" className="size-11" aria-label={`Share ${kind}`} aria-haspopup="dialog" onClick={() => setShareOpen(true)}>
        <Share2 aria-hidden="true" />
      </Button>}
      {beforeMore}
      {hasMoreActions && (
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button ref={triggerRef} variant="ghost" size="icon-lg" className="size-11" aria-label="More actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="rj-add-menu"
              align="end"
              sideOffset={8}
              collisionPadding={12}
              onCloseAutoFocus={(event) => {
                if (openingDialog.current) event.preventDefault();
                openingDialog.current = false;
              }}
            >
              {onPause && (
                <DropdownMenu.Item onSelect={() => openDialog(() => setPauseOpen(true))}>
                  <PauseCircle aria-hidden="true" className="size-4" />
                  Pause
                </DropdownMenu.Item>
              )}
              {onResume && (
                <DropdownMenu.Item onSelect={onResume}>
                  <Play aria-hidden="true" className="size-4" />
                  Resume
                </DropdownMenu.Item>
              )}
              {onDuplicate && (
                <DropdownMenu.Item onSelect={() => openDialog(() => onDuplicate(triggerRef.current ?? undefined))}>
                  <Copy aria-hidden="true" className="size-4" />
                  Duplicate
                </DropdownMenu.Item>
              )}
              {onWishlist && (
                <DropdownMenu.Item onSelect={onWishlist}>
                  <Bookmark aria-hidden="true" className="size-4" />
                  Move to Wishlist
                </DropdownMenu.Item>
              )}
              {sourceUrl && <DropdownMenu.Item asChild>
                <a href={sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" className="size-4" />
                  View source
                </a>
              </DropdownMenu.Item>}
              {onRemove || onDelete ? (
                <DropdownMenu.Item className="text-destructive" onSelect={onRemove ?? (() => openDialog(() => {
                  setDeleteLinkedBooks(false);
                  setDeleteOpen(true);
                }))}>
                  <Trash2 aria-hidden="true" className="size-4" />
                  {deleteMenuLabel}
                </DropdownMenu.Item>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}

      {showShare && <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={(event) => {
          event.preventDefault();
          shareTriggerRef.current?.focus({ preventScroll: true });
        }}>
          <DialogHeader>
            <DialogTitle>Share this {kind}</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full justify-start" onClick={copyLink}>
              <Share2 className="mr-2 h-4 w-4" />
              {shareLinkLabel}
            </Button>
            {onSendAttachment && shareAttachmentLabel && (
              <Button type="button" className="w-full justify-start" onClick={onSendAttachment}>
                <Send className="mr-2 h-4 w-4" />
                {shareAttachmentLabel}
              </Button>
            )}
            {copyStatus && <p className="text-xs text-muted-foreground">{copyStatus}</p>}
          </div>
        </DialogContent>
      </Dialog>}

      {onPause && (
        <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
          <DialogContent className="sm:max-w-md" onCloseAutoFocus={restoreTriggerFocus}>
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

      {onDelete && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md" onCloseAutoFocus={restoreTriggerFocus}>
            <DialogHeader>
              <DialogTitle>{deleteTitle}</DialogTitle>
              <DialogDescription>{deleteDescription}</DialogDescription>
            </DialogHeader>
            {kind === "series" && <DeleteSeriesBooksOption checked={deleteLinkedBooks} onChange={setDeleteLinkedBooks} />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="destructive" onClick={() => void runDelete()}>
                {deleteConfirmLabel}{kind === "series" && deleteLinkedBooks ? " series and books" : ""}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
