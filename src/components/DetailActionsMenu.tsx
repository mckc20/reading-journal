import { useEffect, useMemo, useRef, useState } from "react";
import { MoreVertical, PauseCircle, Pencil, Play, Send, Share2, Trash2 } from "lucide-react";
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

type MenuPosition = {
  top: number;
  left: number;
};

interface DetailActionsMenuProps {
  kind: DetailKind;
  label: string;
  shareLinkLabel?: string;
  shareAttachmentLabel: string;
  onPause?: () => void;
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const currentUrl = useMemo(() => window.location.href, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: Event) {
      const target = event.target as Node | null;
      if (
        target &&
        (buttonRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return;
      }
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

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

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = 200;
    const panelHeight = (onEdit ? 42 : 0) + ((onPause || onResume) ? 42 : 0) + 92;
    const left = Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8));
    const top = Math.min(rect.bottom + 8, window.innerHeight - panelHeight - 8);
    setMenuPosition({ top, left });
    setMenuOpen(true);
  }

  async function runDelete() {
    setDeleteOpen(false);
    await onDelete();
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="More actions"
        aria-expanded={menuOpen}
        onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
        className={cn(
          "h-8 w-8 rounded-full border-0 bg-transparent text-foreground/80 shadow-none hover:bg-transparent hover:text-foreground focus-visible:border-transparent focus-visible:ring-0",
          buttonClassName,
        )}
      >
        <MoreVertical className="h-5 w-5" />
      </Button>

      {menuOpen && menuPosition && (
        <div
          ref={menuRef}
          className="fixed z-50 w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              setMenuOpen(false);
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
                setMenuOpen(false);
                onPause();
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
                setMenuOpen(false);
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
                setMenuOpen(false);
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
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleteTitle}</DialogTitle>
            <DialogDescription>{deleteDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void runDelete()}>
              {deleteConfirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
