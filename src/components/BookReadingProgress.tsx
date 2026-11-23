import { useMemo, useState, type ReactNode } from "react";
import { Calendar, CalendarClock, ChevronRight, Clock, Flag, Hourglass, type LucideIcon } from "lucide-react";
import ProgressOverTimeChart, { type ProgressOverTimeChartMode } from "@/components/ProgressOverTimeChart";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  formatCalendarSpan,
  formatTotalReadingTime,
  getEstimatedFinish,
  getReadingDuration,
  MIN_READING_LOGS_FOR_ESTIMATED_FINISH,
  parseLocalDateOnly,
  sumReadingMinutes,
} from "@/lib/bookAnalytics";
import type { Book, ReadingLog } from "@/types";

const chartModes = [
  { value: "progress", label: "Progress" },
  { value: "speed", label: "Speed" },
  { value: "pages", label: "Pages" },
] as const;

function formatDate(date: Date | null, fallback = "Not available") {
  return date?.toLocaleDateString(undefined, { dateStyle: "medium" }) ?? fallback;
}

function ReadingStat({
  icon: Icon, label, value, secondary, children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  secondary?: { label: string; value: string };
  children: ReactNode;
}) {
  const summary = secondary ? `${label}: ${value}, ${secondary.label}: ${secondary.value}` : `${label}: ${value}`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="rj-reading-stat" aria-label={summary}>
          <Icon aria-hidden="true" />
          <span className="flex flex-wrap gap-x-5 gap-y-3">
            <span>
              <span className="rj-reading-stat-label">{label}</span>
              <span className="rj-reading-stat-value">{value}</span>
            </span>
            {secondary && (
              <span>
                <span className="rj-reading-stat-label">{secondary.label}</span>
                <span className="rj-reading-stat-value">{secondary.value}</span>
              </span>
            )}
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto pt-11 sm:max-w-md" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function StatRow({ icon: Icon, label, value }: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="relative grid min-h-16 content-center gap-1 rounded-xl bg-card py-3 pr-3 pl-16">
      <dt className="text-xs text-muted-foreground">
        <Icon aria-hidden="true" className="absolute top-1/2 left-[1.375rem] size-5 -translate-y-1/2 text-favorite" />
        {label}
      </dt>
      <dd className="text-base font-semibold leading-snug">{value}</dd>
    </div>
  );
}

function ReadingLogDetails({ logs }: { logs: ReadingLog[] }) {
  const [showAll, setShowAll] = useState(false);
  const entries = useMemo(() => {
    let previousPage = 0;
    return [...logs]
      .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
      .map((log) => {
        const pagesRead = Math.max(0, log.current_page - previousPage);
        previousPage = log.current_page;
        return { ...log, pagesRead };
      })
      .reverse();
  }, [logs]);

  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="sr-only">Reading progress entries</h3>
      <ul className="divide-y rounded-lg border px-3">
        {(showAll ? entries : entries.slice(0, 3)).map((entry) => (
          <li key={entry.id || `${entry.logged_at}-${entry.current_page}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
            <span>
              <span className="block text-xs text-muted-foreground">
                {new Date(entry.logged_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              Page {entry.current_page} <span className="text-muted-foreground">(+{entry.pagesRead})</span>
            </span>
            <span className="text-muted-foreground">
              {entry.reading_time_minutes ? formatTotalReadingTime(entry.reading_time_minutes) : "No reading time"}
            </span>
          </li>
        ))}
      </ul>
      {entries.length > 3 && (
        <Button type="button" size="sm" variant="ghost" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${entries.length}`}
        </Button>
      )}
    </div>
  );
}

export default function BookReadingProgress({ book, logs }: { book: Book; logs: ReadingLog[] }) {
  const [chartMode, setChartMode] = useState<ProgressOverTimeChartMode>("progress");
  const startedOn = formatDate(parseLocalDateOnly(book.date_started), "Not set");
  const finishedOn = formatDate(parseLocalDateOnly(book.date_finished), "Not set");
  const isFinished = book.status === "Finished";
  const readingMinutes = sumReadingMinutes(logs);
  const readingTime = readingMinutes > 0 ? formatTotalReadingTime(readingMinutes) : "No time logged";
  const duration = getReadingDuration({
    dateStarted: book.date_started,
    dateFinished: book.date_finished,
    pausePeriods: book.pause_periods,
  });
  const estimate = useMemo(() => getEstimatedFinish({
    status: book.status,
    currentPage: book.current_page,
    totalPages: book.total_pages,
    logs,
    pausePeriods: book.pause_periods,
  }), [book.status, book.current_page, book.total_pages, book.pause_periods, logs]);
  const finishDate = formatDate(estimate.finishDate);
  const showEstimate = estimate.shouldShow || book.status === "Paused";

  if (!book.date_started && !book.date_finished && !logs.length && !showEstimate) {
    return <p className="rj-detail-quiet">Your reading sessions will appear here.</p>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="rj-reading-stats">
        <ReadingStat
          icon={Calendar}
          label="Started on"
          value={startedOn}
          secondary={isFinished ? { label: "Finished on", value: finishedOn } : undefined}
        >
          <dl className="space-y-2">
            <StatRow icon={Calendar} label="Started on" value={startedOn} />
            {(isFinished || book.date_finished) && <StatRow icon={Flag} label="Finished on" value={finishedOn} />}
            <StatRow icon={CalendarClock} label="Reading duration" value={duration.span ? formatCalendarSpan(duration.span) : "Not available"} />
            {!isFinished && <StatRow icon={Clock} label="Reading time" value={readingTime} />}
          </dl>
          {book.status === "Reading" && <ReadingLogDetails logs={logs} />}
        </ReadingStat>
        {book.status !== "Reading" && (
          <ReadingStat icon={Clock} label="Reading time" value={readingTime}>
            <dl>
              <StatRow icon={Clock} label="Total logged reading time" value={readingTime} />
            </dl>
            <ReadingLogDetails logs={logs} />
          </ReadingStat>
        )}
        {showEstimate && (
          <ReadingStat icon={CalendarClock} label="Estimated finish" value={finishDate}>
            <dl className="space-y-2">
              <StatRow icon={Flag} label="Estimated finish" value={finishDate} />
              <StatRow
                icon={Hourglass}
                label="Reading time left"
                value={estimate.remainingMinutes !== null
                  ? formatTotalReadingTime(estimate.remainingMinutes)
                  : estimate.finishDate ? "No timed progress available" : "Not available"}
              />
            </dl>
            {estimate.finishDate ? (
              <p className="text-xs text-muted-foreground">
                Based on {estimate.readingSessionCount} progress updates. Reading time left uses timed progress updates.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {book.status === "Paused"
                  ? "Resume the book to see an estimate."
                  : `An estimate needs a page total and at least ${MIN_READING_LOGS_FOR_ESTIMATED_FINISH} progress updates with pages read across multiple days.`}
              </p>
            )}
          </ReadingStat>
        )}
      </div>

      {logs.length > 0 && (
        <section className="min-w-0 space-y-3" aria-labelledby="book-timeline-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="book-timeline-heading" className="rj-detail-chart-heading text-sm font-medium">
              {chartModes.find(({ value }) => value === chartMode)?.label} over time
            </h3>
            <SegmentedControl label="Chart metric" value={chartMode} options={chartModes} onChange={setChartMode} />
          </div>
          <ProgressOverTimeChart
            logs={logs}
            totalPages={book.total_pages}
            pausePeriods={book.pause_periods}
            mode={chartMode}
          />
        </section>
      )}
    </div>
  );
}
