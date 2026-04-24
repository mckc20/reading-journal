import type { ReadingHabitsMetrics, WeekdayStats } from "@/lib/readingHabits";

interface WeekdayPatternsChartProps {
  weekdays: ReadingHabitsMetrics["weekdays"];
}

const MINUTES_COLOR = "#111111";
const SESSIONS_COLOR = "#EEBC72";

function getBarPercent(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.max((value / maxValue) * 100, 4);
}

function getActivityLabel(day: WeekdayStats, highest: WeekdayStats, lowest: WeekdayStats): string | null {
  const isMost = day.weekdayLabel === highest.weekdayLabel;
  const isLeast = day.weekdayLabel === lowest.weekdayLabel;

  if (isMost && isLeast) return "Most & least";
  if (isMost) return "Most active";
  if (isLeast) return "Least active";
  return null;
}

function getActivityMarker(label: string | null): string | null {
  if (label === "Most & least") return "↕";
  if (label === "Most active") return "↑";
  if (label === "Least active") return "↓";
  return null;
}

export default function WeekdayPatternsChart({ weekdays }: WeekdayPatternsChartProps) {
  const highest = weekdays.highest;
  const lowest = weekdays.lowest;

  if (!highest || !lowest) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Add more reading sessions to establish weekday trends.
      </p>
    );
  }

  const maxMinutes = Math.max(...weekdays.all.map((day) => day.avgMinutesPerWeek), 0);
  const maxSessions = Math.max(...weekdays.all.map((day) => day.avgSessionsPerWeek), 0);

  return (
    <section className="mt-3 space-y-2" aria-label="Weekday patterns chart">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Chart legend">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: MINUTES_COLOR }} aria-hidden="true" />
          Minutes/week
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: SESSIONS_COLOR }} aria-hidden="true" />
          Sessions/week
        </span>
        <span className="inline-flex items-center gap-1.5" aria-hidden="true">
          <span>↑</span>
          Most active
        </span>
        <span className="inline-flex items-center gap-1.5" aria-hidden="true">
          <span>↓</span>
          Least active
        </span>
      </div>

      <ul className="overflow-hidden rounded-md border" aria-label="Weekday rows from Monday to Sunday">
        {weekdays.all.map((day) => {
          const activityLabel = getActivityLabel(day, highest, lowest);
          const activityMarker = getActivityMarker(activityLabel);
          const minutesPerWeek = day.avgMinutesPerWeek.toFixed(1);
          const sessionsPerWeek = day.avgSessionsPerWeek.toFixed(1);

          return (
            <li
              key={day.weekdayLabel}
              tabIndex={0}
              className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-stretch border-b bg-background last:border-b-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label={`${day.weekdayLabel}: ${minutesPerWeek} minutes per week, ${sessionsPerWeek} sessions per week${activityLabel ? `, ${activityLabel.toLowerCase()}` : ""}`}
            >
              <div className="flex items-center gap-1.5 border-r bg-muted/15 px-2 py-2">
                <span className="text-sm font-medium">{day.weekdayLabel.slice(0, 3)}</span>
                {activityMarker ? (
                  <span className="text-[11px] leading-none text-muted-foreground" title={activityLabel ?? undefined} aria-hidden="true">
                    {activityMarker}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-0.5">
                <div className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 px-2 py-1">
                  <div className="h-2 overflow-hidden rounded-full bg-muted/50" role="img" aria-label={`${minutesPerWeek} minutes per week`}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${getBarPercent(day.avgMinutesPerWeek, maxMinutes)}%`,
                        backgroundColor: MINUTES_COLOR,
                      }}
                    />
                  </div>
                  <span className="text-right text-xs font-medium tabular-nums sm:text-sm">{minutesPerWeek}</span>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 px-2 py-1">
                  <div className="h-2 overflow-hidden rounded-full bg-muted/50" role="img" aria-label={`${sessionsPerWeek} sessions per week`}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${getBarPercent(day.avgSessionsPerWeek, maxSessions)}%`,
                        backgroundColor: SESSIONS_COLOR,
                      }}
                    />
                  </div>
                  <span className="text-right text-xs font-medium tabular-nums sm:text-sm">{sessionsPerWeek}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
