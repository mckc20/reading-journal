import { ChartScatter, Clock } from "lucide-react";
import { useState } from "react";

import { formatMinutesCompact, type ReadingHabitsMetrics, type WeekdayStats } from "@/lib/readingHabits";

interface WeekdayPatternsChartProps {
  weekdays: ReadingHabitsMetrics["weekdays"];
}

const DOT_COLOR = "#EEBC72";

function getColumnPercent(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.max((value / maxValue) * 100, 6);
}

function getActivityLabel(day: WeekdayStats, highest: WeekdayStats, lowest: WeekdayStats): string | null {
  const isMost = day.weekdayLabel === highest.weekdayLabel;
  const isLeast = day.weekdayLabel === lowest.weekdayLabel;

  if (isMost && isLeast) return "Most and least active";
  if (isMost) return "Most active";
  if (isLeast) return "Least active";
  return null;
}

function getActivityMarker(label: string | null): string | null {
  if (label === "Most and least active") return "↕";
  if (label === "Most active") return "↑";
  if (label === "Least active") return "↓";
  return null;
}

function formatWeekStart(weekStartIso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(weekStartIso));
}

export default function WeekdayPatternsChart({ weekdays }: WeekdayPatternsChartProps) {
  const [showWeeklyDots, setShowWeeklyDots] = useState(true);

  const highest = weekdays.highest;
  const lowest = weekdays.lowest;

  if (!highest || !lowest) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Add more reading sessions to establish weekday trends.
      </p>
    );
  }

  const maxMedianMinutes = Math.max(...weekdays.all.map((day) => day.medianMinutesPerWeek), 0);
  const maxWeeklyMinutes = Math.max(
    ...weekdays.all.flatMap((day) => day.weeklyValues.map((week) => week.minutes)),
    0
  );
  const chartMaxMinutes = Math.max(maxMedianMinutes, showWeeklyDots ? maxWeeklyMinutes : 0);

  return (
    <section className="mt-3 space-y-3" aria-label="Weekday patterns chart">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Chart legend">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-primary/85" aria-hidden="true" />
            Median minutes/week
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DOT_COLOR }} aria-hidden="true" />
            Individual weeks
          </span>
          <span className="inline-flex items-center gap-1.5" aria-hidden="true">
            <span>↑</span>
            Most typical
          </span>
          <span className="inline-flex items-center gap-1.5" aria-hidden="true">
            <span>↓</span>
            Least typical
          </span>
        </div>

        <button
          type="button"
          className="inline-flex h-6 items-center gap-1.5 rounded-sm px-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          onClick={() => setShowWeeklyDots((current) => !current)}
          aria-pressed={showWeeklyDots}
        >
          <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border border-muted-foreground/70 text-[10px] leading-none"
            aria-hidden="true"
          >
            {showWeeklyDots ? "✓" : ""}
          </span>
          Individual weeks
        </button>
      </div>

      <div className="rounded-md border px-3 py-3">
        <div className="grid h-56 grid-cols-7 items-end gap-2" aria-label="Median reading minutes by weekday">
          {weekdays.all.map((day) => {
            const activityLabel = getActivityLabel(day, highest, lowest);
            const activityMarker = getActivityMarker(activityLabel);
            const medianMinutes = day.medianMinutesPerWeek;
            const medianLabel = formatMinutesCompact(medianMinutes);
            const columnHeight = getColumnPercent(medianMinutes, chartMaxMinutes);

            return (
              <div
                key={day.weekdayLabel}
                tabIndex={0}
                className="group flex h-full min-w-0 flex-col justify-end rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                aria-label={`${day.weekdayLabel}: median ${medianLabel} per week, ${day.totalSessions} total sessions${activityLabel ? `, ${activityLabel.toLowerCase()}` : ""}`}
              >
                <div className="mb-2 text-center text-xs font-medium tabular-nums">{medianLabel}</div>

                <div className="relative mx-auto flex h-36 w-full max-w-12 items-end justify-center border-b border-muted">
                  {showWeeklyDots
                    ? day.weeklyValues.map((week, index) => {
                        if (week.minutes <= 0) return null;

                        const dotBottom = getColumnPercent(week.minutes, chartMaxMinutes);
                        const dotOffset = day.weeklyValues.length <= 1 ? 50 : (index / (day.weeklyValues.length - 1)) * 70 + 15;

                        return (
                          <span
                            key={`${week.weekStartIso}-${index}`}
                            className="absolute h-1.5 w-1.5 rounded-full opacity-75 shadow-sm"
                            style={{
                              bottom: `${dotBottom}%`,
                              left: `${dotOffset}%`,
                              backgroundColor: DOT_COLOR,
                            }}
                            title={`${formatWeekStart(week.weekStartIso)}: ${formatMinutesCompact(week.minutes)}`}
                            aria-hidden="true"
                          />
                        );
                      })
                    : null}

                  <div
                    className="w-7 rounded-t-sm bg-primary/85 transition-colors group-hover:bg-primary"
                    style={{
                      height: `${columnHeight}%`,
                    }}
                    aria-hidden="true"
                  />
                </div>

                <div className="mt-2 flex min-h-8 flex-col items-center justify-start text-center">
                  <span className="text-sm font-medium leading-tight">{day.weekdayLabel.slice(0, 3)}</span>
                  <span className="inline-flex items-center justify-center gap-0.5 text-[10px] leading-tight text-muted-foreground sm:hidden">
                    {activityMarker ? <span aria-hidden="true">{activityMarker}</span> : null}
                    <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                    <span>{day.totalSessions}</span>
                    <span className="sr-only">
                      {" "}
                      session{day.totalSessions === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="hidden text-[11px] leading-tight text-muted-foreground sm:inline">
                    {activityMarker ? `${activityMarker} ` : ""}
                    {day.totalSessions} session{day.totalSessions === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {showWeeklyDots ? (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ChartScatter className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Dots show individual weeks, so one unusually long week does not get hidden by the median.
          </p>
        ) : null}
      </div>
    </section>
  );
}
