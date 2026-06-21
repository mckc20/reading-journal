import { useId, useMemo, useState } from "react";
import { PauseCircle } from "lucide-react";
import { buildProgressTimeline } from "@/lib/bookAnalytics";
import type { BookPausePeriod, ReadingLog } from "@/types";

interface ProgressOverTimeChartProps {
  logs: ReadingLog[];
  totalPages?: number;
  pausePeriods?: BookPausePeriod[];
}

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

export default function ProgressOverTimeChart({
  logs,
  totalPages,
  pausePeriods = [],
}: ProgressOverTimeChartProps) {
  const [activeProgressIndex, setActiveProgressIndex] = useState<number | null>(null);
  const gradientId = `progress-fill-${useId().replace(/:/g, "")}`;
  const progressTimeline = useMemo(
    () => buildProgressTimeline(logs, totalPages, pausePeriods),
    [logs, pausePeriods, totalPages],
  );

  const progressChartHeight = 176;
  const progressDatePoints = useMemo(
    () => progressTimeline.points.filter((point) => !point.isStart),
    [progressTimeline.points],
  );
  const progressStartOffsetPercent = 1.5;

  const getProgressXPercent = (dayKey: string, isStart = false): number => {
    const index = progressDatePoints.findIndex((point) => point.dayKey === dayKey);
    if (index < 0) {
      if (progressDatePoints.length === 0) return 0;
      const firstDayKey = progressDatePoints[0].dayKey;
      const lastDayKey = progressDatePoints[progressDatePoints.length - 1].dayKey;
      if (dayKey < firstDayKey) return 0;
      if (dayKey > lastDayKey) return 100;
      return 0;
    }
    if (progressDatePoints.length === 1) {
      return isStart ? 50 - progressStartOffsetPercent : 50;
    }

    const dateX =
      progressStartOffsetPercent +
      (index / (progressDatePoints.length - 1)) * (100 - progressStartOffsetPercent);
    return isStart ? Math.max(0, dateX - progressStartOffsetPercent) : dateX;
  };

  const pauseBands = progressTimeline.pauseSegments.map((segment, index) => {
    const startX = getProgressXPercent(segment.startDayKey);
    const endX = Math.max(startX + 3, getProgressXPercent(segment.endDayKey));
    return {
      key: `${segment.startDayKey}-${segment.endDayKey}-${index}`,
      startX,
      endX,
      segment,
    };
  });

  const progressPoints = progressTimeline.points.map((point) => {
    const x = getProgressXPercent(point.dayKey, point.isStart);
    const y = progressChartHeight - (point.progressPercent / 100) * progressChartHeight;
    return { ...point, x, y };
  });
  const progressLinePoints = progressPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const progressAreaPoints =
    progressPoints.length > 0
      ? `0,${progressChartHeight} ${progressPoints.map((point) => `${point.x},${point.y}`).join(" ")} 100,${progressChartHeight}`
      : "";

  const activeProgressPoint =
    activeProgressIndex === null ? null : progressTimeline.points[activeProgressIndex] ?? null;
  const activeProgressXPercent =
    activeProgressPoint === null
      ? 0
      : getProgressXPercent(activeProgressPoint.dayKey, activeProgressPoint.isStart);
  const activeProgressTooltipTransform =
    activeProgressXPercent < 8
      ? "translateX(0)"
      : activeProgressXPercent > 92
        ? "translateX(-100%)"
        : "translateX(-50%)";

  const progressLabelStep = useMemo(() => {
    if (progressDatePoints.length <= 14) return 1;
    if (progressDatePoints.length <= 28) return 2;
    if (progressDatePoints.length <= 42) return 3;
    if (progressDatePoints.length <= 56) return 4;
    return 7;
  }, [progressDatePoints.length]);

  if (!progressTimeline.isAvailable) {
    return (
      <div className="rounded-md border bg-background/80 p-3">
        <p className="text-sm font-medium">Total pages needed</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add the book&apos;s total pages to calculate progress percentages.
        </p>
      </div>
    );
  }

  if (progressTimeline.points.length === 0) {
    return (
      <div className="rounded-md border bg-background/80 p-3">
        <p className="text-sm font-medium">No reading log entries yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Log reading progress for this book to create the progress over time chart.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-2">
      <div className="flex h-44 flex-col justify-between text-[10px] text-muted-foreground">
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
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

            {activeProgressPoint && (
              <div
                className="pointer-events-none absolute top-2 z-10 rounded-md border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
                style={{
                  left: `${activeProgressXPercent}%`,
                  transform: activeProgressTooltipTransform,
                }}
              >
                {activeProgressPoint.isStart
                  ? "Start"
                  : formatFullDayLabel(activeProgressPoint.dayKey)}
                : {activeProgressPoint.progressPercent}% · page{" "}
                {activeProgressPoint.currentPage}
              </div>
            )}

            <svg
              className="absolute inset-0 z-[2] overflow-visible"
              width="100%"
              height={progressChartHeight}
              viewBox={`0 0 100 ${progressChartHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Line chart showing book progress through time"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.34" />
                  <stop offset="70%" stopColor="var(--primary)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={progressAreaPoints} fill={`url(#${gradientId})`} />
              <polyline
                points={progressLinePoints}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {progressTimeline.points.map((point, index) => {
              const nextPoint = progressTimeline.points[index + 1];
              const isDayBeforeProgressIncrease =
                !point.isStart &&
                !point.hasProgressIncrease &&
                !!nextPoint?.hasProgressIncrease;
              const showMarker =
                point.isStart || point.hasProgressIncrease || isDayBeforeProgressIncrease;
              const x = getProgressXPercent(point.dayKey, point.isStart);
              const y = progressChartHeight - (point.progressPercent / 100) * progressChartHeight;
              const label = point.isStart
                ? `Start: ${point.progressPercent}% progress`
                : `${formatFullDayLabel(point.dayKey)}: ${point.progressPercent}% progress, page ${
                    point.currentPage
                  }`;

              return (
                <button
                  key={`${point.dayKey}-${point.currentPage}-${index}`}
                  type="button"
                  className={
                    showMarker
                      ? "absolute z-[3] h-[clamp(0.4rem,0.65vw,0.55rem)] w-[clamp(0.4rem,0.65vw,0.55rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      : "absolute z-[3] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  }
                  style={{
                    left: `${x}%`,
                    top: `${y}px`,
                    borderColor: showMarker
                      ? "color-mix(in oklch, var(--muted) 20%, var(--background))"
                      : "transparent",
                  }}
                  onMouseEnter={() => setActiveProgressIndex(index)}
                  onMouseLeave={() => setActiveProgressIndex(null)}
                  onFocus={() => setActiveProgressIndex(index)}
                  onBlur={() => setActiveProgressIndex(null)}
                  aria-label={label}
                />
              );
            })}
          </div>

          <div className="relative h-4 w-full">
            {progressDatePoints.map((point, index) => {
              const x = getProgressXPercent(point.dayKey);
              const shouldShow =
                progressDatePoints.length <= 10 ||
                index === 0 ||
                index === progressDatePoints.length - 1 ||
                index % progressLabelStep === 0;
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
