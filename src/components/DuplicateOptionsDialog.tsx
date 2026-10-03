import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DuplicationPreference } from "@/types";
import { selectionLabel } from "@/lib/selectionLabels";

export type DuplicateEntityKind = "book" | "series" | "author";

export interface DuplicateOptions {
  copyJournalEntries: boolean;
  copyBooks: boolean;
}

interface DuplicateOptionsDialogProps {
  open: boolean;
  kind: DuplicateEntityKind;
  linkedBookCount?: number;
  selectedCount?: number;
  journalPreference: DuplicationPreference;
  booksPreference: DuplicationPreference;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: DuplicateOptions) => void | Promise<void>;
}

export function resolveDuplicateOptions(
  kind: DuplicateEntityKind,
  journalPreference: DuplicationPreference,
  booksPreference: DuplicationPreference,
  linkedBookCount = 0,
): { needsDialog: boolean; options: DuplicateOptions } {
  const copyJournalEntries = journalPreference === "always";
  const copyBooks = kind !== "book" && booksPreference === "always";
  const asksJournal = journalPreference === "ask";
  const asksBooks = kind !== "book" && linkedBookCount > 0 && booksPreference === "ask";

  return {
    needsDialog: asksJournal || asksBooks,
    options: { copyJournalEntries, copyBooks },
  };
}

export default function DuplicateOptionsDialog({
  open,
  kind,
  linkedBookCount = 0,
  selectedCount,
  journalPreference,
  booksPreference,
  onOpenChange,
  onConfirm,
}: DuplicateOptionsDialogProps) {
  const journalAsked = journalPreference === "ask";
  const booksAsked = kind !== "book" && linkedBookCount > 0 && booksPreference === "ask";
  const [copyJournalEntries, setCopyJournalEntries] = useState(true);
  const [copyBooks, setCopyBooks] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopyJournalEntries(journalPreference !== "never");
    setCopyBooks(booksPreference !== "never");
    setSaving(false);
  }, [booksPreference, journalPreference, open]);

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm({
        copyJournalEntries: journalAsked ? copyJournalEntries : journalPreference === "always",
        copyBooks: booksAsked ? copyBooks : kind !== "book" && booksPreference === "always",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{selectedCount === undefined ? `Duplicate this ${kind}?` : selectedCount === 1 ? `Duplicate selected ${kind}?` : `Duplicate ${selectionLabel(kind, selectedCount)}?`}</DialogTitle>
          <DialogDescription>
            Choose which related content should be copied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {journalAsked && (
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input type="checkbox" checked={copyJournalEntries} onChange={(event) => setCopyJournalEntries(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-primary" />
              <span className="space-y-1">
                <span className="block text-sm font-medium">Duplicate journal entries</span>
                <span className="block text-xs text-muted-foreground">Copy notes, quotes, reviews, and replies.</span>
              </span>
            </label>
          )}
          {booksAsked && (
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input type="checkbox" checked={copyBooks} onChange={(event) => setCopyBooks(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-primary" />
              <span className="space-y-1">
                <span className="block text-sm font-medium">Duplicate linked {linkedBookCount === 1 ? "book" : "books"}</span>
                <span className="block text-xs text-muted-foreground">{linkedBookCount} linked {linkedBookCount === 1 ? "book" : "books"} will be copied.</span>
              </span>
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            You can change these defaults in <Link className="underline underline-offset-2 hover:text-foreground" to="/settings/reading" onClick={() => onOpenChange(false)}>Settings → Reading → Library</Link>.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={saving}>{saving ? "Duplicating…" : selectedCount === undefined ? "Duplicate" : `Duplicate ${selectionLabel(kind, selectedCount)}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
