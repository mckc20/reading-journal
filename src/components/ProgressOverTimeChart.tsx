import { useId, useMemo, useState } from "react";
import { PauseCircle } from "lucide-react";
import {
  buildProgressTimeline,
  formatPagesPerHour,
  getPagesPerHour,
} from "@/lib/bookAnalytics";
import type { ProgressTimelinePoint } from "@/lib/bookAnalytics";
import type { BookPausePeriod, ReadingLog } from "@/types";

export type ProgressOverTimeChartMode = "progress" | "speed";

interface ProgressOverTimeChartProps {
  logs: ReadingLog[];
  totalPages?: number;
  pausePeriods?: BookPausePeriod[];
  mode?: ProgressOverTimeChartMode;
}

interface SpeedTimelinePoint {
  dayKey: string;
  value: number;
}

interface BaseChartPoint {
  dayKey: string;
  value: number;
  x: number;
  y: number;
}

interface ProgressChartPoint extends BaseChartPoint, ProgressTimelinePoint {
  mode: "progress";
}

interface SpeedChartPoint extends BaseChartPoint {
  mode: "speed";
}

type ChartPoint = ProgressChartPoint | SpeedChartPoint;

function dayFromKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDayLabel(date: Date): string {
  return String(date.getDate());
}

function formatFullDayLabel(dayKey: string): string {
  return dayFromKey(dayKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildSpeedTimeline(logs: ReadingLog[]): SpeedTimelinePoint[] {
  let previousPage = 0;
  const dailyTotals = new Map<string, { pages: number; minutes: number }>();
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
  );

  for (const log of sortedLogs) {
    const pagesRead = Math.max(0, log.current_page - previousPage);
    previousPage = log.current_page;
    if (!log.reading_time_minutes || log.reading_time_minutes <= 0) continue;

    const dayKey = toLocalDayKey(new Date(log.logged_at));
    const current = dailyTotals.get(dayKey) ?? { pages: 0, minutes: 0 };
    dailyTotals.set(dayKey, {
      pages: current.pages + pagesRead,
      minutes: current.minutes + log.reading_time_minutes,
    });
  }

  const keys = [...dailyTotals.keys()].sort();
  if (keys.length === 0) return [];

  const first = dayFromKey(keys[0]);
  const last = dayFromKey(keys[keys.length - 1]);
  const points: SpeedTimelinePoint[] = [];
  const cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate());

  while (cursor <= last) {
    const dayKey = toLocalDayKey(cursor);
    const total = dailyTotals.get(dayKey);
    const speed = getPagesPerHour({
      pages: total?.pages,
      readingMinutes: total?.minutes,
    });

    points.push({
      dayKey,
      value: speed ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

export default function ProgressOverTimeChart({
  logs,
  totalPages,
  pausePeriods = [],
  mode = "progress",
}: ProgressOverTimeChartProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const gradientId = `timeline-fill-${useId().replace(/:/g, "")}`;
  const progressTimeline = useMemo(
    () => buildProgressTimeline(logs, totalPages, pausePeriods),
    [logs, pausePeriods, totalPages],
  );
  const speedTimeline = useMemo(() => buildSpeedTimeline(logs), [logs]);
  const isSpeedMode = mode === "speed";

  const chartHeight = 176;
  const progressDatePoints = useMemo(
    () => progressTimeline.points.filter((point) => !point.isStart),
    [progressTimeline.points],
  );
  const speedDatePoints = speedTimeline;
  const datePoints = isSpeedMode ? speedDatePoints : progressDatePoints;
  const maxSpeed = Math.max(...speedTimeline.map((point) => point.value), 0);
  const yAxisMax = isSpeedMode ? Math.max(maxSpeed, 1) : 100;
  const yAxisLabels = isSpeedMode
    ? [yAxisMax, yAxisMax / 2, 0].map((value) => formatPagesPerHour(value))
    : ["100%", "50%", "0%"];
  const progressStartOffsetPercent = 1.5;

  const getXPercent = (dayKey: string, isStart = false): number => {
    const index = datePoints.findIndex((point) => point.dayKey === dayKey);
    if (index < 0) {
      if (datePoints.length === 0) return 0;
      const firstDayKey = datePoints[0].dayKey;
      const lastDayKey = datePoints[datePoints.length - 1].dayKey;
      if (dayKey < firstDayKey) return 0;
      if (dayKey > lastDayKey) return 100;
      return 0;
    }
    if (datePoints.length === 1) {
      return isStart ? 50 - progressStartOffsetPercent : 50;
    }

    const dateX =
      progressStartOffsetPercent +
      (index / (datePoints.length - 1)) * (100 - progressStartOffsetPercent);
    return isStart ? Math.max(0, dateX - progressStartOffsetPercent) : dateX;
  };

  const pauseBands = progressTimeline.pauseSegments.map((segment, index) => {
    const startX = getXPercent(segment.startDayKey);
    const endX = Math.max(startX + 3, getXPercent(segment.endDayKey));
    return {
      key: `${segment.startDayKey}-${segment.endDayKey}-${index}`,
      startX,
      endX,
      segment,
    };
  });

  const chartPoints: ChartPoint[] = isSpeedMode
    ? speedTimeline.map((point) => {
        const x = getXPercent(point.dayKey);
        const y = chartHeight - (point.value / yAxisMax) * chartHeight;
        return { ...point, mode: "speed", x, y };
      })
    : progressTimeline.points.map((point) => {
        const x = getXPercent(point.dayKey, point.isStart);
        const y = chartHeight - (point.progressPercent / 100) * chartHeight;
        return { ...point, mode: "progress", value: point.progressPercent, x, y };
      });
  const linePoints = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const areaPoints =
    chartPoints.length > 0
      ? `0,${chartHeight} ${chartPoints.map((point) => `${point.x},${point.y}`).join(" ")} 100,${chartHeight}`
      : "";

  const activePoint =
    activePointIndex === null ? null : chartPoints[activePointIndex] ?? null;
  const activePointXPercent = activePoint === null ? 0 : activePoint.x;
  const activeTooltipTransform =
    activePointXPercent < 8
      ? "translateX(0)"
      : activePointXPercent > 92
        ? "translateX(-100%)"
        : "translateX(-50%)";

  const labelStep = useMemo(() => {
    if (datePoints.length <= 14) return 1;
    if (datePoints.length <= 28) return 2;
    if (datePoints.length <= 42) return 3;
    if (datePoints.length <= 56) return 4;
    return 7;
  }, [datePoints.length]);

  if (!isSpeedMode && !progressTimeline.isAvailable) {
    return (
      <div className="rounded-md border bg-background/80 p-3">
        <p className="text-sm font-medium">Total pages needed</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add the book&apos;s total pages to calculate progress percentages.
        </p>
      </div>
    );
  }

  if (!isSpeedMode && progressTimeline.points.length === 0) {
    return (
      <div className="rounded-md border bg-background/80 p-3">
        <p className="text-sm font-medium">No reading log entries yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Log reading progress for this book to create the progress over time chart.
        </p>
      </div>
    );
  }

  if (isSpeedMode && maxSpeed <= 0) {
    return (
      <div className="rounded-md border bg-background/80 p-3">
        <p className="text-sm font-medium">No speed data yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add reading time to your progress entries to see reading speed over time.
        </p>
      </div>
    );
  }

  return (
    <div className={isSpeedMode ? "grid grid-cols-[4.5rem_1fr] gap-2" : "grid grid-cols-[2.5rem_1fr] gap-2"}>
      <div className="flex h-44 flex-col justify-between text-[10px] text-muted-foreground">
        {yAxisLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="min-w-0">
        <div className="space-y-2 px-1">
          <div className="relative h-44 w-full">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              <div className="border-t border-border/70" />
              <div className="border-t border-border/50" />
              <div className="border-t border-border/70" />
            </div>

            {pauseBands.map(({ key, startX, endX, segment }) => (
              <div
                key={key}
                className="pointer-events-none absolute inset-y-0 z-[1] overflow-hidden rounded-md border border-dashed border-muted-foreground/25 bg-muted/20"
                style={{ left: `${startX}%`, width: `${Math.max(4, endX - startX)}%` }}
              >
                <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                  <span className="inline-flex flex-col items-center gap-1">
                    <PauseCircle className="h-5 w-5 text-muted-foreground/70" />
                    <span>
                      Paused for {segment.durationDays}
                      {segment.durationDays === 1 ? " day" : " days"}
                    </span>
                  </span>
                </div>
              </div>
            ))}

            {activePoint && (
              <div
                className="pointer-events-none absolute top-2 z-10 rounded-md border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
                style={{
                  left: `${activePointXPercent}%`,
                  transform: activeTooltipTransform,
                }}
              >
                {activePoint.mode === "progress" ? (
                  <>
                    {activePoint.isStart
                      ? "Start"
                      : formatFullDayLabel(activePoint.dayKey)}
                    : {activePoint.progressPercent}% · page {activePoint.currentPage}
                  </>
                ) : (
                  <>
                    {formatFullDayLabel(activePoint.dayKey)}:{" "}
                    {formatPagesPerHour(activePoint.value)}
                  </>
                )}
              </div>
            )}

            <svg
              className="absolute inset-0 z-[2] overflow-visible"
              width="100%"
              height={chartHeight}
              viewBox={`0 0 100 ${chartHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={
                isSpeedMode
                  ? "Line chart showing reading speed through time"
                  : "Line chart showing book progress through time"
              }
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.34" />
                  <stop offset="70%" stopColor="var(--primary)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={areaPoints} fill={`url(#${gradientId})`} />
              <polyline
                points={linePoints}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {chartPoints.map((point, index) => {
              const isProgressPoint = point.mode === "progress";
              const nextPoint = isProgressPoint ? chartPoints[index + 1] : null;
              const isDayBeforeProgressIncrease =
                isProgressPoint &&
                !point.isStart &&
                !point.hasProgressIncrease &&
                !!nextPoint &&
                nextPoint.mode === "progress" &&
                nextPoint.hasProgressIncrease;
              const showMarker = isProgressPoint
                ? point.isStart || point.hasProgressIncrease || isDayBeforeProgressIncrease
                : point.value > 0;
              const label = isProgressPoint
                ? point.isStart
                  ? `Start: ${point.progressPercent}% progress`
                  : `${formatFullDayLabel(point.dayKey)}: ${point.progressPercent}% progress, page ${
                      point.currentPage
                    }`
                : `${formatFullDayLabel(point.dayKey)}: ${formatPagesPerHour(point.value)}`;

              return (
                <button
                  key={`${point.dayKey}-${point.value}-${index}`}
                  type="button"
                  className={
                    showMarker
                      ? "absolute z-[3] h-[clamp(0.4rem,0.65vw,0.55rem)] w-[clamp(0.4rem,0.65vw,0.55rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      : "absolute z-[3] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  }
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}px`,
                    borderColor: showMarker
                      ? "color-mix(in oklch, var(--muted) 20%, var(--background))"
                      : "transparent",
                  }}
                  onMouseEnter={() => setActivePointIndex(index)}
                  onMouseLeave={() => setActivePointIndex(null)}
                  onFocus={() => setActivePointIndex(index)}
                  onBlur={() => setActivePointIndex(null)}
                  aria-label={label}
                />
              );
            })}
          </div>

          <div className="relative h-4 w-full">
            {datePoints.map((point, index) => {
              const x = getXPercent(point.dayKey);
              const shouldShow =
                datePoints.length <= 10 ||
                index === 0 ||
                index === datePoints.length - 1 ||
                index % labelStep === 0;
              const label = formatDayLabel(dayFromKey(point.dayKey));

              return (
                <span
                  key={`${point.dayKey}-label-${index}`}
                  className="absolute w-16 -translate-x-1/2 text-center text-[10px] text-muted-foreground"
                  style={{ left: `${x}%` }}
                >
                  {shouldShow ? label : ""}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
