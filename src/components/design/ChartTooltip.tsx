import { useLayoutEffect, useRef, type ReactNode } from "react";

interface ChartTooltipProps {
  xPercent: number;
  y: number;
  barCount?: number;
  children: ReactNode;
}

/** Render directly inside the chart's positioned plotting area. */
export default function ChartTooltip({ xPercent, y, barCount, children }: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    const plot = tooltip?.parentElement;
    if (!tooltip || !plot) return;

    const position = () => {
      const width = plot.clientWidth;
      const height = plot.clientHeight;
      const x = (xPercent / 100) * width;
      // Match the bars' 70% column width and 2rem maximum width.
      const halfWidth = barCount ? Math.min((width / barCount) * 0.35, 16) : 4;
      const gap = halfWidth + 8;
      const rightSpace = Math.max(0, width - x - gap);
      const leftSpace = Math.max(0, x - gap);

      // Measure the content before choosing a side; percentages alone cannot
      // account for long dates, units, or a narrow chart on mobile.
      tooltip.style.maxWidth = `${width}px`;
      const naturalWidth = tooltip.getBoundingClientRect().width;
      const useRight = rightSpace >= naturalWidth ||
        (leftSpace < naturalWidth && rightSpace >= leftSpace);
      tooltip.style.maxWidth = `${Math.max(1, useRight ? rightSpace : leftSpace)}px`;

      const bounds = tooltip.getBoundingClientRect();
      tooltip.style.left = `${useRight ? x + gap : x - gap - bounds.width}px`;
      tooltip.style.top = `${Math.max(0, Math.min(y - bounds.height / 2, height - bounds.height))}px`;
    };

    position();
    const observer = new ResizeObserver(position);
    observer.observe(plot);
    return () => observer.disconnect();
  }, [xPercent, y, barCount, children]);

  return (
    <div
      ref={tooltipRef}
      role="tooltip"
      className="pointer-events-none absolute z-10 w-max break-words rounded-md border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
    >
      {children}
    </div>
  );
}
