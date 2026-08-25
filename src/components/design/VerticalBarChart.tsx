import { useMemo, useState, type ReactNode } from "react";
import { AppHeading } from "@/components/design/Typography";
import { cn } from "@/lib/utils";

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
}

interface VerticalBarChartProps {
  title?: ReactNode;
  data: ChartDatum[];
  formatValue: (value: number) => string;
  empty?: ReactNode;
  action?: ReactNode;
  highlightKey?: string | null;
  showAllXLabels?: boolean;
  yAxisClassName?: string;
}

export default function VerticalBarChart({
  title,
  data,
  formatValue,
  empty = "No data for this chart yet.",
  action,
  highlightKey,
  showAllXLabels = false,
  yAxisClassName = "grid-cols-[3rem_1fr]",
}: VerticalBarChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const maxValue = Math.max(...data.map((point) => point.value), 0);
  const yAxisMax = maxValue > 0 ? maxValue : 1;
  const yTicks = [yAxisMax, yAxisMax / 2, 0];
  const activePoint = activeKey ? data.find((point) => point.key === activeKey) ?? null : null;
  const activePointIndex = activePoint ? data.findIndex((point) => point.key === activePoint.key) : -1;
  const activePointXPercent =
    activePointIndex < 0 || data.length === 0 ? 0 : ((activePointIndex + 0.5) / data.length) * 100;
  const activePointTooltipTransform =
    activePointXPercent < 12
      ? "translateX(0)"
      : activePointXPercent > 88
        ? "translateX(-100%)"
        : "translateX(-50%)";

  const labelStep = useMemo(() => {
    if (showAllXLabels) return 1;
    if (data.length <= 10) return 1;
    if (data.length <= 28) return 2;
    if (data.length <= 42) return 3;
    if (data.length <= 56) return 4;
    return 7;
  }, [data.length, showAllXLabels]);
  const gridStyle = useMemo(
    () => ({ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }),
    [data.length],
  );

  return (
    <div className="rounded-lg bg-muted/20 p-4">
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <AppHeading level={4}>{title}</AppHeading> : <span />}
          {action}
        </div>
      )}
      {data.length === 0 || maxValue <= 0 ? (
        <div className="mt-4 flex min-h-36 items-center justify-center rounded-lg bg-muted/20 px-4 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className={cn("space-y-2", title || action ? "mt-4" : "")}>
          <div className={cn("grid gap-2", yAxisClassName)}>
            <div className="flex h-44 flex-col justify-between text-right text-[10px] text-muted-foreground">
              {yTicks.map((tick, index) => (
                <span key={`${tick}-${index}`}>{formatValue(tick)}</span>
              ))}
            </div>
            <div className="min-w-0">
              <div className="w-full space-y-2 px-1">
                <div className="relative h-44 w-full">
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    <div className="border-t border-border/70" />
                    <div className="border-t border-border/50" />
                    <div className="border-t border-border/70" />
                  </div>

                  {activePoint && activePointIndex >= 0 && (
                    <div
                      className="pointer-events-none absolute top-2 z-10 rounded-md border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
                      style={{
                        left: `${activePointXPercent}%`,
                        transform: activePointTooltipTransform,
                      }}
                    >
                      {activePoint.label}: {formatValue(activePoint.value)}
                    </div>
                  )}

                  <div className="relative grid h-full w-full items-end" style={gridStyle}>
                    {data.map((point) => {
                      const chartHeightPx = 176;
                      const normalizedHeight = Math.round((point.value / yAxisMax) * chartHeightPx);
                      const barHeight = point.value > 0 ? Math.max(normalizedHeight, 4) : 0;
                      const highlighted = point.key === highlightKey;

                      return (
                        <button
                          key={point.key}
                          type="button"
                          className="group flex h-full min-w-0 items-end justify-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                          onMouseEnter={() => setActiveKey(point.key)}
                          onMouseLeave={() => setActiveKey(null)}
                          onFocus={() => setActiveKey(point.key)}
                          onBlur={() => setActiveKey(null)}
                          aria-label={`${point.label}: ${formatValue(point.value)}`}
                        >
                          <div
                            className={cn(
                              "w-[70%] max-w-8 rounded-t-sm transition-colors group-hover:bg-primary",
                              highlighted ? "bg-rating" : "bg-primary/85",
                            )}
                            style={{ height: `${barHeight}px` }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid w-full" style={gridStyle}>
                  {data.map((point, index) => (
                    <span
                      key={`${point.key}-label`}
                      className="min-w-0 text-center text-[10px] leading-tight text-muted-foreground"
                    >
                      {data.length <= 10 ||
                      index === 0 ||
                      index === data.length - 1 ||
                      index % labelStep === 0
                        ? point.label
                        : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
