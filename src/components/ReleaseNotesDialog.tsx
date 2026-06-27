import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUserSettings } from "@/context";
import {
  formatReleaseNoteDate,
  getLatestReleaseNote,
  hasUnreadReleaseNote,
} from "@/lib/releaseNotes";
import { cn } from "@/lib/utils";

export const RELEASE_NOTES_EVENT = "reading-journal:release-notes";

export default function ReleaseNotesDialog() {
  const { settings, loading, markReleaseNoteSeen } = useUserSettings();
  const releaseNote = getLatestReleaseNote();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!settings) return;
    setOpen(hasUnreadReleaseNote(settings.last_seen_release_note_version));
  }, [loading, settings]);

  useEffect(() => {
    function handleOpenReleaseNotes() {
      if (!loading && settings && hasUnreadReleaseNote(settings.last_seen_release_note_version)) {
        setOpen(true);
      }
    }

    window.addEventListener(RELEASE_NOTES_EVENT, handleOpenReleaseNotes);
    return () => {
      window.removeEventListener(RELEASE_NOTES_EVENT, handleOpenReleaseNotes);
    };
  }, [loading, settings]);

  async function handleAcknowledge() {
    setSaving(true);

    try {
      await markReleaseNoteSeen(releaseNote.version);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            New release note
          </div>

          <DialogTitle className="text-2xl">{releaseNote.title}</DialogTitle>
          <DialogDescription className="max-w-lg text-base">
            {releaseNote.summary}
          </DialogDescription>
          <p className="text-xs text-muted-foreground">
            Published {formatReleaseNoteDate(releaseNote.published_at)} · {releaseNote.version}
          </p>
        </DialogHeader>

        <div className="grid gap-3">
          {releaseNote.highlights.map((highlight) => (
            <div
              key={highlight.title}
              className={cn(
                "rounded-lg border border-border bg-muted/30 p-4",
                "shadow-[var(--shadow-card)]",
              )}
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-medium leading-tight">{highlight.title}</p>
                  <p className="text-sm text-muted-foreground">{highlight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="link"
            size="sm"
            asChild
            className="w-fit justify-start px-0 text-xs font-medium"
          >
            <Link to="/changelog" onClick={() => setOpen(false)}>
              View changelog
            </Link>
          </Button>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Not now
            </Button>
            <Button type="button" onClick={() => void handleAcknowledge()} disabled={saving}>
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
