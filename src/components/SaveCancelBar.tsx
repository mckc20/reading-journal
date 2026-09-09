import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveCancelBarProps {
  onCancel: () => void;
  onSave?: () => void;
  cancelDisabled?: boolean;
  saveDisabled?: boolean;
  saving?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  children?: ReactNode;
  mode?: "page" | "dialog";
}

/** Shared action bar for forms that have an explicit Save/Cancel workflow. */
export default function SaveCancelBar({
  onCancel,
  onSave,
  cancelDisabled = false,
  saveDisabled = false,
  saving = false,
  saveLabel = "Save",
  savingLabel = "Saving…",
  children,
  mode = "page",
}: SaveCancelBarProps) {
  return (
    <div
      className={cn(
        mode === "dialog"
          ? "absolute inset-x-0 bottom-0"
          : "fixed inset-x-0 bottom-[4.25rem] md:bottom-0",
        "z-50 border-t bg-card/95 px-4 py-3 shadow-[0_-8px_24px_oklch(0.21_0_0_/_0.08)] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:px-5",
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{children}</div>
        <div className="flex w-full flex-row-reverse gap-2 sm:w-auto">
          <Button type={onSave ? "button" : "submit"} onClick={onSave} disabled={saveDisabled || saving}>
            {saving ? savingLabel : saveLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={cancelDisabled || saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
