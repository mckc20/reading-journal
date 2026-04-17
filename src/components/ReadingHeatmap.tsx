import { useMemo } from "react";
import type { ReadingLog } from "@/types";
import { cn } from "@/lib/utils";

interface ReadingHeatmapProps {
  logs: ReadingLog[];
}

interface HeatmapCell {
  dayKey: string;
  date: Date;
  visualMinutes: number;
  trackedMinutes: number;
  logsCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  inRange: boolean;
}

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getIntensityLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes <= 15) return 1;
  if (minutes <= 30) return 2;
  if (minutes <= 60) return 3;
  return 4;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildRange() {
  const today = startOfLocalDay(new Date());
  const start = new Date(today);
  start.setFullYear(start.getFullYear() - 1);
  start.setDate(start.getDate() + 1);
  return { start, end: today };
}

export default function ReadingHeatmap({ logs }: ReadingHeatmapProps) {
  const columnWidthPx = 16;
  const { weeks, monthLabels, hasAnyReading } = useMemo(() => {
    const { start, end } = buildRange();

    const dayTotals = new Map<string, number>();
    const dayLogCounts = new Map<string, number>();
    for (const log of logs) {
      const minutes = log.reading_time_minutes ?? 0;
      const key = toLocalDayKey(new Date(log.logged_at));
      dayLogCounts.set(key, (dayLogCounts.get(key) ?? 0) + 1);
      if (minutes > 0) {
        dayTotals.set(key, (dayTotals.get(key) ?? 0) + minutes);
      }
    }

    const hasAnyReadingInRange = Array.from(dayLogCounts.entries()).some(([key, count]) => {
      if (count <= 0) return false;
      const [year, month, day] = key.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date >= start && date <= end;
    });

    const gridStart = addDays(start, -start.getDay());
    const daysToSaturday = 6 - end.getDay();
    const gridEnd = addDays(end, daysToSaturday);

    const allCells: HeatmapCell[] = [];
    for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
      const dayKey = toLocalDayKey(cursor);
      const minutesLogged = dayTotals.get(dayKey) ?? 0;
      const logsCount = dayLogCounts.get(dayKey) ?? 0;
      const visualMinutes = minutesLogged > 0 ? minutesLogged : logsCount > 0 ? 1 : 0;
      const inRange = cursor >= start && cursor <= end;
      allCells.push({
        dayKey,
        date: new Date(cursor),
        visualMinutes,
        trackedMinutes: minutesLogged,
        logsCount,
        level: getIntensityLevel(visualMinutes),
        inRange,
      });
    }

    const weekCount = Math.ceil(allCells.length / 7);
    const weekColumns: HeatmapCell[][] = Array.from({ length: weekCount }, () => []);
    for (let i = 0; i < allCells.length; i += 1) {
      const weekIndex = Math.floor(i / 7);
      weekColumns[weekIndex].push(allCells[i]);
    }

    const labels = weekColumns
      .map((week, index) => {
        const monthStartCell = week.find(
          (cell) => cell.inRange && cell.date.getDate() === 1
        );
        if (!monthStartCell) return null;
        return {
          index,
          text: monthStartCell.date.toLocaleDateString(undefined, { month: "short" }),
        };
      })
      .filter((entry): entry is { index: number; text: string } => Boolean(entry));

    return {
      weeks: weekColumns,
      monthLabels: labels,
      hasAnyReading: hasAnyReadingInRange,
    };
  }, [logs]);

  const intensityClassByLevel: Record<HeatmapCell["level"], string> = {
    0: "bg-muted border-border/70",
    1: "bg-emerald-100 border-emerald-200",
    2: "bg-emerald-200 border-emerald-300",
    3: "bg-emerald-400 border-emerald-500",
    4: "bg-emerald-600 border-emerald-700",
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Reading activity</h2>
        <p className="text-sm text-muted-foreground">Last 12 months by day (minutes read)</p>
      </div>

      {hasAnyReading ? (
        <div className="space-y-3">
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[auto_1fr] gap-2 text-xs text-muted-foreground">
                <div />
                <div className="relative h-4">
                  {monthLabels.map((label) => (
                    <span
                      key={`${label.text}-${label.index}`}
                      className="absolute -translate-x-1/2"
                      style={{ left: `${label.index * columnWidthPx + 8}px` }}
                    >
                      {label.text}
                    </span>
                  ))}
                </div>

                <div className="grid grid-rows-7 gap-1 pr-1 text-[11px]">
                  <span className="h-3 leading-3" />
                  <span className="h-3 leading-3">Mon</span>
                  <span className="h-3 leading-3" />
                  <span className="h-3 leading-3">Wed</span>
                  <span className="h-3 leading-3" />
                  <span className="h-3 leading-3">Fri</span>
                  <span className="h-3 leading-3" />
                </div>

                <div className="grid auto-cols-max grid-flow-col gap-1">
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-rows-7 gap-1">
                      {week.map((cell) => {
                        const title =
                          cell.trackedMinutes > 0
                            ? `${formatDate(cell.date)}: ${cell.trackedMinutes} minute${cell.trackedMinutes === 1 ? "" : "s"} read`
                            : `${formatDate(cell.date)}: no reading activity`;
                        const hasTimeTracked = cell.trackedMinutes > 0;
                        const activityLabel =
                          !cell.inRange
                            ? title
                            : hasTimeTracked
                              ? title
                              : cell.logsCount > 0
                                ? `${formatDate(cell.date)}: progress logged (no reading time tracked)`
                                : title;
                        return (
                          <button
                            key={cell.dayKey}
                            type="button"
                            title={activityLabel}
                            disabled={!cell.inRange}
                            aria-label={activityLabel}
                            className={cn(
                              "h-3 w-3 rounded-[3px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                              cell.inRange
                                ? intensityClassByLevel[cell.level]
                                : "border-transparent bg-transparent",
                              cell.inRange && cell.level > 0 && "hover:brightness-95"
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>Hover a day to see details.</p>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <span className={cn("h-3 w-3 rounded-[3px] border", intensityClassByLevel[0])} />
              <span className={cn("h-3 w-3 rounded-[3px] border", intensityClassByLevel[1])} />
              <span className={cn("h-3 w-3 rounded-[3px] border", intensityClassByLevel[2])} />
              <span className={cn("h-3 w-3 rounded-[3px] border", intensityClassByLevel[3])} />
              <span className={cn("h-3 w-3 rounded-[3px] border", intensityClassByLevel[4])} />
              <span>More</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          No reading activity yet. Log reading time from a book to populate the heatmap.
        </div>
      )}
    </section>
  );
}
