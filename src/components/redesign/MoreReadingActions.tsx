import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BookOpen, ClipboardPen, Clock3, Hourglass, MoreHorizontal } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Button } from "@/components/ui/button";

const HOLD_MS = 500;
const MOVE_TOLERANCE = 8;

type OpenReadingDialog = (trigger: HTMLButtonElement) => void;

interface MoreReadingActionsProps {
  disabled?: boolean;
  onUpdateProgress?: OpenReadingDialog;
  onChangeDate?: OpenReadingDialog;
  onSession?: OpenReadingDialog;
  onEditLogs?: () => void;
}

export function MoreReadingActions({ disabled, onUpdateProgress, onChangeDate, onSession, onEditLogs }: MoreReadingActionsProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  const [open, setOpen] = useState(false);
  const hold = useRef<{ timer: number; x: number; y: number; pointerId: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => () => window.clearTimeout(hold.current?.timer), []);

  function clearHold() {
    window.clearTimeout(hold.current?.timer);
    hold.current = null;
  }

  function openMenu() {
    clearHold();
    suppressClick.current = true;
    setOpen(true);
  }

  function startHold(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || event.ctrlKey) return;

    // The primary button needs to wait for a click or hold, rather than open the menu on pointer down.
    event.preventDefault();
    if (!event.isPrimary) return;
    suppressClick.current = false;
    if (open) return;

    event.currentTarget.focus({ preventScroll: true });
    hold.current = {
      timer: window.setTimeout(openMenu, HOLD_MS),
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
  }

  function cancelHold(event: PointerEvent<HTMLButtonElement>) {
    if (hold.current?.pointerId !== event.pointerId) return;
    clearHold();
    suppressClick.current = true;
  }

  function openDialog(action: OpenReadingDialog) {
    if (!triggerRef.current) return;
    openingDialog.current = true;
    action(triggerRef.current);
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      {onUpdateProgress ? (
        <DropdownMenu.Trigger asChild onPointerDown={startHold}>
          <Button ref={triggerRef} type="button" disabled={disabled} className="rj-detail-progress-trigger"
            aria-description="Press and hold or press Down Arrow for more reading actions."
            onPointerUp={event => {
              if (hold.current?.pointerId === event.pointerId) clearHold();
            }}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onPointerMove={event => {
              const press = hold.current;
              if (press?.pointerId === event.pointerId &&
                Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) cancelHold(event);
            }}
            onContextMenu={event => {
              event.preventDefault();
              openMenu();
            }}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!event.repeat && !open) onUpdateProgress(event.currentTarget);
              }
              if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                event.preventDefault();
                openMenu();
              }
            }}
            onClick={event => {
              if (suppressClick.current && event.detail !== 0) {
                suppressClick.current = false;
                return;
              }
              if (!open) onUpdateProgress(event.currentTarget);
            }}>
            <BookOpen aria-hidden="true" />Update Progress
          </Button>
        </DropdownMenu.Trigger>
      ) : (
        <DropdownMenu.Trigger asChild>
          <Button ref={triggerRef} type="button" className="rj-more-reading-trigger" variant="outline" size="icon-lg"
            aria-label="More reading actions" disabled={disabled}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>
      )}
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="rj-add-menu" sideOffset={8} align="start" collisionPadding={12}
          onCloseAutoFocus={event => {
            if (openingDialog.current) event.preventDefault();
            openingDialog.current = false;
          }}>
          {onChangeDate && (
            <DropdownMenu.Item onSelect={() => openDialog(onChangeDate)}>
              <Hourglass size={16} aria-hidden="true" />
              {onUpdateProgress ? "Change Date/Time" : "Change date/time"}
            </DropdownMenu.Item>
          )}
          {onSession && <DropdownMenu.Item onSelect={() => openDialog(onSession)}><Clock3 size={16} aria-hidden="true" />Log session</DropdownMenu.Item>}
          {onEditLogs && <DropdownMenu.Item onSelect={onEditLogs}><ClipboardPen size={16} aria-hidden="true" />Edit logs</DropdownMenu.Item>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
