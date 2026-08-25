import { useId, useMemo, useState, type ReactNode } from "react";
import { AppHeading } from "@/components/design/Typography";
import type { ChartDatum } from "@/components/design/VerticalBarChart";

interface LineChartProps {
  title?: ReactNode;
  data: ChartDatum[];
  formatValue: (value: number) => string;
  empty?: ReactNode;
  ariaLabel?: string;
}

export default function LineChart({
  title,
  data,
  formatValue,
  empty = "No data for this chart yet.",
  ariaLabel = "Line chart",
}: LineChartProps) {
  const gradientId = `line-chart-fill-${useId().replace(/:/g, "")}`;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const maxValue = Math.max(...data.map((point) => point.value), 0);
  const yAxisMax = maxValue > 0 ? maxValue : 1;
  const yTicks = [yAxisMax, yAxisMax / 2, 0];
  const chartHeight = 176;
  const points = useMemo(() => {
    if (data.length === 0) return [];
    if (data.length === 1) {
      return [{ ...data[0], x: 50, y: chartHeight - (data[0].value / yAxisMax) * chartHeight }];
    }

    return data.map((point, index) => ({
      ...point,
      x: (index / (data.length - 1)) * 100,
      y: chartHeight - (point.value / yAxisMax) * chartHeight,
    }));
  }, [data, yAxisMax]);
  const activePoint = activeKey ? points.find((point) => point.key === activeKey) ?? null : null;
  const activePointTooltipTransform =
    !activePoint || activePoint.x < 8
      ? "translateX(0)"
      : activePoint.x > 92
        ? "translateX(-100%)"
        : "translateX(-50%)";
  const labelStep = useMemo(() => {
    if (data.length <= 10) return 1;
    if (data.length <= 28) return 2;
    if (data.length <= 42) return 3;
    if (data.length <= 56) return 4;
    return 7;
  }, [data.length]);
  const gridStyle = useMemo(
    () => ({ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }),
    [data.length],
  );
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints =
    points.length > 0
      ? `0,${chartHeight} ${points.map((point) => `${point.x},${point.y}`).join(" ")} 100,${chartHeight}`
      : "";

  return (
    <div className="rounded-lg bg-muted/20 p-4">
      {title ? <AppHeading level={4}>{title}</AppHeading> : null}
      {data.length === 0 || maxValue <= 0 ? (
        <div className="mt-4 flex min-h-36 items-center justify-center rounded-lg bg-muted/20 px-4 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className={title ? "mt-4 space-y-2" : "space-y-2"}>
          <div className="grid grid-cols-[3rem_1fr] gap-2">
            <div className="flex h-44 flex-col justify-between text-right text-[10px] text-muted-foreground">
              {yTicks.map((tick, index) => (
                <span key={`${tick}-${index}`}>{formatValue(tick)}</span>
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

                  {activePoint && (
                    <div
                      className="pointer-events-none absolute top-2 z-10 rounded-md border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
                      style={{ left: `${activePoint.x}%`, transform: activePointTooltipTransform }}
                    >
                      {activePoint.label}: {formatValue(activePoint.value)}
                    </div>
                  )}

                  <svg
                    className="absolute inset-0 z-[2] overflow-visible"
                    width="100%"
                    height={chartHeight}
                    viewBox={`0 0 100 ${chartHeight}`}
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={ariaLabel}
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

                  {points.map((point) => (
                    <button
                      key={point.key}
                      type="button"
                      className="absolute z-[3] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      style={{ left: `${point.x}%`, top: `${point.y}px` }}
                      onMouseEnter={() => setActiveKey(point.key)}
                      onMouseLeave={() => setActiveKey(null)}
                      onFocus={() => setActiveKey(point.key)}
                      onBlur={() => setActiveKey(null)}
                      aria-label={`${point.label}: ${formatValue(point.value)}`}
                    >
                      <span className="block h-2.5 w-2.5 rounded-full border-2 border-background bg-primary shadow-sm" />
                    </button>
                  ))}
                </div>

                <div className="grid w-full gap-1" style={gridStyle}>
                  {data.map((point, index) => (
                    <span
                      key={`${point.key}-label`}
                      className="min-w-0 break-words text-center text-[10px] leading-tight text-muted-foreground"
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
