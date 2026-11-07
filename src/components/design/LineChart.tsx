import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AppHeading } from "@/components/design/Typography";
import ChartTooltip from "@/components/design/ChartTooltip";
import type { ChartDatum } from "@/components/design/VerticalBarChart";
import { cn } from "@/lib/utils";

interface LineChartProps {
  title?: ReactNode;
  data: ChartDatum[];
  formatValue: (value: number) => string;
  empty?: ReactNode;
  ariaLabel?: string;
  variant?: "default" | "timeline";
}

export default function LineChart({
  title,
  data,
  formatValue,
  empty = "No data for this chart yet.",
  ariaLabel = "Line chart",
  variant = "default",
}: LineChartProps) {
  const timeline = variant === "timeline";
  const gradientId = `line-chart-fill-${useId().replace(/:/g, "")}`;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeKey === null) return;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !chartRef.current?.contains(event.target)) setActiveKey(null);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveKey(null);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [activeKey]);
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
      x: (timeline ? 1.5 : 0) + (index / (data.length - 1)) * (timeline ? 98.5 : 100),
      y: chartHeight - (point.value / yAxisMax) * chartHeight,
    }));
  }, [data, yAxisMax, timeline]);
  const activePoint = activeKey ? points.find((point) => point.key === activeKey) ?? null : null;
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
    <div ref={chartRef} className={timeline ? "space-y-3" : "rounded-lg bg-muted/20 p-4"}>
      {title ? timeline ? <h4 className="text-sm font-medium">{title}</h4> : <AppHeading level={4}>{title}</AppHeading> : null}
      {data.length === 0 || maxValue <= 0 ? (
        <div className={timeline ? "rounded-md border bg-background/80 p-3 text-sm text-muted-foreground" : "mt-4 flex min-h-36 items-center justify-center rounded-lg bg-muted/20 px-4 text-center text-sm text-muted-foreground"}>
          {empty}
        </div>
      ) : (
        <div className={title && !timeline ? "mt-4 space-y-2" : "space-y-2"}>
          <div className={cn("grid gap-2", timeline ? "grid-cols-[4.5rem_minmax(0,1fr)]" : "grid-cols-[3rem_1fr]")}>
            <div className={cn("flex h-44 flex-col justify-between text-[10px] text-muted-foreground", !timeline && "text-right")}>
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
                    <ChartTooltip xPercent={activePoint.x} y={activePoint.y}>
                      {activePoint.label}: {formatValue(activePoint.value)}
                    </ChartTooltip>
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
                      className="absolute z-[3] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      style={{ left: `${point.x}%`, top: `${point.y}px` }}
                      onPointerEnter={(event) => { if (event.pointerType === "mouse") setActiveKey(point.key); }}
                      onPointerLeave={(event) => { if (event.pointerType === "mouse") setActiveKey(null); }}
                      onPointerDown={(event) => {
                        if (event.pointerType === "touch") setActiveKey((key) => key === point.key ? null : point.key);
                      }}
                      onFocus={(event) => {
                        if (event.currentTarget.matches(":focus-visible")) setActiveKey(point.key);
                      }}
                      onBlur={() => setActiveKey((key) => key === point.key ? null : key)}
                      aria-label={`${point.label}: ${formatValue(point.value)}`}
                    >
                      <span className={timeline
                        ? "mx-auto block h-[clamp(0.4rem,0.65vw,0.55rem)] w-[clamp(0.4rem,0.65vw,0.55rem)] rounded-full border bg-primary"
                        : "block h-2.5 w-2.5 rounded-full border-2 border-background bg-primary shadow-sm"}
                        style={timeline ? { borderColor: "color-mix(in oklch, var(--muted) 20%, var(--background))" } : undefined} />
                    </button>
                  ))}
                </div>

                <div className={timeline ? "relative h-4 w-full" : "grid w-full gap-1"} style={timeline ? undefined : gridStyle}>
                  {data.map((point, index) => (
                    <span
                      key={`${point.key}-label`}
                      className={cn("min-w-0 text-[10px] leading-tight text-muted-foreground", timeline
                        ? "absolute w-max max-w-20 truncate"
                        : "break-words text-center")}
                      style={timeline ? {
                        left: `${points[index].x}%`,
                        transform: index === 0 ? undefined : index === data.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                      } : undefined}
                    >
                      {point.mobileAxisLabel !== undefined ? <>
                        <span className="sm:hidden">{index % 2 === 0 ? point.mobileAxisLabel : ""}</span>
                        <span className="hidden sm:inline">{data.length <= 10 || index === 0 || index === data.length - 1 || index % labelStep === 0 ? point.label : ""}</span>
                      </> : data.length <= 10 ||
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
