import { useState, useEffect, useMemo } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollWheelPicker } from "@/components/ui/scroll-wheel-picker";
import { createReadingLog, fetchLastReadingLog } from "@/lib/books";
import { useAuth } from "@/context/AuthContext";
import type { Book, ReadingLog } from "@/types";

interface ReadingProgressPanelProps {
  book: Book;
  onProgressSaved: (newCurrentPage: number) => void;
}

function buildPageItems(min: number, max: number) {
  const items: { value: number; label: string }[] = [];
  for (let p = min; p <= max; p++) {
    items.push({ value: p, label: String(p) });
  }
  return items;
}

const HOUR_ITEMS = Array.from({ length: 7 }, (_, i) => ({
  value: i,
  label: `${i}h`,
}));

const MINUTE_ITEMS = Array.from({ length: 12 }, (_, i) => ({
  value: i * 5,
  label: `${(i * 5).toString().padStart(2, "0")}m`,
}));

export default function ReadingProgressPanel({
  book,
  onProgressSaved,
}: ReadingProgressPanelProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [lastLog, setLastLog] = useState<ReadingLog | null>(null);
  const [loadingLog, setLoadingLog] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentPage = book.current_page ?? 0;
  const totalPages = book.total_pages ?? 0;

  // Initial page value: start one step above current
  const minPage = Math.max(currentPage, lastLog?.current_page ?? 0);
  const startPage = Math.min(minPage + 1, totalPages);

  const [selectedPage, setSelectedPage] = useState(startPage);
  const [selectedHours, setSelectedHours] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(0);

  // Fetch last reading log on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const log = await fetchLastReadingLog(book.id);
        if (!cancelled) setLastLog(log);
      } catch {
        // silently ignore — we'll just use book.current_page as min
      } finally {
        if (!cancelled) setLoadingLog(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [book.id]);

  // Reset picker values when expanding or when lastLog loads
  useEffect(() => {
    if (expanded) {
      const min = Math.max(currentPage, lastLog?.current_page ?? 0);
      setSelectedPage(Math.min(min + 1, totalPages));
      setSelectedHours(0);
      setSelectedMinutes(0);
      setErrorMsg(null);
    }
  }, [expanded, lastLog, currentPage, totalPages]);

  const pageItems = useMemo(
    () => buildPageItems(minPage + 1, totalPages),
    [minPage, totalPages]
  );

  async function handleSave() {
    if (!user) return;
    try {
      setSaving(true);
      setErrorMsg(null);
      const timeMinutes = selectedHours * 60 + selectedMinutes;
      await createReadingLog(
        book.id,
        user.id,
        selectedPage,
        timeMinutes > 0 ? timeMinutes : undefined
      );
      await onProgressSaved(selectedPage);
      // Update lastLog locally so the min page updates
      setLastLog({
        id: "",
        book_id: book.id,
        user_id: user.id,
        current_page: selectedPage,
        logged_at: new Date().toISOString(),
      });
      setExpanded(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save progress");
    } finally {
      setSaving(false);
    }
  }

  if (totalPages === 0) {
    return (
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="text-sm text-muted-foreground">
          Set the total pages to track progress.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
      {/* Header with current progress */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Reading progress</p>
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
        </div>
        {!expanded && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingLog}
            onClick={() => setExpanded(true)}
          >
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Update progress
          </Button>
        )}
      </div>

      {/* Expanded picker panel */}
      {expanded && (
        <div className="space-y-4 pt-1">
          {/* Page picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">Read up to page</Label>
            <ScrollWheelPicker
              items={pageItems}
              selectedValue={selectedPage}
              onChange={setSelectedPage}
            />
          </div>

          {/* Time picker */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Time spent reading (optional)
            </Label>
            <div className="flex gap-2">
              <ScrollWheelPicker
                items={HOUR_ITEMS}
                selectedValue={selectedHours}
                onChange={setSelectedHours}
                className="flex-1"
              />
              <ScrollWheelPicker
                items={MINUTE_ITEMS}
                selectedValue={selectedMinutes}
                onChange={setSelectedMinutes}
                className="flex-1"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-destructive">{errorMsg}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => setExpanded(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
